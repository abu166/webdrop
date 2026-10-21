import { useRef, useState } from "react";
import {
  ArrowUpRight,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  LockKeyhole,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Link2,
} from "lucide-react";
import GlassCard from "../ui/GlassCard";
import Brand from "../ui/Brand";
import PeerGrid from "./PeerGrid";
import ChatWindow from "../chat/ChatWindow";
import DropZone from "../filedrop/DropZone";
import TransferProgress from "../filedrop/TransferProgress";
import { useSignaling } from "../../hooks/useSignaling";
import { useWebRTC } from "../../hooks/useWebRTC";
export default function Workspace({ session, onLeave, notify }) {
  const signalRef = useRef(() => {});
  const handlers = useRef({});
  const [sidebar, setSidebar] = useState(true);
  const [copied, setCopied] = useState(false);
  const rtc = useWebRTC({
    ...session,
    signal: (payload) => signalRef.current(payload),
    notify,
  });
  handlers.current = rtc;
  const signaling = useSignaling({
    roomID: session.roomID,
    peerID: session.peerID,
    secret: session.secret,
    onMessage: (msg) => handlers.current.handleSignal(msg),
    onReset: () => handlers.current.reset(),
    onError: notify,
  });
  signalRef.current = signaling.sendMessage;
  const invite = async () => {
    try {
      const url = new URL(location.href);
      url.search = new URLSearchParams({ room: session.roomID });
      url.hash = new URLSearchParams({ key: session.secret }).toString();
      await navigator.clipboard.writeText(url.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("Clipboard unavailable. Copy the room URL from your browser.");
    }
  };
  const connected = rtc.peers.some((p) => p.state === "encrypted");
  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="header-right">
          <span className="network-status">
            <span
              className={`status-dot ${signaling.isConnected ? "" : "waiting"}`}
            />
            {signaling.isConnected ? "Signaling connected" : "Reconnecting…"}
          </span>
          <button
            className="icon-button"
            aria-label="Leave room"
            onClick={onLeave}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="workspace">
        <div className="workspace-title">
          <div>
            <div className="eyebrow">
              <span className="status-dot" /> YOUR PRIVATE CORNER OF THE
              INTERNET
            </div>
            <h1>
              Make room for connection<span>.</span>
            </h1>
            <p>A shared space. A direct connection. Just your people.</p>
          </div>
          <button className="primary-button" onClick={invite}>
            {copied ? <Check size={16} /> : <Link2 size={16} />}{" "}
            {copied ? "Invite copied" : "Invite someone"}
            <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="room-toolbar">
          <div className="flex items-center gap-3">
            <button
              className="icon-button"
              aria-label="Toggle sidebar"
              aria-expanded={sidebar}
              onClick={() => setSidebar(!sidebar)}
            >
              {sidebar ? (
                <PanelLeftClose size={17} />
              ) : (
                <PanelLeftOpen size={17} />
              )}
            </button>
            <span className="muted">Room</span>
            <code>{session.roomID}</code>
            <button
              className="icon-button"
              aria-label="Copy invite link"
              onClick={invite}
            >
              <Copy size={14} />
            </button>
          </div>
          <span className="secure-label">
            <ShieldCheck size={14} /> End-to-end encrypted
          </span>
        </div>
        <div className={`workspace-grid ${sidebar ? "" : "sidebar-hidden"}`}>
          {sidebar && (
            <GlassCard className="sidebar">
              <PeerGrid peers={rtc.peers} name={session.name} />
              <div className="sidebar-divider" />
              <div className="section-label">
                <span>TRANSFER HISTORY</span>
                <span>{rtc.transfers.length.toString().padStart(2, "0")}</span>
              </div>
              <TransferProgress
                transfers={rtc.transfers}
                onCancel={rtc.cancelTransfer}
                onAccept={rtc.acceptFile}
                compact
              />
              <div className="sidebar-tip">
                <LockKeyhole size={18} />
                <strong>What happens here, stays here.</strong>
                <p>
                  Your chat and files never touch our servers. Leaving clears
                  this session.
                </p>
              </div>
            </GlassCard>
          )}
          <GlassCard className="chat-panel">
            <ChatWindow
              messages={rtc.messages}
              onSend={rtc.sendChat}
              connected={connected}
            />
          </GlassCard>
          <div className="right-column">
            <GlassCard>
              <DropZone
                peers={rtc.peers}
                onSend={rtc.sendFile}
                notify={notify}
              />
            </GlassCard>
            <GlassCard className="connection-card">
              <div className="connection-symbol">
                <Zap size={21} />
              </div>
              <div>
                <h3>Less distance. More possibility.</h3>
                <p>
                  Powered by WebRTC. Files move directly between browsers,
                  encrypted in transit.
                </p>
              </div>
              <div className="connection-route">
                <span>You</span>
                <i />
                <LockKeyhole size={13} />
                <i />
                <span>Your peer</span>
              </div>
            </GlassCard>
          </div>
        </div>
      </main>
      <footer>
        <span>Built for the moments worth sharing.</span>
        <span>
          <span className="status-dot" /> Peer to peer. Human to human.
        </span>
      </footer>
    </div>
  );
}
