import { Check, X, Flag } from "lucide-react";
import type { ImageDto, RejectionReason } from "../types.js";

interface Row {
  label: string;
  ok: boolean;
  value: string;
  fix?: string;
}

function buildRows(img: ImageDto): Row[] {
  const has = (r: RejectionReason) => img.rejections.find((x) => x.reason === r);
  const detailOf = (r: RejectionReason, fallback: string) => has(r)?.detail ?? fallback;
  return [
    { label: "Minimum resolution", ok: !has("LOW_RESOLUTION"), value: img.width ? `${img.width}×${img.height}` : "N/A" },
    { label: "Allowed format", ok: !has("UNSUPPORTED_FORMAT"), value: img.mimeType },
    { label: "Sharpness", ok: !has("BLURRY"), value: img.blurScore != null ? `${Math.round(img.blurScore)}` : "N/A" },
    { label: "Not a duplicate", ok: !has("DUPLICATE"), value: has("DUPLICATE") ? detailOf("DUPLICATE", "match") : "unique" },
    {
      label: "Single face",
      ok: !has("MULTIPLE_FACES") && !has("NO_FACE"),
      value: img.faceCount != null ? `${img.faceCount} detected` : "N/A",
    },
    {
      label: "Face large enough",
      ok: !has("FACE_TOO_SMALL"),
      value: img.faceSizeRatio != null ? `${(img.faceSizeRatio * 100).toFixed(0)}%` : "N/A",
      fix: "Recrop closer or replace this photo.",
    },
  ];
}

export default function ImageDetail({ image, onClose }: { image: ImageDto; onClose: () => void }) {
  const rejected = image.status === "REJECTED" || image.status === "FAILED";
  const rows = buildRows(image);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative flex h-full w-[460px] flex-col overflow-y-auto border-l border-border bg-bg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-bold tracking-tight text-ink">{image.originalFilename}</span>
            <span className="text-xs text-faint">
              {image.mimeType} · {image.width}×{image.height}
              {image.sizeBytes ? ` · ${(image.sizeBytes / 1024 / 1024).toFixed(1)}MB` : ""}
            </span>
          </div>
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold"
            style={{
              background: rejected ? "var(--color-warning-dim)" : "var(--color-success-dim)",
              color: rejected ? "var(--color-warning)" : "var(--color-success)",
            }}
          >
            {rejected ? <Flag size={11} /> : <Check size={12} />}
            {rejected ? "Rejected" : "Accepted"}
          </span>
        </div>

        {image.previewUrl && (
          <div className="px-5 pt-5">
            <div className="h-[260px] overflow-hidden rounded-md border border-border bg-inset">
              <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 p-5">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex flex-col gap-2.5 rounded-[11px] border p-3.5"
              style={
                r.ok
                  ? { borderColor: "var(--color-border)" }
                  : { borderColor: "var(--color-warning)", background: "var(--color-warning-dim)" }
              }
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: r.ok ? "var(--color-success-dim)" : "rgba(216,165,60,0.18)" }}
                >
                  {r.ok ? (
                    <Check size={11} style={{ color: "var(--color-success)" }} />
                  ) : (
                    <X size={10} style={{ color: "var(--color-warning)" }} />
                  )}
                </span>
                <span className="flex-1 text-sm font-medium text-ink">{r.label}</span>
                <span
                  className="text-[13px]"
                  style={{ color: r.ok ? "var(--color-faint)" : "var(--color-warning)" }}
                >
                  {r.value}
                </span>
              </div>
              {!r.ok && r.fix && (
                <span className="pl-8 text-[13px] leading-5 text-muted">{r.fix}</span>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
