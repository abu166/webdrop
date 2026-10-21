# WebDrop

Private, browser-to-browser chat and file sharing. React + Tailwind UI, Go WebSocket signaling, and an ordered WebRTC data channel per peer. No accounts, database, file uploads, or message storage on the signaling server.

## Run locally

Requires Go 1.22+ and Node.js 22+.

```sh
# Terminal 1
cd backend
go mod download
go run ./cmd/server
```

```sh
# Terminal 2
cd frontend
npm ci
npm run dev
```

Open the Vite URL (normally http://localhost:5173), enter a name, generate a room, and enter it. Click **Invite someone** and open the complete invite URL in another browser. The room ID alone does not carry the encryption key. No files or chat history survive leaving or refreshing the page; downloaded files remain on the recipient's disk.

The default Vite `/ws` proxy targets port 8080. Backend `PORT` defaults to `8080`. For a different signaling host, copy `frontend/.env.example` to `frontend/.env`, set `VITE_SIGNALING_URL`, and restart Vite. Frontend environment settings are embedded at build time.

## Transport and privacy

- The signaling service retains only live room membership and a room capability in memory. Empty rooms are removed. A room holds up to 16 peers, with a direct mesh of peer connections. Smaller rooms reduce device/network load.
- New invite links contain a random 256-bit key in the URL fragment. Fragments are not sent in HTTP requests. A domain-separated SHA-256 derivative authenticates WebSocket room membership; the first active peer establishes the room capability. Send the whole link only to trusted participants. Names are self-asserted and are not verified identities.
- Chat, peer names, file metadata, acknowledgements, and control messages use Web Crypto AES-256-GCM with fresh random 96-bit IVs. Wrong keys and modified ciphertext are rejected. Messages render as escaped React text; bold, inline code, and HTTP(S) links are supported without arbitrary HTML.
- File binary chunks use WebRTC's mandatory DTLS encryption and authentication in transit. Files are not additionally AES-encrypted at rest. Only encrypted control messages authorize receiving a file. The signaling host can observe room IDs, timing, IPs, and WebRTC connection metadata, but receives no chat or file payloads.
- These are capability-based rooms, not an independently audited secure messenger. A trusted web origin and trusted invite holders are part of the security model. WebRTC exposes peer network addresses as part of direct connectivity. Browser history retains invite links; clear it or use a private window on a shared device.

## File protocol and memory

1. A sender offers one file per recipient at a time. The recipient explicitly accepts into memory or selects **Save to disk**.
2. The sender reads only 16 KB slices with `File.slice().arrayBuffer()`. It pauses above a 64 KB data-channel buffer and resumes at 32 KB, using the low-buffer event with a polling fallback, close detection, cancellation, and a 30-second stall timeout.
3. The receiver acknowledges chunks only after storing them or awaiting the disk write. A 256 KB application acknowledgement window bounds queued receiver work even on slow disks. Progress and average speed represent acknowledged bytes, rather than bytes merely queued for sending.
4. The receiver checks chunk size and the declared total. The sender reports delivery only after the receiver acknowledges completion. Cancellation and disconnects abort pending writes and reject waiting operations.
5. Supported Chromium browsers can stream directly into a user-selected file using the File System Access API. This path supports gigabyte-sized files without assembling a whole Blob in JS memory, subject to filesystem/browser limits. Saving requires an explicit user gesture. The code does not assume this API exists.
6. Other browsers assemble a Blob for download, with a **256 MB aggregate session budget** across in-memory received files. Larger files require disk streaming. Completed Blob URLs intentionally remain available until leaving the room, when URLs are revoked. Start a new session to free the budget. Browser and Blob overhead can exceed the raw file size.

Transfers do not resume after refresh or reconnection. Reconnection rebuilds the peer graph and marks interrupted transfers failed. Rejoin a room to retry a failed direct connection. Empty files are supported. A chosen upload is sent to the selected peer; chat is sent separately to every connected peer. Chat history is capped at the latest 500 messages per browser.

## Deploy

```sh
cd frontend
npm run build
# Serve dist/ with your HTTPS static host.
```

```sh
# From the repository root
docker build -t webdrop-signaling backend
docker run --rm -p 8080:8080 -e PORT=8080 webdrop-signaling
```

Expose the backend behind a TLS reverse proxy with WebSocket upgrade support. Set `VITE_SIGNALING_URL=wss://your-signaling-host/ws` before building, or proxy same-origin `/ws` to the backend. `/health` returns JSON status and a UTC timestamp. SIGINT/SIGTERM close peer sockets and shut down HTTP gracefully.

HTTPS is required outside localhost for Web Crypto and disk streaming. STUN alone cannot connect all networks. Configure your own TURN service for restrictive NAT/firewalls using `VITE_ICE_SERVERS`, a JSON array of RTCIceServer objects; see `.env.example`. Use short-lived TURN credentials from your deployment's authenticated credential service. TURN may relay encrypted bytes, so relay bandwidth and availability matter. Public STUN is a development default, not an availability guarantee.

The requested permissive WebSocket origin policy is enabled. Put origin restrictions, connection/rate limits, access-log redaction for the `auth` query parameter, and sensible TLS/timeouts at your ingress. No horizontally distributed room registry is included: run one signaling instance, or route all sockets for each room to the same instance. Deployments spanning instances need an explicit shared signaling design.

## Verify

```sh
cd backend
go test -race ./...
go vet ./...
```

```sh
cd frontend
npm test
npm run build
npx playwright install chromium
# With the backend and Vite running; substitute the URL printed by Vite:
WEBDROP_URL=http://localhost:5173 npm run test:e2e
```

Backend integration tests exercise room isolation, sender spoof prevention, membership notifications, capability authentication, duplicate peer rejection, invalid IDs, application-payload rejection, and empty-room cleanup. Unit tests cover authenticated encryption, wrong keys, tampering, file metadata, buffer draining, and cancellation. Chromium tests establish actual peer connections, exchange chat, compare a downloaded binary file byte-for-byte, exercise empty files and cancellation, verify disk writes through an OPFS-backed save picker, check disconnect cleanup, and inspect mobile overflow. Local browser tests do not prove connectivity on every NAT, browser, or gigabyte workload.

### Build dependency advisories

The specified Tailwind 3 workflow currently pulls `braces@3.0.3`, which has a high-severity pattern-parsing advisory without a patched 3.x release in the registry used during implementation. `npm audit` reports five affected development-package entries through this dependency; production dependencies audit clean. A patched CSS selector parser is overridden in `package.json`. Do not build untrusted Tailwind source/configuration. Eliminating the remaining advisory requires migrating to Tailwind 4 and its different stylesheet pipeline; it is not silently suppressed here.

## Source layout

All requested source paths are implemented. Supporting files add the Vite HTML entry, PostCSS configuration, dependency lockfiles, example environment, protocol helpers, and executable tests. `useSignaling` owns socket lifetime; `useWebRTC` owns peer sessions; `fileProtocol` owns file consent, sending, receiving, and memory accounting; crypto and byte/buffer primitives live under `utils`; components own presentation and explicit user actions. No backend receives file bytes or chat text.
