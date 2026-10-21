export function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const i = Math.min(
    Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024)),
    4,
  );
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${["B", "KB", "MB", "GB", "TB"][i]}`;
}
export const formatSpeed = (value) => `${formatBytes(value)}/s`;
export const formatETA = (seconds) =>
  !Number.isFinite(seconds)
    ? "Calculating…"
    : seconds < 60
      ? `${Math.ceil(seconds)}s left`
      : `${Math.ceil(seconds / 60)}m left`;
