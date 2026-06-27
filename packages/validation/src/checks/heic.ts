import heicConvert from "heic-convert";

const HEIC_BRANDS = ["heic", "heix", "hevc", "heim", "heis", "hevm", "mif1", "msf1", "heif"];

/** Detect HEIC/HEIF by the ISO-BMFF `ftyp` brand. */
export function isHeic(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer.toString("latin1", 4, 8) !== "ftyp") return false;
  return HEIC_BRANDS.includes(buffer.toString("latin1", 8, 12));
}

/**
 * Convert HEIC -> JPEG using the pure-JS libheif (no native libs). Browsers
 * can't render HEIC, so the server must convert before storing a preview.
 */
export async function heicToJpeg(buffer: Buffer): Promise<Buffer> {
  const out = await heicConvert({ buffer, format: "JPEG", quality: 0.92 });
  return Buffer.from(out);
}
