# CLAUDE.md

Guidance for working in this repository.

## What this is
A distributed photo-intake validator. Users upload photos; each one runs six checks and is sorted into Accepted or Rejected with the exact reason. A stateless API and an independently scalable worker, decoupled over Kafka.

## Stack
Node + Express (API), KafkaJS worker (consumer), Postgres via Prisma, S3 via LocalStack, sharp / heic-convert / sharp-phash / face-api.js for image work. React 19 + Vite + Tailwind v4 + coss.com/ui (dark default), SWR + axios on the frontend. pnpm workspaces monorepo.

## Layout
- `apps/api`: Express upload and listing, S3, Kafka producer
- `apps/worker`: Kafka consumer, runs the pipeline, writes verdicts
- `apps/web`: React frontend
- `packages/validation`: the six rules as pure functions (no I/O), plus the test suite
- `packages/db`: Prisma schema and a client singleton
- `packages/kafka`: shared client, topic names, and the message type

## Commands
- `pnpm install`
- `pnpm infra:up` (Postgres + Kafka + LocalStack in Docker)
- `pnpm db:push` (apply the Prisma schema)
- `pnpm dev` (api + worker + web together)
- `pnpm test` (validation suite against the 105 fixtures)
- Ports live in `.env` (web 5290, api 4310, pg 5440, kafka 9292, localstack 4576)

## Conventions
- Frontend data fetching uses `useSWR` + `axios` through the shared `genericAPIFetcher` / `genericMutationFetcher` in `apps/web/src/lib/fetchers.ts`. No per-endpoint service files.
- Frontend modules are kebab-case directories with small components: an `index.tsx` per level, plus `types.ts` / `utils.ts` / `queries.ts` as needed.
- Validation logic stays pure (no DB, S3, or Kafka) so it can be tested in isolation.
- The API and worker share one typed Kafka message contract in `packages/kafka`, so the two sides cannot drift.

## Notes that bite
- Blur is variance of the Laplacian. `sharp.stats()` silently ignores a piped `.convolve()`, so render the convolved pixels with `.raw()` and compute the variance by hand.
- Face detection runs face-api on its WASM backend; native `tfjs-node` has no prebuilt binary for the current Node version.
- The perceptual hash is stored as a Postgres `bigint`; dedupe runs `bit_count` over the XOR of two hashes for Hamming distance.
- All thresholds live in `packages/validation/src/config.ts`.
