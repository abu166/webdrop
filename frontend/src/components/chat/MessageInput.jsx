import { useState } from "react";
import { ArrowUp, LockKeyhole } from "lucide-react";
export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await onSend(text.trim());
      setText("");
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="message-form">
      <div className="composer">
        <textarea
          rows={1}
          aria-label="Message"
          maxLength={8000}
          placeholder={
            disabled
              ? "Your conversation starts when a peer joins…"
              : "Write a message…"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
        />
        <button
          className="send-button"
          aria-label="Send message"
          disabled={disabled || !text.trim() || busy}
        >
          <ArrowUp size={20} />
        </button>
      </div>
      <div className="composer-note">
        <span>
          <LockKeyhole size={11} /> End-to-end encrypted. Just between you.
        </span>
        <span>↵ to send</span>
      </div>
      {error && (
        <p role="alert" className="text-red-300 text-xs mt-2">
          {error}
        </p>
      )}
    </form>
  );
}
