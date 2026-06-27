import sharp from "sharp";
import { THRESHOLDS } from "../config.js";
import type { CheckResult } from "../types.js";

// 8-neighbour Laplacian: the classic focus operator.
const LAPLACIAN = { width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] };

/**
 * Variance of the Laplacian. NOTE: sharp's `.stats()` ignores piped operations,
 * so we render the convolved pixels with `.raw()` and compute the variance by
 * hand. Normalized to a fixed width so the threshold is resolution-independent.
 * Higher = sharper. (Sharp photos score ~200-800 here; blurry ones < ~15.)
 */
export async function blurScore(buffer: Buffer): Promise<number> {
  const { data } = await sharp(buffer)
    .greyscale()
    .resize({ width: THRESHOLDS.BLUR_NORMALIZE_WIDTH, withoutEnlargement: true })
    .convolve(LAPLACIAN)
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i]!;
    sumSq += data[i]! * data[i]!;
  }
  const n = data.length || 1;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function blurCheck(score: number): CheckResult {
  const ok = score >= THRESHOLDS.BLUR_MIN_VARIANCE;
  return {
    key: "blur",
    ok,
    reason: ok ? undefined : "BLURRY",
    measured: Math.round(score),
    threshold: THRESHOLDS.BLUR_MIN_VARIANCE,
    detail: ok
      ? `sharp (${Math.round(score)} ≥ ${THRESHOLDS.BLUR_MIN_VARIANCE})`
      : `too soft (${Math.round(score)} < ${THRESHOLDS.BLUR_MIN_VARIANCE})`,
  };
}
