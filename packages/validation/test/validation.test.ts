import { describe, it, expect, beforeAll } from "vitest";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateImage } from "../src/run.js";
import { THRESHOLDS } from "../src/config.js";
import { hammingDistance } from "../src/checks/phash.js";
import type { RejectionReason } from "../src/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(here, "fixtures");
const MANIFEST = path.join(FIXTURES, "manifest.json");

interface Fixture {
  file: string;
  expect: { status: "accepted" | "rejected"; reasons: RejectionReason[] };
  duplicateOf?: string;
  notes?: string;
}

const FACE_REASONS = new Set<RejectionReason>(["NO_FACE", "FACE_TOO_SMALL", "MULTIPLE_FACES"]);

async function fileExists(p: string) {
  try { await access(p); return true; } catch { return false; }
}

const hasManifest = await fileExists(MANIFEST);

describe.skipIf(!hasManifest)("validation suite (fixtures)", () => {
  let fixtures: Fixture[] = [];
  // Shared store of accepted hashes, mirrors production: a DUPLICATE only
  // matches an image that was already ACCEPTED. Process sources before dupes.
  const acceptedHashes: bigint[] = [];

  const duplicateLookup = async (ph: bigint) => {
    let best: { id: string; distance: number } | null = null;
    for (let i = 0; i < acceptedHashes.length; i++) {
      const d = hammingDistance(ph, acceptedHashes[i]!);
      if (d <= THRESHOLDS.PHASH_MAX_DISTANCE && (!best || d < best.distance)) {
        best = { id: String(i), distance: d };
      }
    }
    return best;
  };

  beforeAll(async () => {
    const raw = JSON.parse(await readFile(MANIFEST, "utf8")) as Fixture[];
    // sources first, duplicates last
    fixtures = [...raw].sort((a, b) => Number(!!a.duplicateOf) - Number(!!b.duplicateOf));
  });

  it("loaded a meaningful number of fixtures", () => {
    expect(fixtures.length).toBeGreaterThan(40);
  });

  it("classifies every fixture correctly", async () => {
    const failures: string[] = [];
    let correct = 0;

    for (const fx of fixtures) {
      const buf = await readFile(path.join(FIXTURES, fx.file));
      const result = await validateImage(buf, { duplicateLookup });

      let ok = result.status === fx.expect.status;

      if (ok && fx.expect.status === "rejected") {
        for (const r of fx.expect.reasons) {
          if (FACE_REASONS.has(r)) {
            // CV fuzz: accept any face-related reason for face fixtures
            if (![...result.reasons].some((x) => FACE_REASONS.has(x))) ok = false;
          } else if (!result.reasons.includes(r)) {
            ok = false;
          }
        }
      }

      if (ok) {
        correct++;
        if (result.status === "accepted" && result.metrics.perceptualHash != null) {
          acceptedHashes.push(result.metrics.perceptualHash);
        }
      } else {
        failures.push(
          `${fx.file}: expected ${fx.expect.status}[${fx.expect.reasons}], got ${result.status}[${result.reasons}]`,
        );
      }
    }

    const accuracy = correct / fixtures.length;
    // eslint-disable-next-line no-console
    console.log(`\nAccuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${fixtures.length})`);
    if (failures.length) console.log("Misclassified:\n" + failures.join("\n"));

    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });
});
