# Image-validation test fixtures

A labelled fixture library (~100 images) for the headshot-intake image-validation
pipeline. Every image is described in [`manifest.json`](./manifest.json), which is
the source of truth that drives the automated test suite.

## Rules under test

An image is **ACCEPTED** only if it passes **all** of the following. Otherwise it
is **REJECTED** with one or more reason codes:

| Reason code          | Triggered when                                                      |
| -------------------- | ------------------------------------------------------------------- |
| `LOW_RESOLUTION`     | min edge < 512 px **or** file < ~10 KB                              |
| `UNSUPPORTED_FORMAT` | not JPEG / PNG / HEIC (verified by magic bytes)                     |
| `DUPLICATE`          | perceptual-hash Hamming distance ≤ 6 to another image in the set    |
| `BLURRY`             | variance-of-Laplacian below threshold                              |
| `FACE_TOO_SMALL`     | largest detected face area < 12 % of image area                    |
| `MULTIPLE_FACES`     | more than one face detected                                        |
| `NO_FACE`            | zero faces detected                                                |

## Category breakdown (105 images)

| Folder                | Count | Expected verdict        | What it exercises                                                |
| --------------------- | ----- | ----------------------- | --------------------------------------------------------------- |
| `accepted/`           | 30    | accepted                | good single-face headshots, face ~30-38 % of frame, 1000-1600 px, JPEG & PNG |
| `blurry/`             | 12    | rejected `BLURRY`       | gaussian blur σ = 3-10 (σ ≤ 3 are deliberately borderline)      |
| `low_resolution/`     | 11    | rejected `LOW_RESOLUTION` | downscaled below 512 px min edge; one is also `BLURRY` (multi-reason) |
| `face_too_small/`     | 10    | rejected `FACE_TOO_SMALL` | a small sharp face on a large high-frequency canvas (~2-5 % of frame) |
| `multiple_faces/`     | 10    | rejected `MULTIPLE_FACES` | 2-3 distinct faces composited side by side                     |
| `no_face/`            | 10    | rejected `NO_FACE`      | faceless landscapes / objects                                   |
| `unsupported_format/` | 8     | rejected `UNSUPPORTED_FORMAT` | real GIF / BMP / TIFF / WEBP magic bytes                  |
| `heic/`               | 6     | **accepted**            | real HEIF (`ftypheic`) single-face photos; HEIC is allowed      |
| `duplicate/`          | 8     | rejected `DUPLICATE`    | exact / re-encoded / resized / 2-px-cropped copies of `accepted/` images |
| **Total**             | **105** |                       |                                                                 |

## Sources

- **Faces** (78 unique): `https://thispersondoesnotexist.com/random-person.jpeg`
  StyleGAN/FFHQ-aligned synthetic faces. Every face is unique, so single-face
  fixtures never collide with each other. (These are AI-generated; no real person
  is depicted.)
- **Non-face scenes** (12): `https://picsum.photos/1024/1024`, random landscapes
  and objects. One download (`land_06`, a crowd) was discarded because it
  contained people; the 10 used in `no_face/` were visually confirmed faceless.
- Raw downloads are **not** shipped; only the derived fixtures + manifest +
  generator are.

## How it was generated

All derivation is done with [`sharp`](https://github.com/lovell/sharp); HEIC is
encoded with `heif-enc` (libheif). Run via `_generate.mjs` (kept here for
reproducibility; its `node_modules` lives in the scratch build dir, not in the
repo). Re-running it rebuilds every category folder and `manifest.json`.

```
node _generate.mjs          # expects ./raw/faces/*.jpg and ./raw/landscapes/*.jpg
```

The script self-verifies: it prints every `DUPLICATE` Hamming distance (all ≤ 6),
scans for accidental cross-category hash collisions, and prints the category
breakdown.

## Expected-verdict philosophy

- **One primary defect per fixture.** Each rejected image is engineered so a
  single rule fires, keeping tests unambiguous. The one intentional exception is
  `low_resolution/face_lowres_blur_150x150.jpg`, labelled
  `["LOW_RESOLUTION","BLURRY"]`, to exercise multi-reason reporting.
- **Disjoint source pools prevent accidental duplicates.** `accepted`, `blurry`,
  `low_resolution`, `heic` and the face-based `unsupported_format` images each use
  a *different* set of unique faces. This matters because a perceptual hash (dHash)
  barely changes under blur or downscaling; if a blurred image reused an accepted
  face it would also trip `DUPLICATE`. Only the `duplicate/` folder reuses
  `accepted/` sources, on purpose, and each entry carries a `duplicateOf` field.
- **`face_too_small` uses a random-noise background** (not a flat pad and not a
  real photo). Flat padding would tank the global variance-of-Laplacian and read
  as `BLURRY`; a real photo background could perceptual-hash-match a `no_face`
  scene and read as `DUPLICATE`. High-frequency noise keeps the image "sharp",
  face-free in the background, and hash-unique, so only `FACE_TOO_SMALL` fires.
- **HEIC is an allowed format**, so the `heic/` photos are good single-face shots
  and are expected to be **accepted**.

## Caveats

- **Borderline blur.** `blurry/*_sigma3.*` images are intentionally near the
  threshold; whether they reject depends on the exact variance-of-Laplacian cutoff.
  They are flagged in their manifest `notes`.
- **Face-detector dependence.** `accepted`, `face_too_small`, `multiple_faces` and
  `blurry` labels assume a reasonable face detector. The `accepted` faces were
  visually QA'd to each contain exactly one dominant, clearly-detectable face;
  the strongly-blurred σ = 10 face is still recognizable but is the most likely to
  test a detector's lower limit.
- **Face-area %** for `accepted` / `face_too_small` is estimated geometrically
  from the FFHQ alignment (face box ≈ 30 % of a full-frame crop), not from a live
  detector, since generation runs without one.
- **DUPLICATE semantics.** Distances were computed with a 64-bit dHash. A pipeline
  using pHash/aHash should see equivalent (very small) distances for these copies,
  but the exact numbers may differ.
