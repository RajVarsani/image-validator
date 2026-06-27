import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import { THRESHOLDS } from "../config.js";
import type { CheckResult } from "../types.js";

// face-api's pure-JS CPU build (no native addon, no wasm files) runs on any
// Node version. It uses the separately-installed @tensorflow/tfjs CPU backend.
const require = createRequire(import.meta.url);
require("@tensorflow/tfjs");
const { setWasmPaths } = require("@tensorflow/tfjs-backend-wasm");
const faceapi = require("@vladmandic/face-api/dist/face-api.node-wasm.js");

const WASM_DIR =
  path.join(path.dirname(require.resolve("@tensorflow/tfjs-backend-wasm/package.json")), "dist/");

// face-api ships the model weights inside its npm package; load them straight
// from there (no separate download step). Override with FACE_MODELS_PATH.
const FACE_API_DIR = path.dirname(require.resolve("@vladmandic/face-api/package.json"));
const MODELS_PATH = process.env.FACE_MODELS_PATH ?? path.join(FACE_API_DIR, "model");

let ready: Promise<void> | undefined;
function ensureModels(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      setWasmPaths(WASM_DIR);
      await faceapi.tf.setBackend("wasm");
      await faceapi.tf.ready();
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
    })();
  }
  return ready;
}

export interface FaceBox {
  width: number;
  height: number;
  score: number;
}

/** Detect faces and return their bounding boxes (pixels). */
export async function detectFaces(jpeg: Buffer): Promise<{ faces: FaceBox[]; imageArea: number }> {
  await ensureModels();
  const { data, info } = await sharp(jpeg)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const input = faceapi.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], "int32");
  try {
    const detections = await faceapi.detectAllFaces(
      input,
      new faceapi.SsdMobilenetv1Options({ minConfidence: THRESHOLDS.FACE_MIN_CONFIDENCE }),
    );
    const faces: FaceBox[] = detections.map((d: any) => ({
      width: d.box.width,
      height: d.box.height,
      score: d.score,
    }));
    return { faces, imageArea: info.width * info.height };
  } finally {
    input.dispose();
  }
}

export function faceCheck(faces: FaceBox[], imageArea: number): { check: CheckResult; ratio: number } {
  const count = faces.length;
  if (count === 0) {
    return {
      ratio: 0,
      check: { key: "face", ok: false, reason: "NO_FACE", detail: "no face detected" },
    };
  }
  if (count > 1) {
    return {
      ratio: 0,
      check: { key: "face", ok: false, reason: "MULTIPLE_FACES", measured: count, detail: `${count} faces detected` },
    };
  }
  const largest = faces[0]!;
  const ratio = (largest.width * largest.height) / imageArea;
  const ok = ratio >= THRESHOLDS.FACE_MIN_RATIO;
  return {
    ratio,
    check: {
      key: "face",
      ok,
      reason: ok ? undefined : "FACE_TOO_SMALL",
      measured: Math.round(ratio * 1000) / 10,
      threshold: THRESHOLDS.FACE_MIN_RATIO * 100,
      detail: ok
        ? `1 face, fills ${(ratio * 100).toFixed(0)}%`
        : `face fills ${(ratio * 100).toFixed(0)}%, needs ≥${THRESHOLDS.FACE_MIN_RATIO * 100}%`,
    },
  };
}
