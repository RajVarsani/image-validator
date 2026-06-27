/**
 * Validation thresholds. Centralized so they are easy to tune and to document
 * in the writeup. Every rule's pass/fail is "measured value vs. one of these".
 */
export const THRESHOLDS = {
  /** Reject if min(width, height) is below this many pixels. */
  MIN_DIMENSION: 512,
  /** Reject tiny files (likely corrupt / not a real photo). */
  MIN_BYTES: 8 * 1024,
  /** Allowed input formats (verified by magic bytes, not the client). */
  ALLOWED_MIME: ["image/jpeg", "image/png", "image/heic", "image/heif"] as string[],
  /**
   * Variance-of-Laplacian below this = blurry. Computed on a grayscale image
   * normalized to a fixed width (so the threshold is resolution-independent).
   * Calibrated against the fixture suite.
   */
  BLUR_MIN_VARIANCE: 100,
  /** Width the image is resized to before the blur measurement. */
  BLUR_NORMALIZE_WIDTH: 800,
  /** Perceptual-hash Hamming distance <= this = duplicate. */
  PHASH_MAX_DISTANCE: 6,
  /** Largest face must cover at least this fraction of the image area. */
  FACE_MIN_RATIO: 0.12,
  /** Minimum confidence for a face detection to count. */
  FACE_MIN_CONFIDENCE: 0.5,
  /** Hard cap on decoded pixels (decompression-bomb guard). */
  MAX_INPUT_PIXELS: 40_000_000,
} as const;
