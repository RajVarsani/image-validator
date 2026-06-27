import { cn } from "../../../lib/utils.js";
import { Spinner } from "../../../components/ui/spinner.js";
import type { FilterTab, ImageStatus } from "../types.js";

interface Props {
  filter: FilterTab;
  onFilter: (f: FilterTab) => void;
  counts: Partial<Record<ImageStatus, number>>;
  onReplaceRejected?: () => void;
}

const TABS: { key: FilterTab; label: string; dot?: string; status?: ImageStatus }[] = [
  { key: "ALL", label: "All" },
  { key: "ACCEPTED", label: "Accepted", dot: "var(--color-success)", status: "ACCEPTED" },
  { key: "REJECTED", label: "Rejected", dot: "var(--color-warning)", status: "REJECTED" },
  { key: "PROCESSING", label: "Processing", status: "PROCESSING" },
];

export default function ResultsToolbar({ filter, onFilter, counts }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const processing = (counts.PROCESSING ?? 0) + (counts.PENDING ?? 0);

  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex items-center gap-1 rounded-button border border-border bg-surface p-1">
        {TABS.map((t) => {
          const n = t.key === "ALL" ? total : (counts[t.status!] ?? 0);
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onFilter(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-[7px] px-3.5 py-1.5 text-sm transition-colors",
                active ? "bg-surface-2 font-semibold text-ink" : "font-medium text-muted hover:text-ink",
              )}
            >
              {t.dot && <span className="size-[7px] rounded-full" style={{ background: t.dot }} />}
              {t.label}
              <span className="rounded-full bg-inset px-2 py-px text-xs font-semibold text-muted">{n}</span>
            </button>
          );
        })}
      </div>
      {processing > 0 && (
        <div className="flex items-center gap-2.5 text-sm text-muted">
          <Spinner size={15} />
          Validating {processing} {processing === 1 ? "image" : "images"}…
        </div>
      )}
    </div>
  );
}
