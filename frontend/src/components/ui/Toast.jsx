import { X, CheckCircle2 } from "lucide-react";
export default function Toast({ items, onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {items.map((item) => (
        <div className="toast glass-panel" key={item.id}>
          <CheckCircle2 size={18} className="text-emerald-300 shrink-0" />
          <span>{item.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => onDismiss(item.id)}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
