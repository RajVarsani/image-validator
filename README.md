# aperture · image validator

A headshot-intake photo-upload validator. Users upload photos; each runs six checks and is sorted into **Accepted** / **Rejected** with the exact reason. Built as a **distributed, event-driven** system: a stateless API and an independently-scalable worker fleet, decoupled over **Kafka**.

## Architecture

```
 Browser (React/Vite)                  ┌── Postgres ──┐         ┌── S3 (LocalStack) ──┐
        │  ▲                           │  Prisma ORM  │         │ originals/ converted/ │
 upload │  │ poll GET /images          └──────┬───────┘         └──────────┬───────────┘
        ▼  │                                  │                            │
 ┌─────────────────┐  produce         image.validation.requested   ┌──────────────────┐
 │ apps/api        │ ───────────────▶  (3 partitions, key=imageId) │ apps/worker      │
 │ Express         │      Kafka  ─────────────────────────────────▶│ KafkaJS consumer │
 │ • magic-byte    │                                               │ group=workers    │
 │   gate (secure) │                  image.validation.dlq ◀──────  │ • pipeline       │
 │ • S3 put        │                                               │ • update DB      │
 │ • row=PENDING   │                                               └──────────────────┘
 │ • enqueue       │
 └─────────────────┘   packages/validation  ← pure, unit-tested pipeline (no I/O)
```

- **`apps/api`** (Node + Express) handles uploads: verifies the real file type by **magic bytes** (not the client's claim), streams the original to **S3**, writes a `PENDING` row via **Prisma**, and **produces** a Kafka event. Returns `202` immediately. Also serves listing/detail with short-lived **presigned GET URLs** (browser fetches bytes straight from S3).
- **`apps/worker`** (Node + KafkaJS consumer) **consumes** the topic, pulls the original from S3, runs the validation pipeline, writes the verdict + per-rule rejections. Retries with backoff; dead-letters after 3 attempts.
- **`packages/validation`**: the six rules as **pure functions** (no DB/S3/Kafka), which is what makes them unit-testable against a 105-image fixture suite (`pnpm test`).
- **`packages/db`**: Prisma schema + singleton client; **`packages/kafka`**: the shared client, topic names, and the `ValidationRequested` message type (one contract, both ends typecheck against it).

### Why Kafka (and the honest tradeoff)
Decoupling (API & workers scale/deploy/fail independently), **durability + replay** (reset the consumer-group offset to re-validate everything after tuning a threshold, which a Redis list can't), **horizontal scaling** (3 partitions + one consumer group → run N workers, Kafka rebalances; keyed by `imageId` for per-image ordering), and **backpressure** (heavy face detection never slows uploads). Tradeoff: for this scale, **pg-boss** (a Postgres-backed queue, transactional enqueue, zero new infra) would ship faster. Kafka is chosen here to demonstrate the event-driven backbone, and `kafkajs` would migrate to the maintained `@confluentinc/kafka-javascript` (KafkaJS-compatible API) in production.

## The six rules
| Rule | How | Reject reason |
|---|---|---|
| Too small | `sharp` metadata, min edge < 512px | `LOW_RESOLUTION` |
| Wrong format | `file-type` magic bytes (allow JPG/PNG/HEIC) | `UNSUPPORTED_FORMAT` |
| Too similar | `sharp-phash` 64-bit pHash, Hamming ≤ 6 vs accepted rows (`bit_count` in Postgres) | `DUPLICATE` |
| Blurry | variance of the Laplacian (rendered via `sharp.convolve` + manual variance), threshold 100 | `BLURRY` |
| Face too small | `@vladmandic/face-api` (WASM backend), largest face < 12% of frame | `FACE_TOO_SMALL` |
| Multiple / no faces | face count ≠ 1 | `MULTIPLE_FACES` / `NO_FACE` |

HEIC is converted to JPEG (`heic-convert`, pure-JS) before checks and stored as the previewable asset. Every accepted image is re-encoded to JPEG, which **strips EXIF**.

### Secure file handling
Magic-byte validation, `multer` size/count limits, `sharp({ limitInputPixels })` decompression-bomb guard, EXIF stripped on re-encode, **UUID storage keys** (no path traversal/enumeration), private bucket + presigned URLs (served off-origin), rate limiting on upload.

## Run it

Prereqs: Node ≥ 20, pnpm, Docker.

```bash
pnpm install            # installs deps; face-api models ship in the package
pnpm infra:up           # Postgres + Kafka (KRaft) + LocalStack S3 in Docker
pnpm db:push            # apply the Prisma schema
pnpm dev                # api + worker + web together
```

- Web: http://localhost:5290 · API: http://localhost:4310 · (ports configurable in `.env`)
- `pnpm test` runs the validation pipeline against all 105 labelled fixtures (currently **100%**).

## Tech
Node + Express + Prisma + PostgreSQL · KafkaJS over Apache Kafka (KRaft) · S3 via LocalStack · sharp / heic-convert / sharp-phash / face-api.js (wasm) · React 19 + Vite + Tailwind v4 (coss.com/ui language, dark default) + SWR + axios · pnpm workspaces monorepo.
