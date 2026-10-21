export const generateRoomSalt = () =>
  crypto.getRandomValues(new Uint8Array(32));
export function createRoomID() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
const encode = (bytes) => btoa(String.fromCharCode(...bytes));
const decode = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
export const createSecret = () => encode(generateRoomSalt());
export async function importRoomKey(secret) {
  return crypto.subtle.importKey("raw", decode(secret), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function encryptPayload(key, payload) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return JSON.stringify({ iv: encode(iv), data: encode(new Uint8Array(data)) });
}
export async function decryptPayload(key, payload) {
  const { iv, data } = JSON.parse(payload);
  const result = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(iv) },
    key,
    decode(data),
  );
  return JSON.parse(new TextDecoder().decode(result));
}

export async function signalingToken(secret) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`webdrop-signaling:${secret}`),
  );
  return Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
