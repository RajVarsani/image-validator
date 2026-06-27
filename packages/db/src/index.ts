import { PrismaClient } from "./generated/client/index.js";

export * from "./generated/client/index.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Find an existing image in the same session whose perceptual hash is within
 * `maxDistance` Hamming distance of `phash`. Uses Postgres' native bit_count()
 * over the XOR of the two 64-bit hashes (PG14+). Sequential scan is fine at
 * session scale; the scale-path is a BK-tree (pg-spgist_hamming) index.
 */
export async function findDuplicate(
  sessionId: string,
  phash: bigint,
  maxDistance: number,
  excludeImageId?: string,
): Promise<{ id: string; distance: number } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; distance: number }>>`
    SELECT id, bit_count(("perceptualHash" # ${phash})::bit(64))::int AS distance
    FROM "Image"
    WHERE "sessionId" = ${sessionId}::uuid
      AND "perceptualHash" IS NOT NULL
      AND "status" = 'ACCEPTED'
      AND "id" <> ${excludeImageId ?? "00000000-0000-0000-0000-000000000000"}::uuid
      AND bit_count(("perceptualHash" # ${phash})::bit(64)) <= ${maxDistance}
    ORDER BY distance ASC
    LIMIT 1;
  `;
  return rows[0] ?? null;
}
