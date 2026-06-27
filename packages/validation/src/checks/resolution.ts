import { THRESHOLDS } from "../config.js";
import type { CheckResult } from "../types.js";

export function checkResolution(
  width: number | undefined,
  height: number | undefined,
  sizeBytes: number,
): CheckResult {
  const minEdge = Math.min(width ?? 0, height ?? 0);
  const okDim = minEdge >= THRESHOLDS.MIN_DIMENSION;
  const okBytes = sizeBytes >= THRESHOLDS.MIN_BYTES;
  const ok = okDim && okBytes;
  return {
    key: "resolution",
    ok,
    reason: ok ? undefined : "LOW_RESOLUTION",
    measured: minEdge,
    threshold: THRESHOLDS.MIN_DIMENSION,
    detail: ok
      ? `${width}×${height} (≥${THRESHOLDS.MIN_DIMENSION})`
      : !okDim
        ? `${width}×${height}, needs ≥${THRESHOLDS.MIN_DIMENSION}px on the short edge`
        : `file is only ${(sizeBytes / 1024).toFixed(0)}KB`,
  };
}
