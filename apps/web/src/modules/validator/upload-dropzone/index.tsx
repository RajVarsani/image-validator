import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { cn } from "../../../lib/utils.js";
import { passesClientGate } from "../utils.js";
import type { SkippedFile } from "../types.js";

interface Props {
  onUpload: (files: File[]) => void;
  isUploading: boolean;
}

export default function UploadDropzone({ onUpload, isUploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [skipped, setSkipped] = useState<SkippedFile[]>([]);

  function handle(list: FileList | null) {
    if (!list) return;
    const ok: File[] = [];
    const bad: SkippedFile[] = [];
    for (const f of Array.from(list)) {
      if (passesClientGate(f)) ok.push(f);
      else bad.push({ name: f.name, reason: "Only JPG, PNG, HEIC" });
    }
    setSkipped(bad);
    if (ok.length) onUpload(ok);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files);
        }}
        className={cn(
          "flex items-center justify-between gap-8 rounded-card border bg-surface px-8 py-7 transition-colors",
          drag ? "border-border-strong bg-surface-2" : "border-border",
        )}
      >
        <div className="flex items-center gap-5">
          <div className="flex size-[54px] shrink-0 items-center justify-center rounded-md border border-border bg-inset">
            <Upload size={22} className="text-ink" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[19px] font-bold tracking-tight text-ink">
              Drop photos here, or browse
            </span>
            <span className="text-sm text-muted">
              JPG, PNG or HEIC · up to 10MB each · up to 100 photos · checked before upload
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {["JPG", "PNG", "HEIC"].map((t) => (
            <span
              key={t}
              className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-muted"
            >
              {t}
            </span>
          ))}
          <Button size="lg" loading={isUploading} onClick={() => inputRef.current?.click()}>
            {isUploading ? "Uploading…" : "Browse files"}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
          hidden
          onChange={(e) => handle(e.target.files)}
        />
      </div>

      {skipped.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-4 py-3">
          <span className="text-sm font-semibold text-ink">Couldn't add ({skipped.length}):</span>
          {skipped.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-sm text-muted">
              <X size={13} className="text-warning" /> {s.name}: {s.reason}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
