import phash from "sharp-phash";

/**
 * 64-bit DCT perceptual hash, returned as a signed BigInt so it fits Postgres
 * `bigint` (int8). The sign is irrelevant; XOR + bit_count operate on the bit
 * pattern. Hamming distance between two hashes measures visual similarity.
 */
export async function perceptualHash(buffer: Buffer): Promise<bigint> {
  const bits: string = await phash(buffer); // 64-char "0"/"1" string
  const unsigned = BigInt("0b" + bits);
  // wrap to signed 64-bit range
  return unsigned >= 1n << 63n ? unsigned - (1n << 64n) : unsigned;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = (a ^ b) & ((1n << 64n) - 1n);
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}
