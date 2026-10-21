import { useCallback, useEffect, useRef, useState } from "react";
import Toast from "./components/ui/Toast";
import Lobby from "./components/room/Lobby";
import Workspace from "./components/room/Workspace";
import { createRoomID, createSecret, importRoomKey } from "./utils/crypto";
export default function App() {
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.slice(1));
  const [room, setRoom] = useState(() => params.get("room") || "");
  const [secret, setSecret] = useState(() => hash.get("key") || "");
  const [name, setName] = useState("");
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Set());
  const notify = useCallback((text) => {
    const id = crypto.randomUUID();
    setToasts((all) => [...all.slice(-3), { id, text }]);
    const timer = setTimeout(() => {
      setToasts((all) => all.filter((t) => t.id !== id));
      timers.current.delete(timer);
    }, 6000);
    timers.current.add(timer);
  }, []);
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
    },
    [],
  );
  const generate = () => {
    setRoom(createRoomID());
    setSecret(createSecret());
    setError("");
  };
  const join = async (event) => {
    event.preventDefault();
    try {
      if (!window.isSecureContext || !crypto.subtle)
        throw new Error(
          "Open WebDrop on HTTPS or localhost to use encryption.",
        );
      if (!/^[a-zA-Z0-9_-]{3,80}$/.test(room))
        throw new Error(
          "Use 3–80 letters, numbers, underscores, or dashes for the room ID.",
        );
      if (!name.trim()) throw new Error("Enter a display name.");
      let roomSecret = secret;
      if (!roomSecret) {
        roomSecret = createSecret();
        setSecret(roomSecret);
      }
      await importRoomKey(roomSecret);
      const url = new URL(location.href);
      url.search = new URLSearchParams({ room });
      url.hash = new URLSearchParams({ key: roomSecret }).toString();
      history.replaceState(null, "", url);
      setSession({
        roomID: room,
        peerID: crypto.randomUUID(),
        name: name.trim().slice(0, 40),
        secret: roomSecret,
      });
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      {session ? (
        <Workspace
          session={session}
          onLeave={() => {
            setSession(null);
            notify("You left the room. Session cleared.");
          }}
          notify={notify}
        />
      ) : (
        <Lobby
          room={room}
          secret={secret}
          name={name}
          error={error}
          setName={setName}
          setRoom={setRoom}
          setSecret={setSecret}
          generate={generate}
          join={join}
          isInvite={!!params.get("room")}
        />
      )}
      <Toast
        items={toasts}
        onDismiss={(id) => setToasts((all) => all.filter((t) => t.id !== id))}
      />
    </>
  );
}
