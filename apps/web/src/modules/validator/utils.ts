import type { ImageDto, RejectionReason } from "./types.js";

/** Non-accusatory labels for each rule (plain language). */
export const REASON_LABEL: Record<RejectionReason, string> = {
  LOW_RESOLUTION: "Too small",
  UNSUPPORTED_FORMAT: "Unsupported format",
  DUPLICATE: "Looks like a duplicate",
  BLURRY: "A little blurry",
  FACE_TOO_SMALL: "Face too small",
  MULTIPLE_FACES: "More than one face",
  NO_FACE: "No face found",
};

export const ALLOWED_CLIENT_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"];
export const ALLOWED_CLIENT_EXT = [".jpg", ".jpeg", ".png", ".heic", ".heif"];

/** Client-side format gate (browsers sometimes report empty type for HEIC). */
export function passesClientGate(file: File): boolean {
  if (file.type && ALLOWED_CLIENT_TYPES.includes(file.type)) return true;
  const lower = file.name.toLowerCase();
  return ALLOWED_CLIENT_EXT.some((ext) => lower.endsWith(ext));
}

/** The single most actionable reason to show on the card. */
export function primaryRejection(img: ImageDto) {
  return img.rejections[0];
}

export function fileMeta(img: ImageDto): string {
  const dims = img.width && img.height ? `${img.width}×${img.height}` : "";
  if (img.status === "ACCEPTED") {
    const face = img.faceSizeRatio ? `· face ${(img.faceSizeRatio * 100).toFixed(0)}%` : "";
    return [dims, "1 face", face].filter(Boolean).join(" · ").replace("· · ", "· ");
  }
  return dims;
}
