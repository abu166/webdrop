import {
  Download,
  File,
  X,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { formatBytes, formatSpeed, formatETA } from "../../utils/formatter";
export default function TransferProgress({
  transfers,
  onCancel,
  onAccept,
  compact = false,
}) {
  return (
    <div className={compact ? "transfer-list compact" : "transfer-list"}>
      {!transfers.length ? (
        <div className="transfer-empty">
          <File size={20} />
          <span>
            No transfers yet.
            <br />
            <small>Your next great exchange starts here.</small>
          </span>
        </div>
      ) : (
        transfers.map((t) => (
          <div className="transfer" key={t.id}>
            <div className="transfer-top">
              <div className="file-icon">
                {t.direction === "incoming" ? (
                  <ArrowDownLeft size={17} />
                ) : (
                  <ArrowUpRight size={17} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <strong className="truncate block">{t.name}</strong>
                <small>
                  {formatBytes(t.size)} ·{" "}
                  {t.direction === "incoming" ? "Receiving" : "Sending"}
                </small>
              </div>
              {t.status === "complete" ? (
                <Check size={17} className="text-emerald-300" />
              ) : (
                !["failed", "cancelled"].includes(t.status) && (
                  <button
                    aria-label={`Cancel ${t.name}`}
                    onClick={() => onCancel(t.id)}
                  >
                    <X size={15} />
                  </button>
                )
              )}
            </div>
            {["sending", "receiving"].includes(t.status) && (
              <>
                <progress
                  max="100"
                  value={t.progress || 0}
                  aria-label={`${t.name} progress`}
                />
                <div className="transfer-metrics">
                  <span>
                    {formatSpeed(t.speed)} · {formatETA(t.eta)}
                  </span>
                  <span>{Math.floor(t.progress || 0)}%</span>
                </div>
              </>
            )}
            {t.status === "pending" && t.direction === "incoming" ? (
              <div className="transfer-actions">
                {t.size <= 256 * 1024 * 1024 && (
                  <button
                    className="secondary-button"
                    onClick={() => onAccept(t.id)}
                  >
                    Accept file
                  </button>
                )}
                {"showSaveFilePicker" in window && (
                  <button
                    className="primary-button"
                    onClick={() => onAccept(t.id, true)}
                  >
                    Save to disk
                  </button>
                )}
                {t.size > 256 * 1024 * 1024 &&
                  !("showSaveFilePicker" in window) && (
                    <small className="text-amber-200">
                      Use Chrome or Edge to receive files over 256 MB.
                    </small>
                  )}
              </div>
            ) : (
              <small
                className={t.status === "failed" ? "text-red-300" : "muted"}
              >
                {t.status === "pending"
                  ? "Waiting for recipient…"
                  : t.status === "failed"
                    ? t.error || "failed"
                    : t.status}
                {t.saved ? " · Saved to disk" : ""}
              </small>
            )}
            {t.url && (
              <a href={t.url} download={t.name} className="download-button">
                <Download size={14} /> Download file
              </a>
            )}
          </div>
        ))
      )}
    </div>
  );
}
