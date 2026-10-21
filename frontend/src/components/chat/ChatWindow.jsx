import { useEffect, useRef } from "react";
import { MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import MessageInput from "./MessageInput";
function RichText({ text }) {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s]+)/g)
    .map((part, i) =>
      part.startsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : part.startsWith("`") ? (
        <code key={i}>{part.slice(1, -1)}</code>
      ) : /^https?:\/\//.test(part) ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-emerald-200"
        >
          {part}
        </a>
      ) : (
        part
      ),
    );
}
export default function ChatWindow({ messages, onSend, connected }) {
  const end = useRef(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);
  return (
    <div className="chat-window">
      <div className="panel-heading">
        <div>
          <MessageSquare size={18} />
          <h2>Room chat</h2>
          <span className="tiny-badge">LIVE</span>
        </div>
        <ShieldCheck size={17} className="text-emerald-300" />
      </div>
      <div className="messages" role="log" aria-label="Chat messages">
        {!messages.length ? (
          <div className="chat-empty">
            <div className="chat-art">
              <MessageSquare size={31} />
              <span>
                <Sparkles size={15} />
              </span>
            </div>
            <h3>A private space for your words.</h3>
            <p>
              Say hello, share an idea, send something good.
              <br />
              Your messages travel directly between devices.
            </p>
            <span className="encryption-tag">
              <ShieldCheck size={13} /> Encrypted in your browser. No stored
              chat history.
            </span>
          </div>
        ) : (
          messages.map((m) => (
            <div className={`message ${m.own ? "own" : ""}`} key={m.id}>
              <div className="message-meta">
                <span>{m.own ? "You" : m.name}</span>
                <time>
                  {new Date(m.time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <div className="bubble">
                <RichText text={m.text} />
              </div>
            </div>
          ))
        )}
        <div ref={end} />
      </div>
      <MessageInput onSend={onSend} disabled={!connected} />
    </div>
  );
}
