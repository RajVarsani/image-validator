import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { prisma } from "@iv/db";
import { publishValidationRequested } from "@iv/kafka";
import { env } from "../env.js";
import { putObject, deleteObject } from "../s3.js";
import { toImageDto } from "../serialize.js";

export const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_BYTES, files: env.MAX_FILES },
});

const uploadLimiter = rateLimit({ windowMs: 60_000, max: 240, standardHeaders: true });

/** Create an upload session. */
router.post("/sessions", async (_req, res) => {
  const session = await prisma.session.create({ data: {} });
  res.status(201).json(session);
});

/** List a session's images, newest first, optionally filtered by status. */
router.get("/sessions/:id/images", async (req, res) => {
  const status = (req.query.status as string | undefined)?.toUpperCase();
  const images = await prisma.image.findMany({
    where: {
      sessionId: req.params.id,
      ...(status && status !== "ALL" ? { status: status as any } : {}),
    },
    include: { rejections: true },
    orderBy: { createdAt: "desc" },
  });
  const counts = await prisma.image.groupBy({
    by: ["status"],
    where: { sessionId: req.params.id },
    _count: true,
  });
  res.json({
    images: await Promise.all(images.map(toImageDto)),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  });
});

/** Upload one or more images: store original -> DB row (PENDING) -> enqueue. */
router.post("/images", uploadLimiter, upload.array("files", env.MAX_FILES), async (req, res) => {
  let sessionId = req.body.sessionId as string | undefined;
  if (sessionId) {
    // Ensure the session row exists (survives a wiped DB + a stale client id).
    await prisma.session.upsert({ where: { id: sessionId }, update: {}, create: { id: sessionId } });
  } else {
    sessionId = (await prisma.session.create({ data: {} })).id;
  }

  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) return res.status(400).json({ error: "no files" });

  const accepted: any[] = [];
  const skipped: { filename: string; error: string }[] = [];

  for (const f of files) {
    // Secure handling: verify the real type by magic bytes, not the client's claim.
    const ft = await fileTypeFromBuffer(f.buffer);
    if (!ft || !ft.mime.startsWith("image/")) {
      skipped.push({ filename: f.originalname, error: "not an image" });
      continue;
    }
    const key = `originals/${randomUUID()}`;
    await putObject(key, f.buffer, ft.mime);
    const img = await prisma.image.create({
      data: {
        sessionId,
        originalFilename: f.originalname,
        mimeType: ft.mime,
        status: "PENDING",
        storageKey: key,
        sizeBytes: f.size,
      },
      include: { rejections: true },
    });
    // Enqueue AFTER the row exists; a failed publish leaves the row PENDING (reapable).
    await publishValidationRequested({
      imageId: img.id,
      sessionId,
      storageKey: key,
      bucket: env.S3_BUCKET,
      mimeType: ft.mime,
      originalFilename: f.originalname,
      uploadedAt: new Date().toISOString(),
    });
    accepted.push(img);
  }

  res.status(202).json({
    sessionId,
    images: await Promise.all(accepted.map(toImageDto)),
    skipped,
  });
});

/** Single image with its full rejection breakdown. */
router.get("/images/:id", async (req, res) => {
  const img = await prisma.image.findUnique({
    where: { id: req.params.id },
    include: { rejections: true },
  });
  if (!img) return res.status(404).json({ error: "not found" });
  res.json(await toImageDto(img));
});

/** Delete an image (and its S3 objects). */
router.delete("/images/:id", async (req, res) => {
  const img = await prisma.image.findUnique({ where: { id: req.params.id } });
  if (!img) return res.status(404).json({ error: "not found" });
  await Promise.allSettled([
    deleteObject(img.storageKey),
    img.convertedStorageKey ? deleteObject(img.convertedStorageKey) : Promise.resolve(),
  ]);
  await prisma.image.delete({ where: { id: img.id } });
  res.status(204).end();
});
