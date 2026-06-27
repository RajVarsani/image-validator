// Downloads the face-api SSD MobileNet v1 weights (~5.4MB) used for face
// detection. Pure data files, loaded from disk by face-api at runtime.
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://raw.githubusercontent.com/vladmandic/face-api/master/model";
const FILES = [
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model-shard1",
  "ssd_mobilenetv1_model-shard2",
];

const modelsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "models");

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

await mkdir(modelsDir, { recursive: true });
for (const file of FILES) {
  const dest = path.join(modelsDir, file);
  if (await exists(dest)) {
    console.log(`✓ ${file} (cached)`);
    continue;
  }
  process.stdout.write(`↓ ${file} ... `);
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`failed to download ${file}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`${(buf.length / 1024).toFixed(0)}KB`);
}
console.log(`Models ready in ${modelsDir}`);
