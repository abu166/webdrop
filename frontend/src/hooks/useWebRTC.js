import { useCallback, useEffect, useRef, useState } from "react";
import { decryptPayload, encryptPayload, importRoomKey } from "../utils/crypto";
import { createFileProtocol } from "../utils/fileProtocol";

export function useWebRTC({ peerID, name, secret, signal, notify }) {
  const connections = useRef(new Map());
  const key = useRef(null);
  const mounted = useRef(true);
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const config = useRef({ peerID, name, signal, notify });
  config.current = { peerID, name, signal, notify };
  useEffect(() => {
    key.current = secret ? importRoomKey(secret) : null;
  }, [secret]);
  const updatePeer = useCallback(
    (id, patch) =>
      setPeers((all) => all.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [],
  );
  const updateTransfer = useCallback((id, patch) => {
    if (mounted.current)
      setTransfers((all) =>
        all.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
  }, []);
  const control = async (p, payload) => {
    const encrypted = await encryptPayload(await key.current, payload);
    if (p.channel?.readyState !== "open") throw new Error("Peer disconnected");
    p.channel.send(encrypted);
  };
  const fileProtocol = useRef(null);
  if (!fileProtocol.current)
    fileProtocol.current = createFileProtocol({
      connections,
      control,
      config,
      setTransfers,
      updateTransfer,
    });
  const {
    failTransfers,
    receiveChunk,
    handleControl,
    acceptFile,
    cancelTransfer,
    sendFile,
  } = fileProtocol.current;
  const remove = useCallback(
    (id) => {
      const p = connections.current.get(id);
      if (!p) return;
      clearInterval(p.timer);
      failTransfers(p, "Peer disconnected");
      p.pc.close();
      connections.current.delete(id);
      setPeers((all) => all.filter((p) => p.id !== id));
    },
    [updateTransfer],
  );
  const reset = useCallback(() => {
    for (const id of connections.current.keys()) remove(id);
  }, [remove]);
  const process = async (p, data) => {
    if (typeof data !== "string") return receiveChunk(p, data);
    const msg = await decryptPayload(await key.current, data);
    switch (msg.type) {
      case "hello":
        updatePeer(p.id, {
          name: String(msg.name).slice(0, 40),
          state: "encrypted",
        });
        break;
      case "chat":
        if (typeof msg.text === "string" && msg.text.length <= 8000)
          setMessages((all) => [
            ...all.slice(-499),
            {
              id: crypto.randomUUID(),
              text: msg.text,
              name: p.name || p.id.slice(0, 8),
              peer: p.id,
              time: Date.now(),
            },
          ]);
        break;
      case "ping":
        await control(p, { type: "pong", sent: msg.sent });
        break;
      case "pong":
        updatePeer(p.id, {
          ping: Math.max(0, Math.round(performance.now() - msg.sent)),
        });
        break;
      default:
        if (typeof msg.type === "string" && msg.type.startsWith("file-"))
          await handleControl(p, msg);
        break;
    }
    if (msg.type === "hello") p.name = String(msg.name).slice(0, 40);
  };
  const attachChannel = (p, channel) => {
    if (p.channel) {
      channel.close();
      return;
    }
    p.channel = channel;
    channel.binaryType = "arraybuffer";
    p.queue = Promise.resolve();
    channel.onopen = () => {
      control(p, { type: "hello", name: config.current.name }).catch(() => {
        channel.close();
      });
      updatePeer(p.id, { state: "securing", channel: "open" });
      p.timer = setInterval(
        () =>
          control(p, { type: "ping", sent: performance.now() }).catch(() => {}),
        5000,
      );
      config.current.notify("A direct peer connection is ready");
    };
    channel.onmessage = (event) => {
      p.queue = p.queue
        .then(() => process(p, event.data))
        .catch((error) => {
          config.current.notify(`Peer protocol error: ${error.message}`);
          failTransfers(p, error.message);
          channel.close();
        });
    };
    channel.onclose = () => {
      clearInterval(p.timer);
      updatePeer(p.id, { state: "disconnected", channel: "closed" });
      failTransfers(p, "Data channel closed");
    };
    channel.onerror = () => config.current.notify("Data channel error");
  };
  const createPeer = (id) => {
    if (connections.current.has(id)) return connections.current.get(id);
    const extra = import.meta.env.VITE_ICE_SERVERS;
    const iceServers = extra
      ? JSON.parse(extra)
      : [{ urls: "stun:stun.l.google.com:19302" }];
    const pc = new RTCPeerConnection({ iceServers });
    const p = { id, pc, candidates: [] };
    connections.current.set(id, p);
    setPeers((all) => [
      ...all,
      { id, name: id.slice(0, 8), state: "connecting", channel: "waiting" },
    ]);
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        try {
          config.current.signal({
            type: "ice-candidate",
            to: id,
            candidate: event.candidate,
          });
        } catch {
          /* Reconnection rebuilds the peer graph. */
        }
      }
    };
    pc.ondatachannel = (event) => attachChannel(p, event.channel);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        updatePeer(id, { state: "failed" });
        failTransfers(p, "Connection failed; rejoin to retry");
      } else if (pc.connectionState === "disconnected")
        updatePeer(id, { state: "disconnected" });
    };
    return p;
  };
  const handleSignal = useCallback(
    async (msg) => {
      try {
        if (msg.type === "welcome") {
          for (const id of msg.peers) {
            const p = createPeer(id);
            attachChannel(
              p,
              p.pc.createDataChannel("webdrop", { ordered: true }),
            );
            await p.pc.setLocalDescription(await p.pc.createOffer());
            config.current.signal({
              type: "offer",
              to: id,
              description: p.pc.localDescription,
            });
          }
          return;
        }
        if (msg.type === "peer-left") {
          remove(msg.from);
          return;
        }
        if (msg.type === "peer-joined") return;
        if (!msg.from) return;
        const p = createPeer(msg.from);
        if (msg.type === "offer" || msg.type === "answer") {
          await p.pc.setRemoteDescription(msg.description);
          for (const c of p.candidates.splice(0)) await p.pc.addIceCandidate(c);
          if (msg.type === "offer") {
            await p.pc.setLocalDescription(await p.pc.createAnswer());
            config.current.signal({
              type: "answer",
              to: msg.from,
              description: p.pc.localDescription,
            });
          }
        } else if (msg.type === "ice-candidate") {
          if (p.pc.remoteDescription) await p.pc.addIceCandidate(msg.candidate);
          else p.candidates.push(msg.candidate);
        }
      } catch (error) {
        config.current.notify(`Connection error: ${error.message}`);
      }
    },
    [remove],
  );
  const sendChat = async (text) => {
    const ready = [...connections.current.values()].filter(
      (p) => p.channel?.readyState === "open",
    );
    if (!ready.length)
      throw new Error("Connect a peer before sending a message");
    await Promise.all(ready.map((p) => control(p, { type: "chat", text })));
    setMessages((all) => [
      ...all.slice(-499),
      {
        id: crypto.randomUUID(),
        text,
        name: config.current.name,
        peer: peerID,
        time: Date.now(),
        own: true,
      },
    ]);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      reset();
      fileProtocol.current.dispose();
    };
  }, [reset]);
  return {
    peers,
    messages,
    transfers,
    handleSignal,
    reset,
    sendChat,
    sendFile,
    acceptFile,
    cancelTransfer,
  };
}
