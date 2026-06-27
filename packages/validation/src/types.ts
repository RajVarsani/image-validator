/** Reason codes, kept in sync with the Prisma `RejectionReason` enum. */
export type RejectionReason =
  | "LOW_RESOLUTION"
  | "UNSUPPORTED_FORMAT"
  | "DUPLICATE"
  | "BLURRY"
  | "FACE_TOO_SMALL"
  | "MULTIPLE_FACES"
  | "NO_FACE";

export type CheckKey =
  | "format"
  | "resolution"
  | "blur"
  | "duplicate"
  | "face";

export interface CheckResult {
  key: CheckKey;
  ok: boolean;
  /** Reason emitted when !ok. */
  reason?: RejectionReason;
  /** Human-readable "measured vs threshold" line for the UI. */
  detail: string;
  measured?: number;
  threshold?: number;
}

export interface Metrics {
  width?: number;
  height?: number;
  sizeBytes: number;
  mimeType?: string;
  blurScore?: number;
  perceptualHash?: bigint;
  faceCount?: number;
  faceSizeRatio?: number;
}

export interface ValidationResult {
  status: "accepted" | "rejected";
  reasons: RejectionReason[];
  checks: CheckResult[];
  metrics: Metrics;
  /** JPEG buffer to persist as the preview (HEIC converted, EXIF stripped). Null if undecodable. */
  normalized: Buffer | null;
  normalizedMime: "image/jpeg";
}

/** Lets the orchestrator look up duplicates without depending on the DB layer. */
export type DuplicateLookup = (
  phash: bigint,
) => Promise<{ id: string; distance: number } | null>;
