import { ArrowUpRight } from "lucide-react";
export default function Brand() {
  return (
    <a className="brand" href="/" aria-label="WebDrop home">
      <div className="brand-icon">
        <ArrowUpRight size={25} />
      </div>
      <span>
        webdrop<span className="text-emerald-300">.</span>
      </span>
    </a>
  );
}
