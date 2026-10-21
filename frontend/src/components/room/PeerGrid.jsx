import { LockKeyhole, Radio, Monitor, Users } from "lucide-react";
export default function PeerGrid({ peers, name }) {
  return (
    <div className="peer-list">
      <div className="section-label">
        <span>IN THIS ROOM</span>
        <span>{peers.length + 1} / 16</span>
      </div>
      <div className="peer">
        <div className="avatar self">
          <Monitor size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <strong>
            {name} <span className="muted text-xs">(you)</span>
          </strong>
          <small>
            <span className="status-dot" /> Ready to connect
          </small>
        </div>
        <LockKeyhole size={14} className="text-emerald-300" />
      </div>
      {peers.map((p) => (
        <div className="peer" key={p.id}>
          <div className="avatar">
            <Users size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="truncate block">{p.name}</strong>
            <small>
              <span
                className={`status-dot ${p.state === "encrypted" ? "" : "waiting"}`}
              />
              {p.state === "encrypted" ? "P2P connected · Encrypted" : p.state}
            </small>
            <small>
              Channel {p.channel}
              {p.ping != null ? ` · ${p.ping} ms` : ""}
            </small>
          </div>
          {p.state === "encrypted" ? (
            <LockKeyhole size={14} className="text-emerald-300" />
          ) : (
            <Radio size={14} className="muted" />
          )}
        </div>
      ))}
      {!peers.length && (
        <div className="peer-empty">
          <div className="dotted-orbit">
            <Users size={22} />
          </div>
          <p>Good things are better shared.</p>
          <span>Invite someone to start a direct connection.</span>
        </div>
      )}
    </div>
  );
}
