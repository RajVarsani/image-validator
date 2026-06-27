import sharp from "sharp";
import { THRESHOLDS } from "./config.js";
import { checkFormat } from "./checks/format.js";
import { isHeic, heicToJpeg } from "./checks/heic.js";
import { checkResolution } from "./checks/resolution.js";
import { blurScore, blurCheck } from "./checks/blur.js";
import { perceptualHash } from "./checks/phash.js";
import { detectFaces, faceCheck } from "./checks/face.js";
import type {
  CheckResult,
  DuplicateLookup,
  Metrics,
  RejectionReason,
  ValidationResult,
} from "./types.js";

export interface ValidateOptions {
  /** Optional dedup lookup: given the pHash, return the nearest match (or null). */
  duplicateLookup?: DuplicateLookup;
}

/**
 * Run all six validation rules against an image buffer. Pure: no DB, no S3, no
 * Kafka, which is exactly what makes it unit-testable against the fixture suite.
 */
export async function validateImage(
  buffer: Buffer,
  opts: ValidateOptions = {},
): Promise<ValidationResult> {
  const checks: CheckResult[] = [];
  const metrics: Metrics = { sizeBytes: buffer.length };

  // 1. Format: magic bytes, not the client's claim.
  const fmt = await checkFormat(buffer);
  metrics.mimeType = fmt.mime;
  checks.push(fmt.check);
  if (!fmt.check.ok) return finalize(checks, metrics, null);

  // 2. Decode (HEIC -> JPEG first) and normalize to a clean JPEG (strips EXIF).
  let decodable = buffer;
  try {
    if (isHeic(buffer)) decodable = await heicToJpeg(buffer);
  } catch {
    checks.push({ key: "format", ok: false, reason: "UNSUPPORTED_FORMAT", detail: "HEIC decode failed" });
    return finalize(checks, metrics, null);
  }

  let normalized: Buffer;
  try {
    const img = sharp(decodable, {
      limitInputPixels: THRESHOLDS.MAX_INPUT_PIXELS,
      failOn: "error",
    }).rotate();
    const meta = await img.metadata();
    metrics.width = meta.width;
    metrics.height = meta.height;
    normalized = await img.jpeg({ quality: 88 }).toBuffer();
  } catch {
    checks.push({ key: "format", ok: false, reason: "UNSUPPORTED_FORMAT", detail: "could not decode image" });
    return finalize(checks, metrics, null);
  }

  // 3. Resolution.
  checks.push(checkResolution(metrics.width, metrics.height, metrics.sizeBytes));

  // 4. Blur.
  const score = await blurScore(normalized);
  metrics.blurScore = score;
  checks.push(blurCheck(score));

  // 5. Perceptual hash + duplicate.
  const ph = await perceptualHash(normalized);
  metrics.perceptualHash = ph;
  if (opts.duplicateLookup) {
    const dup = await opts.duplicateLookup(ph);
    checks.push({
      key: "duplicate",
      ok: !dup,
      reason: dup ? "DUPLICATE" : undefined,
      measured: dup?.distance,
      threshold: THRESHOLDS.PHASH_MAX_DISTANCE,
      detail: dup ? `matches an existing image (distance ${dup.distance})` : "unique",
    });
  }

  // 6. Face: count + size.
  const { faces, imageArea } = await detectFaces(normalized);
  metrics.faceCount = faces.length;
  const fc = faceCheck(faces, imageArea);
  metrics.faceSizeRatio = fc.ratio;
  checks.push(fc.check);

  return finalize(checks, metrics, normalized);
}

function finalize(
  checks: CheckResult[],
  metrics: Metrics,
  normalized: Buffer | null,
): ValidationResult {
  const reasons = checks
    .filter((c) => !c.ok && c.reason)
    .map((c) => c.reason!) as RejectionReason[];
  return {
    status: reasons.length ? "rejected" : "accepted",
    reasons: [...new Set(reasons)],
    checks,
    metrics,
    normalized,
    normalizedMime: "image/jpeg",
  };
}
