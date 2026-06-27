import { Check, Flag } from "lucide-react";
import { Spinner } from "../../../../components/ui/spinner.js";
import { fileMeta, primaryRejection, REASON_LABEL } from "../../utils.js";
import type { ImageDto } from "../../types.js";

export default function ImageCard({ image, onClick }: { image: ImageDto; onClick: () => void }) {
  const processing = image.status === "PROCESSING" || image.status === "PENDING";
  const rejected = image.status === "REJECTED" || image.status === "FAILED";
  const rej = primaryRejection(image);

  return (
    <button
      onClick={onClick}
      className="flex w-[320px] flex-col gap-2.5 rounded-card border border-border bg-surface p-2 text-left transition-colors hover:border-border-strong"
    >
      <div className="relative h-[218px] overflow-hidden rounded-md border border-border bg-inset">
        {processing ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Spinner size={22} />
            <span className="text-[13px] text-faint">Validating…</span>
          </div>
        ) : (
          <>
            {image.previewUrl && (
              <img
                src={image.previewUrl}
                alt={image.originalFilename}
                className="h-full w-full object-cover"
                style={rejected ? { opacity: 0.5 } : undefined}
              />
            )}
            <div
              className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ background: "rgba(10,10,11,0.7)" }}
            >
              {rejected ? (
                <Flag size={11} style={{ color: "var(--color-warning)" }} />
              ) : (
                <Check size={12} style={{ color: "var(--color-success)" }} />
              )}
              <span className="text-xs font-semibold text-white">
                {rejected ? "Rejected" : "Accepted"}
              </span>
            </div>
          </>
        )}
      </div>
      <div className="flex flex-col gap-2 px-1 pb-1 pt-0.5">
        <span className="truncate text-sm font-semibold text-ink">{image.originalFilename}</span>
        {processing ? (
          <span className="text-xs text-faint">In the queue…</span>
        ) : rejected && rej ? (
          <span
            className="flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
            style={{ background: "var(--color-warning-dim)", color: "var(--color-warning)" }}
          >
            {REASON_LABEL[rej.reason]}
            {rej.detail && shortDetail(rej.detail) ? `: ${shortDetail(rej.detail)}` : ""}
          </span>
        ) : (
          <span className="text-xs text-muted">{fileMeta(image)}</span>
        )}
      </div>
    </button>
  );
}

function shortDetail(d: string): string {
  // pull a compact "n / m" or percentage out of the backend detail string
  const m = d.match(/(\d+%?\s*[<≥]\s*\d+%?|\d+\s*\/\s*\d+|\d+%)/);
  return m ? m[0].replace(/\s+/g, " ") : "";
}
