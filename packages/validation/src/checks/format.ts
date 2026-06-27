import { fileTypeFromBuffer } from "file-type";
import { THRESHOLDS } from "../config.js";
import type { CheckResult } from "../types.js";

export interface FormatInfo {
  mime?: string;
  ext?: string;
  check: CheckResult;
}

/**
 * Determine the real format from magic bytes (never trust the client's
 * Content-Type / extension) and verify it is one we accept.
 */
export async function checkFormat(buffer: Buffer): Promise<FormatInfo> {
  const ft = await fileTypeFromBuffer(buffer);
  const mime = ft?.mime;
  const allowed = !!mime && THRESHOLDS.ALLOWED_MIME.includes(mime);
  return {
    mime,
    ext: ft?.ext,
    check: {
      key: "format",
      ok: allowed,
      reason: allowed ? undefined : "UNSUPPORTED_FORMAT",
      detail: allowed
        ? `${mime} (verified)`
        : `${mime ?? "unknown"}: only JPG, PNG, HEIC allowed`,
    },
  };
}
