import { useCallback, useEffect, useRef, useState } from "react";
import { signalingToken } from "../utils/crypto";
export function useSignaling({
  roomID,
  peerID,
  secret,
  onMessage,
  onReset,
  onError,
}) {
  const [isConnected, setConnected] = useState(false);
  const socket = useRef(null);
  const callbacks = useRef({ onMessage, onReset, onError });
  callbacks.current = { onMessage, onReset, onError };
  useEffect(() => {
    if (!roomID) return;
    let stopped = false,
      timer,
      attempt = 0;
    const connect = async () => {
      let auth;
      try {
        auth = await signalingToken(secret);
      } catch {
        callbacks.current.onError?.("Unable to initialize room authentication");
        return;
      }
      if (stopped) return;
      let ws;
      try {
        const endpoint = new URL(
          import.meta.env.VITE_SIGNALING_URL || "/ws",
          location.href,
        );
        endpoint.protocol =
          endpoint.protocol === "https:" || endpoint.protocol === "wss:"
            ? "wss:"
            : "ws:";
        endpoint.search = new URLSearchParams({
          room: roomID,
          peer: peerID,
          auth,
        });
        ws = new WebSocket(endpoint);
      } catch {
        callbacks.current.onError?.(
          "The signaling URL is invalid or unavailable",
        );
        return;
      }
      socket.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (event) => {
        try {
          callbacks.current.onMessage?.(JSON.parse(event.data));
        } catch {
          callbacks.current.onError?.("Invalid signaling message");
        }
      };
      ws.onerror = () => ws.close();
      ws.onclose = (event) => {
        if (stopped) return;
        setConnected(false);
        callbacks.current.onReset?.();
        if (event.code === 1008) {
          callbacks.current.onError?.(event.reason);
          return;
        }
        timer = setTimeout(
          connect,
          Math.min(30000, 500 * 2 ** attempt++) + Math.random() * 400,
        );
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket.current?.close();
      setConnected(false);
    };
  }, [roomID, peerID, secret]);
  const sendMessage = useCallback((payload) => {
    if (socket.current?.readyState !== WebSocket.OPEN)
      throw new Error("Signaling is reconnecting");
    socket.current.send(JSON.stringify(payload));
  }, []);
  return { sendMessage, roomID, isConnected };
}
