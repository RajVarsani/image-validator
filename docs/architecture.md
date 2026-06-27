# Image Validator: Architecture

## Two-backend, event-driven design (over Kafka)

```
                        ┌─────────────────────────────┐
  Browser ──upload──▶   │ apps/api  (Express)          │
  (React + Vite)        │  • magic-byte + size guard   │
        ▲               │  • PUT file → S3 (LocalStack)│
        │ poll status   │  • INSERT row (status=pending│  Prisma
        │               │    via @iv/db)               │
        │               │  • PRODUCE Kafka event ───────┐
        │               └─────────────────────────────┘ │
        │                                                │  topic: image.validation.requested
        │                                                ▼  (3 partitions, keyed by imageId)
        │               ┌─────────────────────────────┐ │
        └──GET /images──│ apps/worker (consumer)       │◀┘
                        │  group: image-validation-... │
                        │  • fetch file from S3        │
                        │  • pipeline: heic→jpeg,      │
                        │    resolution, format, blur, │
                        │    pHash dedupe, face-api    │
                        │  • UPDATE row accepted/reject│
                        │  • DLQ after N attempts ──────▶ image.validation.dlq
                        └─────────────────────────────┘
   Postgres + Kafka + LocalStack S3 all in docker-compose.
```

## Why Kafka (Loom talking points)
- **Decoupling**: API only emits an event; doesn't know/care who validates or how many workers run. Deploy/scale/fail independently.
- **Durability + replay**: events persist; worker downtime loses nothing. Reset the consumer-group offset to **re-process every image** after tuning a threshold, with no API involvement (a Redis list can't replay).
- **Horizontal scaling**: 3 partitions + one consumer group → run N worker processes, Kafka rebalances one partition each, zero custom coordination. Key by `imageId` → per-image ordering preserved.
- **Backpressure**: heavy face-api work never slows uploads; the log absorbs bursts, workers pull at their pace.
- **Honest tradeoff (maturity signal):** Kafka is heavier than this scale needs; **pg-boss** (transactional enqueue in the Postgres we already run) or **BullMQ/Redis** would ship faster. Kafka shines with multiple independent consumers, replay, and high throughput, used here to demonstrate the event-driven pattern. Named seam: DB write + produce are two systems (dual-write gap) → mitigate by writing the row first; a reaper re-publishes stuck `pending` rows.

## Stack decisions (verified June 2026)
- **Runtime:** plain Node.js LTS (NOT Bun; native ML addons break under Bun).
- **Kafka:** `apache/kafka-native:4.3.1` (KRaft, no Zookeeper, arm64 native, ~1s boot). Dual listeners: HOST `localhost:9092` for host Node procs, DOCKER `kafka:9093` for containers. Optional Redpanda Console for a live topic UI in the demo.
- **Client:** `kafkajs` (pure-JS, zero native build). Note on camera: kafkajs is in maintenance limbo since 2023; prod would use `@confluentinc/kafka-javascript` (maintained, librdkafka, KafkaJS-compatible API, same code, swap the import).
- **ORM:** Prisma 7 (pg driver adapter); generated client lives in `packages/db`, imported as singleton by both apps.
- **Topics:** `image.validation.requested` (3 partitions), `image.validation.dlq` (1). Init container creates them explicitly (`--if-not-exists`).
- **Delivery:** at-least-once; `eachMessage` handles errors internally (re-publish w/ incremented attempt, or DLQ + mark failed) and returns normally so offsets advance, never throw on a poison message. DB updates idempotent (keyed by imageId).

## Monorepo layout
```
image-validator/
├─ docker-compose.yml            # kafka + kafka-init + postgres + localstack
├─ package.json                  # workspaces: apps/*, packages/*
├─ apps/
│  ├─ api/                       # Backend A: Express, upload, S3, produce
│  └─ worker/                    # Backend B: consumer, validation pipeline
│  └─ web/                       # React + Vite frontend
└─ packages/
   ├─ db/                        # Prisma schema + generated client (singleton export)
   └─ kafka/                     # client.ts, topics.ts, messages.ts, producer.ts (shared contract)
```
Shared `ValidationRequested` type + `TOPICS` const in `packages/kafka` → producer and consumer typecheck against one contract.

## Validation pipeline (worker): verified libs
1. magic bytes (`file-type`) → 2. HEIC detect → `heic-convert` → JPEG → 3. `sharp` metadata (resolution/size min) → 4. blur = variance-of-Laplacian (`sharp.convolve` + `.stats().stdev²`, resize-normalized) → 5. `sharp-phash` + Hamming (`bit_count(phash # $1)` in PG) → 6. `@vladmandic/face-api` (count + bbox → face-size ratio). Security: `sharp({ limitInputPixels, failOn })`, EXIF stripped on re-encode, UUID S3 keys, private bucket + presigned GET, rate limiting.
</content>
