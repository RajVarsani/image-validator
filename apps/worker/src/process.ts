import { randomUUID } from "node:crypto";
import { prisma, findDuplicate } from "@iv/db";
import { validateImage, THRESHOLDS } from "@iv/validation";
import type { ValidationRequested } from "@iv/kafka";
import { getObjectBuffer, putObject } from "./s3.js";

/** Fetch the original from S3, run the pipeline, persist the verdict. Idempotent on imageId. */
export async function processImage(msg: ValidationRequested): Promise<string> {
  const start = Date.now();
  await prisma.image.update({ where: { id: msg.imageId }, data: { status: "PROCESSING" } });

  const original = await getObjectBuffer(msg.storageKey);

  const result = await validateImage(original, {
    duplicateLookup: (ph) =>
      findDuplicate(msg.sessionId, ph, THRESHOLDS.PHASH_MAX_DISTANCE, msg.imageId),
  });

  let convertedKey: string | undefined;
  if (result.normalized) {
    convertedKey = `converted/${randomUUID()}.jpg`;
    await putObject(convertedKey, result.normalized, "image/jpeg");
  }

  const m = result.metrics;
  await prisma.$transaction([
    prisma.imageRejection.deleteMany({ where: { imageId: msg.imageId } }),
    prisma.image.update({
      where: { id: msg.imageId },
      data: {
        status: result.status === "accepted" ? "ACCEPTED" : "REJECTED",
        convertedStorageKey: convertedKey,
        width: m.width ?? null,
        height: m.height ?? null,
        sizeBytes: m.sizeBytes,
        perceptualHash: m.perceptualHash ?? null,
        blurScore: m.blurScore ?? null,
        faceCount: m.faceCount ?? null,
        faceSizeRatio: m.faceSizeRatio ?? null,
        durationMs: Date.now() - start,
        rejections: {
          create: result.checks
            .filter((c) => !c.ok && c.reason)
            .map((c) => ({
              reason: c.reason!,
              detail: c.detail,
              measured: c.measured ?? null,
              threshold: c.threshold ?? null,
            })),
        },
      },
    }),
  ]);

  return result.status;
}
