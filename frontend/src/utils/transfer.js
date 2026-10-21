export const CHUNK_SIZE = 16 * 1024;
export const MAX_MEMORY_FILE = 256 * 1024 * 1024;
export function waitForBuffer(channel, signal) {
  if (signal.aborted)
    return Promise.reject(new DOMException("Cancelled", "AbortError"));
  if (channel.readyState !== "open")
    return Promise.reject(new Error("Peer disconnected"));
  if (channel.bufferedAmount <= 64 * 1024) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      clearInterval(poll);
      channel.removeEventListener("bufferedamountlow", check);
      channel.removeEventListener("close", closed);
      signal.removeEventListener("abort", aborted);
    };
    const check = () => {
      if (channel.bufferedAmount <= 32 * 1024) {
        cleanup();
        resolve();
      }
    };
    const closed = () => {
      cleanup();
      reject(new Error("Peer disconnected"));
    };
    const aborted = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Transfer stalled"));
    }, 30000);
    const poll = setInterval(check, 100);
    channel.bufferedAmountLowThreshold = 32 * 1024;
    channel.addEventListener("bufferedamountlow", check);
    channel.addEventListener("close", closed);
    signal.addEventListener("abort", aborted);
    check();
  });
}
export function metrics(bytes, total, started) {
  const speed = bytes / Math.max((performance.now() - started) / 1000, 0.1);
  return {
    bytes,
    progress: total ? (bytes / total) * 100 : 100,
    speed,
    eta: speed ? (total - bytes) / speed : Infinity,
  };
}
export function validateOffer(value) {
  return (
    typeof value.id === "string" &&
    value.id.length <= 80 &&
    typeof value.name === "string" &&
    value.name.length <= 255 &&
    Number.isSafeInteger(value.size) &&
    value.size >= 0
  );
}
