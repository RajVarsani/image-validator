import { presignGet } from "./s3.js";

/** Map a Prisma Image (+rejections) to a JSON-safe DTO with a presigned preview URL. */
export async function toImageDto(img: any) {
  const previewKey = img.convertedStorageKey ?? img.storageKey;
  const previewUrl =
    img.status === "ACCEPTED" || img.status === "REJECTED" || img.convertedStorageKey
      ? await presignGet(previewKey).catch(() => null)
      : null;

  return {
    id: img.id,
    sessionId: img.sessionId,
    originalFilename: img.originalFilename,
    mimeType: img.mimeType,
    status: img.status,
    width: img.width,
    height: img.height,
    sizeBytes: img.sizeBytes,
    blurScore: img.blurScore,
    faceCount: img.faceCount,
    faceSizeRatio: img.faceSizeRatio,
    durationMs: img.durationMs,
    createdAt: img.createdAt,
    previewUrl,
    rejections: (img.rejections ?? []).map((r: any) => ({
      reason: r.reason,
      detail: r.detail,
      measured: r.measured,
      threshold: r.threshold,
    })),
  };
}
