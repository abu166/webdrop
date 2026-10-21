import { useRef, useState } from "react";
import { Upload, ArrowUpRight, File, X } from "lucide-react";
import { formatBytes } from "../../utils/formatter";
export default function DropZone({ peers, onSend, notify }) {
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState(null);
  const [target, setTarget] = useState("");
  const ready = peers.filter((p) => p.state === "encrypted");
  const choose = (files) => {
    if (files?.length) setFile(files[0]);
  };
  const send = async () => {
    try {
      await onSend(file, target || ready[0]?.id);
      setFile(null);
    } catch (error) {
      notify(error.message);
    }
  };
  return (
    <div className="drop-section">
      <div className="panel-heading">
        <div>
          <Upload size={18} />
          <h2>File drop</h2>
        </div>
        <span className="muted text-xs">DIRECT TRANSFER</span>
      </div>
      <div
        className={`drop-zone ${drag ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          choose(e.dataTransfer.files);
        }}
      >
        <div className="upload-icon">
          <Upload size={26} />
          <span>+</span>
        </div>
        <h3>Big files. Small effort.</h3>
        <p>Drop a file here to send it directly.</p>
        <button
          className="secondary-button"
          onClick={() => input.current.click()}
        >
          Choose a file <ArrowUpRight size={15} />
        </button>
        <input
          type="file"
          ref={input}
          className="sr-only"
          aria-label="Choose file to send"
          onChange={(e) => {
            choose(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="drop-footnote">Any file type · No cloud upload</div>
      </div>
      {file && (
        <div className="file-preview">
          <File size={20} />
          <div className="flex-1 min-w-0">
            <strong className="truncate block">{file.name}</strong>
            <small>{formatBytes(file.size)}</small>
          </div>
          <button
            aria-label="Remove selected file"
            onClick={() => setFile(null)}
          >
            <X size={15} />
          </button>
          <select
            aria-label="Recipient"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">{ready[0]?.name || "Waiting for a peer"}</option>
            {ready.slice(1).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            className="primary-button"
            disabled={!ready.length}
            onClick={send}
          >
            Send file
          </button>
        </div>
      )}
      <div className="file-privacy">
        <span className="status-dot" /> Your files take the shortest route.
        Device to device.
      </div>
    </div>
  );
}
