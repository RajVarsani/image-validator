export type ImageStatus = "PENDING" | "PROCESSING" | "ACCEPTED" | "REJECTED" | "FAILED";

export type RejectionReason =
  | "LOW_RESOLUTION"
  | "UNSUPPORTED_FORMAT"
  | "DUPLICATE"
  | "BLURRY"
  | "FACE_TOO_SMALL"
  | "MULTIPLE_FACES"
  | "NO_FACE";

export interface Rejection {
  reason: RejectionReason;
  detail?: string;
  measured?: number | null;
  threshold?: number | null;
}

export interface ImageDto {
  id: string;
  sessionId: string;
  originalFilename: string;
  mimeType: string;
  status: ImageStatus;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
  blurScore?: number | null;
  faceCount?: number | null;
  faceSizeRatio?: number | null;
  durationMs?: number | null;
  createdAt: string;
  previewUrl?: string | null;
  rejections: Rejection[];
}

export interface ImagesResponse {
  images: ImageDto[];
  counts: Partial<Record<ImageStatus, number>>;
}

export type FilterTab = "ALL" | "ACCEPTED" | "REJECTED" | "PROCESSING";

/** A file rejected by the client-side gate before it ever uploads. */
export interface SkippedFile {
  name: string;
  reason: string;
}
