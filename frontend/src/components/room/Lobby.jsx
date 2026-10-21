import {
  ArrowUpRight,
  ArrowRight,
  Shuffle,
  ShieldCheck,
  Zap,
  Globe2,
  LockKeyhole,
  Radio,
} from "lucide-react";
import GlassCard from "../ui/GlassCard";
import Brand from "../ui/Brand";
export default function Lobby({
  room,
  secret,
  name,
  error,
  setName,
  setRoom,
  setSecret,
  generate,
  join,
  isInvite,
}) {
  return (
    <div className="landing">
      <header className="topbar">
        <Brand />
        <span className="landing-header-note">
          <span className="status-dot" /> A more direct way to share
        </span>
      </header>
      <main className="lobby">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="pill-dot" /> PRIVATE BY DESIGN. CONNECTED BY YOU.
          </div>
          <h1>
            A little closer.
            <br />A lot more <span>connected.</span>
          </h1>
          <p>
            Send the big stuff. Share the little things.
            <br />
            Your private room for encrypted chat and direct file sharing — no
            uploads, no accounts, no fuss.
          </p>
          <div className="hero-features">
            <span>
              <ShieldCheck size={17} /> End-to-end encrypted
            </span>
            <span>
              <Zap size={17} /> Peer-to-peer fast
            </span>
            <span>
              <Globe2 size={17} /> Anywhere, together
            </span>
          </div>
          <div className="hero-bottom">
            <div className="mini-avatars">
              <span>A</span>
              <span>B</span>
              <span>
                <ArrowUpRight size={15} />
              </span>
            </div>
            <p>
              From your device to theirs.
              <br />
              <strong>That’s the whole journey.</strong>
            </p>
          </div>
        </div>
        <GlassCard className="lobby-card" glow>
          <div className="room-card-icon">
            <Radio size={25} />
            <span className="status-dot" />
          </div>
          <div className="eyebrow">ONE LINK. YOUR PEOPLE.</div>
          <h2>Your room is waiting.</h2>
          <p>Create a space or join one you’ve been invited to.</p>
          <form onSubmit={join}>
            <label htmlFor="display-name">What should we call you?</label>
            <input
              id="display-name"
              className="glass-input"
              autoComplete="nickname"
              placeholder="Your display name"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="label-row">
              <label htmlFor="room-id">Room ID</label>
              <button type="button" onClick={generate}>
                <Shuffle size={13} /> Generate new
              </button>
            </div>
            <input
              id="room-id"
              className="glass-input font-mono"
              placeholder="e.g. studio-after-hours"
              value={room}
              onChange={(e) => {
                setRoom(e.target.value);
                setSecret("");
              }}
              required
              minLength={3}
              maxLength={80}
            />
            {!secret && room && (
              <p className="input-hint">
                Joining an existing room? Open its full invite link to use the
                same encryption key.
              </p>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="primary-button join-button" type="submit">
              {isInvite ? "Join the room" : "Step into your room"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="lobby-card-footer">
            <LockKeyhole size={13} /> No sign-up. No cloud storage. Just
            connection.
          </div>
        </GlassCard>
      </main>
      <footer>
        <span>© {new Date().getFullYear()} WebDrop</span>
        <span>
          <LockKeyhole size={12} /> Your data belongs to you. Always.
        </span>
        <span>Made for sharing, built for privacy.</span>
      </footer>
    </div>
  );
}
