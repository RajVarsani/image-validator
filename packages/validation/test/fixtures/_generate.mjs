#!/usr/bin/env node
// =============================================================================
// Fixture generator for the headshot-intake image-validation pipeline.
//
// Produces ~100 labelled test images under FINAL/ plus a manifest.json that
// drives the automated test suite. All raw source images live in ./raw and are
// NOT shipped; only the derived fixtures + manifest + this script are.
//
// Rules under test (reason codes in CAPS):
//   LOW_RESOLUTION    min edge < 512  OR file < ~10KB
//   UNSUPPORTED_FORMAT not JPEG/PNG/HEIC (by magic bytes)
//   DUPLICATE         perceptual-hash Hamming distance <= 6 to another image
//   BLURRY            variance-of-Laplacian below threshold
//   FACE_TOO_SMALL    largest face area < 12% of image area
//   MULTIPLE_FACES    > 1 face detected
//   NO_FACE           0 faces detected
// ACCEPTED = passes ALL rules.
//
// Design notes that keep the labels honest:
//  * accepted / blurry / low_resolution / heic each use a DISJOINT pool of
//    unique faces so that a blurred or downscaled face is never a perceptual
//    duplicate of an accepted one (dHash barely changes under blur/downscale).
//  * duplicate/ images are derived ON PURPOSE from accepted/ sources.
//  * face_too_small uses a high-frequency RANDOM-NOISE background so the global
//    variance-of-Laplacian stays high (=> not BLURRY) and the hash is unique
//    (=> not a DUPLICATE of any landscape) while the real face stays tiny.
// =============================================================================

import sharp from 'sharp';
import { readdirSync, mkdirSync, writeFileSync, rmSync, existsSync, copyFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import path from 'path';

const RAW_FACES = 'raw/faces';
const RAW_LAND = 'raw/landscapes';
const OUT = '/Users/rajvarsani/fafo/image-validator/packages/validation/test/fixtures';

// ---- helpers ----------------------------------------------------------------
const faceFiles = readdirSync(RAW_FACES).filter(f => /^face_\d+\.jpg$/.test(f)).sort();
const landFiles = readdirSync(RAW_LAND).filter(f => /^land_\d+\.jpg$/.test(f)).sort();
const FACE = n => `${RAW_FACES}/${faceFiles[n]}`;   // 0-indexed into sorted pool
const LAND = f => `${RAW_LAND}/${f}`;

const manifest = [];
function add(file, status, reasons, notes, extra = {}) {
  manifest.push({ file, expect: { status, reasons }, notes, ...extra });
}

function freshDir(sub) {
  const d = path.join(OUT, sub);
  if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  mkdirSync(d, { recursive: true });
  return d;
}

// difference-hash (64-bit) used only to self-verify duplicate relationships
async function dhash(input) {
  const { data } = await sharp(input).grayscale().resize(9, 8, { fit: 'fill' })
    .raw().toBuffer({ resolveWithObject: true });
  const bits = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const i = r * 9 + c; bits.push(data[i] < data[i + 1] ? 1 : 0);
  }
  return bits;
}
const ham = (a, b) => a.reduce((d, v, i) => d + (v !== b[i] ? 1 : 0), 0);

// minimal 24-bit uncompressed BMP encoder (sharp/libvips cannot write BMP)
async function writeBmp(srcBuf, w, h, outPath) {
  const { data } = await sharp(srcBuf).resize(w, h, { fit: 'cover' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true }); // RGB, top-down
  const rowRaw = w * 3;
  const rowPad = (rowRaw + 3) & ~3;
  const imgSize = rowPad * h;
  const fileSize = 54 + imgSize;
  const buf = Buffer.alloc(fileSize);
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);          // pixel data offset
  buf.writeUInt32LE(40, 14);          // DIB header size
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);           // planes
  buf.writeUInt16LE(24, 28);          // bpp
  buf.writeUInt32LE(0, 30);           // compression = BI_RGB
  buf.writeUInt32LE(imgSize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  for (let y = 0; y < h; y++) {
    const srcRow = (h - 1 - y) * rowRaw;          // BMP is bottom-up
    let off = 54 + y * rowPad;
    for (let x = 0; x < w; x++) {
      const s = srcRow + x * 3;
      buf[off++] = data[s + 2]; // B
      buf[off++] = data[s + 1]; // G
      buf[off++] = data[s];     // R
    }
  }
  writeFileSync(outPath, buf);
}

// random-noise canvas (sharp create + noise is not available, so build raw)
function noiseBuffer(size) {
  const data = Buffer.allocUnsafe(size * size * 3);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 256) | 0;
  return sharp(data, { raw: { width: size, height: size, channels: 3 } });
}

const hashes = {}; // file -> bits, for verification report

// ============================================================================
// 1. ACCEPTED  (~30): good single-face headshots, face ~25-40% of frame
// ============================================================================
{
  const dir = freshDir('accepted');
  // sizes & formats cycle to add variety
  const sizes = [1000, 1100, 1200, 1280, 1400, 1500, 1600];
  for (let i = 0; i < 30; i++) {
    const size = sizes[i % sizes.length];
    const ext = (i % 5 === 0) ? 'png' : 'jpg';
    // every 3rd image: mild center-crop to push the face toward ~38% of frame
    const crop = (i % 3 === 0);
    let img = sharp(FACE(i));
    if (crop) {
      const c = Math.round(1024 * 0.86);
      const o = Math.round((1024 - c) / 2);
      img = img.extract({ left: o, top: o, width: c, height: c });
    }
    img = img.resize(size, size, { fit: 'cover' }).sharpen();
    const name = `face_${String(i + 1).padStart(2, '0')}.${ext}`;
    const buf = ext === 'png'
      ? await img.png().toBuffer()
      : await img.jpeg({ quality: 92 }).toBuffer();
    writeFileSync(path.join(dir, name), buf);
    const rel = `accepted/${name}`;
    hashes[rel] = await dhash(buf);
    add(rel, 'accepted', [],
      `unique single face, ~${crop ? 38 : 30}% of frame, ${size}px ${ext.toUpperCase()}`);
  }
}

// ============================================================================
// 2. LOW_RESOLUTION  (~11): distinct faces, downscaled below 512 min edge
// ============================================================================
{
  const dir = freshDir('low_resolution');
  const dims = [[200,200],[256,256],[300,300],[300,400],[400,300],
                [480,360],[350,500],[200,300],[420,420],[500,280]];
  let idx = 42; // pool offset (faces 43..)
  for (let i = 0; i < dims.length; i++, idx++) {
    const [w, h] = dims[i];
    const name = `face_lowres_${String(i + 1).padStart(2, '0')}_${w}x${h}.jpg`;
    const buf = await sharp(FACE(idx)).resize(w, h, { fit: 'cover' })
      .jpeg({ quality: 90 }).toBuffer();
    writeFileSync(path.join(dir, name), buf);
    add(`low_resolution/${name}`, 'rejected', ['LOW_RESOLUTION'],
      `single face downscaled to ${w}x${h} (min edge < 512)`);
  }
  // one combined LOW_RESOLUTION + BLURRY (tiny AND blurred) to exercise multi-reason
  {
    const name = 'face_lowres_blur_150x150.jpg';
    const buf = await sharp(FACE(idx++)).resize(150, 150, { fit: 'cover' })
      .blur(4).jpeg({ quality: 80 }).toBuffer();
    writeFileSync(path.join(dir, name), buf);
    add(`low_resolution/${name}`, 'rejected', ['LOW_RESOLUTION', 'BLURRY'],
      'tiny 150x150 AND gaussian-blurred: two reasons genuinely apply');
  }
}

// ============================================================================
// 3. BLURRY  (~12): distinct sharp faces, gaussian blur at varying sigma
// ============================================================================
{
  const dir = freshDir('blurry');
  const sigmas = [3, 4, 5, 6, 7, 8, 3, 5, 6, 8, 10, 4];
  let idx = 30; // pool offset (faces 31..)
  for (let i = 0; i < sigmas.length; i++, idx++) {
    const s = sigmas[i];
    const name = `face_blur_${String(i + 1).padStart(2, '0')}_sigma${s}.jpg`;
    const buf = await sharp(FACE(idx)).resize(1200, 1200, { fit: 'cover' })
      .blur(s).jpeg({ quality: 90 }).toBuffer();
    writeFileSync(path.join(dir, name), buf);
    const borderline = s <= 3;
    add(`blurry/${name}`, 'rejected', ['BLURRY'],
      `gaussian sigma ${s}${borderline ? ' (borderline, near threshold)' : ''}`);
  }
}

// ============================================================================
// 4. FACE_TOO_SMALL (~10): small sharp face on a large high-freq noise canvas
//    Noise bg => high Laplacian variance (not BLURRY) + unique hash (not DUP).
// ============================================================================
{
  const dir = freshDir('face_too_small');
  // canvas / face combos => face fraction well under 12%
  const combos = [[3000, 700],[3200, 700],[2800, 650],[3600, 800],[3000, 600],
                  [2600, 560],[3400, 720],[4000, 820],[3000, 680],[3200, 640]];
  for (let i = 0; i < combos.length; i++) {
    const [canvas, faceSz] = combos[i];
    const faceBuf = await sharp(FACE(i)) // reuse accepted-pool faces (noise bg => no dup)
      .resize(faceSz, faceSz, { fit: 'cover' }).jpeg({ quality: 92 }).toBuffer();
    const left = ((canvas - faceSz) / 2) | 0;
    const top = (canvas * 0.18) | 0;
    const out = await noiseBuffer(canvas)
      .composite([{ input: faceBuf, left, top }])
      .jpeg({ quality: 90 }).toBuffer();
    const name = `face_small_${String(i + 1).padStart(2, '0')}_${faceSz}on${canvas}.jpg`;
    writeFileSync(path.join(dir, name), out);
    // face-box ~0.30*faceSz^2 ; fraction vs canvas^2
    const frac = (0.30 * faceSz * faceSz / (canvas * canvas) * 100).toFixed(1);
    add(`face_too_small/${name}`, 'rejected', ['FACE_TOO_SMALL'],
      `${faceSz}px face on ${canvas}px noise canvas, face ~${frac}% of frame (<12%)`);
  }
}

// ============================================================================
// 5. MULTIPLE_FACES (~10): 2-3 distinct faces composited side by side
// ============================================================================
{
  const dir = freshDir('multiple_faces');
  // groups of face-pool indices (reuse is fine: composite hash != single hash)
  // use only faces 66..77 (a pool not consumed by any single-image category)
  const groups = [
    [66, 67], [68, 69], [70, 71], [72, 73], [74, 75],
    [76, 77, 66], [67, 68, 69], [70, 71, 72], [73, 74, 75], [76, 77],
  ];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const cell = 900;
    const W = cell * g.length, H = cell;
    const tiles = [];
    for (let j = 0; j < g.length; j++) {
      const b = await sharp(FACE(g[j])).resize(cell, cell, { fit: 'cover' })
        .jpeg({ quality: 92 }).toBuffer();
      tiles.push({ input: b, left: j * cell, top: 0 });
    }
    const out = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 20, g: 20, b: 20 } } })
      .composite(tiles).jpeg({ quality: 90 }).toBuffer();
    const name = `group_${String(i + 1).padStart(2, '0')}_${g.length}faces.jpg`;
    writeFileSync(path.join(dir, name), out);
    add(`multiple_faces/${name}`, 'rejected', ['MULTIPLE_FACES'],
      `${g.length} distinct faces side by side`);
  }
}

// ============================================================================
// 6. NO_FACE (~10): faceless landscapes/objects, good resolution & sharp
// ============================================================================
{
  const dir = freshDir('no_face');
  // land_06 excluded on purpose (it contains a crowd of people)
  const chosen = ['land_01','land_02','land_03','land_04','land_05',
                  'land_07','land_08','land_09','land_10','land_11'];
  const descr = {
    land_01: 'beach chair on dunes', land_02: 'green rolling hills',
    land_03: 'fence post in a field', land_04: 'rusty vintage truck',
    land_05: 'suspension bridge at dusk', land_07: 'Flatiron building',
    land_08: 'forest footbridge', land_09: 'foggy pine forest',
    land_10: 'mossy green plants', land_11: 'hot-air balloons over valley',
  };
  for (let i = 0; i < chosen.length; i++) {
    const src = chosen[i];
    const name = `scene_${String(i + 1).padStart(2, '0')}.jpg`;
    const buf = await sharp(LAND(src + '.jpg')).resize(1200, 1200, { fit: 'cover' })
      .sharpen().jpeg({ quality: 90 }).toBuffer();
    writeFileSync(path.join(dir, name), buf);
    const rel = `no_face/${name}`;
    hashes[rel] = await dhash(buf);
    add(rel, 'rejected', ['NO_FACE'], `${descr[src]}, no faces present`);
  }
}

// ============================================================================
// 7. UNSUPPORTED_FORMAT (~8): gif / bmp / tiff / webp (real magic bytes)
//    Derived from spare faces/landscapes that are NOT in any accepted/dup set.
// ============================================================================
{
  const dir = freshDir('unsupported_format');
  const specs = [
    { fmt: 'gif',  name: 'face_as_gif_01.gif' },
    { fmt: 'gif',  name: 'scene_as_gif_02.gif',  land: 'land_12' },
    { fmt: 'tiff', name: 'face_as_tiff_01.tiff' },
    { fmt: 'tiff', name: 'face_as_tiff_02.tiff' },
    { fmt: 'webp', name: 'face_as_webp_01.webp' },
    { fmt: 'bmp',  name: 'face_as_bmp_01.bmp' },
    { fmt: 'bmp',  name: 'face_as_bmp_02.bmp' },
    { fmt: 'gif',  name: 'face_as_gif_03.gif' },
  ];
  let idx = 59; // distinct spare face pool offset (faces 60..66)
  for (let i = 0; i < specs.length; i++) {
    const sp = specs[i];
    const srcBuf = sp.land
      ? await sharp(LAND(sp.land + '.jpg')).resize(900, 900, { fit: 'cover' }).toBuffer()
      : await sharp(FACE(idx++)).resize(900, 900, { fit: 'cover' }).toBuffer();
    const outPath = path.join(dir, sp.name);
    if (sp.fmt === 'bmp') {
      await writeBmp(srcBuf, 700, 700, outPath);
    } else {
      const buf = await sharp(srcBuf).toFormat(sp.fmt).toBuffer();
      writeFileSync(outPath, buf);
    }
    add(`unsupported_format/${sp.name}`, 'rejected', ['UNSUPPORTED_FORMAT'],
      `valid ${sp.fmt.toUpperCase()} magic bytes, format not in {JPEG,PNG,HEIC}`);
  }
}

// ============================================================================
// 8. HEIC (~6): REAL HEIF (ftypheic) from good single faces; should ACCEPT
// ============================================================================
let heicOk = false;
{
  const dir = freshDir('heic');
  let idx = 53; // distinct face pool offset (faces 54..59)
  for (let i = 0; i < 6; i++, idx++) {
    const tmpJpg = path.join(tmpdir(), `heicsrc_${i}.jpg`);
    await sharp(FACE(idx)).resize(1200, 1200, { fit: 'cover' }).sharpen()
      .jpeg({ quality: 95 }).toFile(tmpJpg);
    const name = `face_heic_${String(i + 1).padStart(2, '0')}.heic`;
    const outPath = path.join(dir, name);
    execFileSync('heif-enc', [tmpJpg, '-q', '90', '-o', outPath], { stdio: 'ignore' });
    rmSync(tmpJpg, { force: true });
    heicOk = true;
    add(`heic/${name}`, 'accepted', [],
      'real HEIF (ftypheic) single face ~30% of frame, allowed format, should pass');
  }
}

// ============================================================================
// 9. DUPLICATE (~8): near-duplicates of specific accepted/ sources
// ============================================================================
{
  const dir = freshDir('duplicate');
  // (sourceAcceptedIndex 0-based, kind)
  const jobs = [
    [2, 'exact'], [2, 'reencode'],          // face_03
    [6, 'reencode'], [6, 'resize'],          // face_07
    [14, 'crop2px'], [14, 'resize'],         // face_15
    [21, 'exact'], [21, 'reencode'],         // face_22
  ];
  // map accepted index -> its on-disk relative path + an editable sharp source
  const acceptedRel = i => manifest.find(m => m.file.startsWith('accepted/') &&
    m.file.includes(`face_${String(i + 1).padStart(2, '0')}.`)).file;

  for (let k = 0; k < jobs.length; k++) {
    const [ai, kind] = jobs[k];
    const srcRel = acceptedRel(ai);
    const srcPath = path.join(OUT, srcRel);
    const base = path.basename(srcRel).replace(/\.(jpg|png)$/, '');
    let buf, name;
    if (kind === 'exact') {
      buf = await sharp(srcPath).toBuffer();
      name = `${base}_copy.jpg`;
      if (srcRel.endsWith('.png')) { name = `${base}_copy.png`; }
    } else if (kind === 'reencode') {
      buf = await sharp(srcPath).jpeg({ quality: 70 }).toBuffer();
      name = `${base}_reencode_q70.jpg`;
    } else if (kind === 'resize') {
      const m = await sharp(srcPath).metadata();
      buf = await sharp(srcPath).resize(Math.round(m.width * 0.95)).jpeg({ quality: 88 }).toBuffer();
      name = `${base}_resized95.jpg`;
    } else if (kind === 'crop2px') {
      const m = await sharp(srcPath).metadata();
      buf = await sharp(srcPath)
        .extract({ left: 2, top: 2, width: m.width - 4, height: m.height - 4 })
        .jpeg({ quality: 90 }).toBuffer();
      name = `${base}_crop2px.jpg`;
    }
    writeFileSync(path.join(dir, name), buf);
    const rel = `duplicate/${name}`;
    hashes[rel] = await dhash(buf);
    const dist = ham(hashes[rel], hashes[srcRel]);
    add(rel, 'rejected', ['DUPLICATE'],
      `${kind} of ${srcRel} (dHash distance ${dist})`, { duplicateOf: srcRel });
  }
}

// ============================================================================
// write manifest + verification report
// ============================================================================
manifest.sort((a, b) => a.file.localeCompare(b.file));
writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// ---- self-verification ------------------------------------------------------
console.log('\n=== DUPLICATE distance check (should be <= 6) ===');
let dupBad = 0;
for (const m of manifest.filter(x => x.duplicateOf)) {
  const d = ham(hashes[m.file], hashes[m.duplicateOf]);
  const ok = d <= 6;
  if (!ok) dupBad++;
  console.log(`${ok ? 'OK ' : 'BAD'}  d=${String(d).padStart(2)}  ${m.file}  ~  ${m.duplicateOf}`);
}

// cross-category accidental-duplicate scan among hashed single-image fixtures
console.log('\n=== accidental cross-duplicate scan (accepted vs no_face vs dup-set) ===');
const hk = Object.keys(hashes);
let accidental = 0;
for (let i = 0; i < hk.length; i++) for (let j = i + 1; j < hk.length; j++) {
  const a = hk[i], b = hk[j];
  // expected duplicate pairs are fine
  const expected = manifest.find(m => (m.file === a && m.duplicateOf === b) ||
                                       (m.file === b && m.duplicateOf === a));
  if (expected) continue;
  const d = ham(hashes[a], hashes[b]);
  if (d <= 6) { accidental++; console.log(`WARN d=${d}  ${a}  ~  ${b}`); }
}
if (!accidental) console.log("none: no unexpected hash collisions");

const byCat = {};
for (const m of manifest) { const c = m.file.split('/')[0]; byCat[c] = (byCat[c] || 0) + 1; }
console.log('\n=== category breakdown ===');
for (const c of Object.keys(byCat).sort()) console.log(`${c.padEnd(20)} ${byCat[c]}`);
console.log('TOTAL'.padEnd(20), manifest.length);
console.log('\nheicOk =', heicOk, ' dupBad =', dupBad, ' accidental =', accidental);
