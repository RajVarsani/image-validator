# Image Validator: Scope

A headshot-intake photo-upload validator. Users upload photos; each is validated against 6 rules and sorted into **Accepted** / **Rejected** with per-image reasons and real-time status.

## Primary flow
Upload (drag/drop or picker, client-side format gate) → image stored to S3 + DB row `pending` → async worker runs validation pipeline → row becomes `accepted`/`rejected` with reasons → frontend polls and moves the card into the right section with a preview + status.

## Entities
- **Session**: a grouping for one upload batch (id, label, createdAt).
- **Image**: original filename, mime, S3 keys (original + converted), status enum (pending/processing/accepted/rejected), measured attrs (width/height/sizeBytes, perceptualHash, blurScore, faceCount, faceSizeRatio), timestamps.
- **ImageRejection**: child rows: reason enum + measuredValue + threshold + detail (one row per failed rule; an image can fail several).

## Validation rules
1. Too small: min resolution + min file size (`sharp` metadata).
2. Wrong format: allow only JPG/PNG/HEIC, verified by **magic bytes** (`file-type`), not client MIME.
3. Too similar: perceptual hash (`sharp-phash`) + Hamming distance ≤ threshold vs existing rows.
4. Blurry: variance-of-Laplacian (`sharp.convolve` + `.stats`), normalized by resize.
5. Face too small: largest face bbox area / image area < threshold (`@vladmandic/face-api`).
6. Multiple faces: face count > 1. (Also reject 0 faces.)

## Stack (decided)
- **Backend:** Node.js LTS + Express + Prisma 7 (pg driver adapter) + PostgreSQL. Async via **pg-boss** (Postgres-backed queue) + separate worker process. Files in **S3 via LocalStack**.
- **Image processing:** `sharp` + `heic-convert` (HEIC), `sharp-phash` (dedupe), hand-rolled blur, `@vladmandic/face-api` + `@tensorflow/tfjs-node` (faces).
- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4 + coss.com/ui (golden-path frontend). React hooks for upload state; polling for status.
- **Security:** magic-byte validation, multer size limits, sharp `limitInputPixels`/`failOn` bomb guard, EXIF stripped on re-encode, UUID storage keys, private bucket + short-lived presigned GET URLs, rate limiting.

## Screens
1. **Validator** (hero): header, upload dropzone with client-side format gate + live progress, Accepted section (grid of previews), Rejected section (grid with reason chips). Empty + processing + error states.
2. **Image detail**: modal/panel: large preview, all measured metrics, pass/fail per rule, original vs converted.

## Out of scope (YAGNI)
Auth/users, multi-batch history UI, editing/re-validation, pagination UI (API supports it), real cloud S3, mobile-native.
