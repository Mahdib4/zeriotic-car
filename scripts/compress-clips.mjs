#!/usr/bin/env node
/**
 * compress-clips.mjs — prepare the raw renders for scroll scrubbing.
 *
 * Always encodes from `public/clips-raw` (the untouched masters) into
 * `public/clips`, so it is safe to re-run with different settings and never
 * compounds generation loss.
 *
 * Three things are being balanced:
 *
 *  1. Quality. These are gloss paint and chrome reflections on near-black
 *     backgrounds — the worst case for H.264 banding. CRF 20 is the point
 *     where artefacts stop being visible; CRF 18 costs another 30% in size
 *     for almost nothing.
 *
 *  2. Seek cost, which is what actually decides whether a scrubbed film feels
 *     smooth. `video.currentTime` can only land on a keyframe, so every seek
 *     decodes forward from the preceding one. Measured in Chrome, 120 random
 *     seeks into this footage at 1080p:
 *
 *       keyframe every   mean     p95      p99      worst    frames blown
 *       15 frames        7.65ms   15.1ms   18.1ms   18.7ms   2.5%
 *        3 frames        3.75ms    4.8ms    5.0ms    6.5ms   0%
 *        2 frames        3.96ms    4.9ms   10.5ms   14.3ms   0%
 *        every frame     3.88ms    8.2ms   15.3ms   18.8ms   0.8%
 *
 *     The mean was never the problem — the tail was. At a keyframe every 15
 *     frames, one seek in forty overruns a 16.7ms frame and the picture
 *     visibly sticks. Every-frame keyframes are not the answer either: the
 *     files get big enough that I/O puts the tail back. Three is the floor.
 *
 *     B-frames are disabled for the same reason. They decode out of order, so
 *     landing on one costs an extra reference frame for no benefit here.
 *
 *  3. Resolution parity. Higgsfield `std` renders at 1284x716 and `pro` at
 *     1928x1076. Left alone, the browser upscales the std clips with cheap
 *     bilinear filtering mid-scroll, and they read as visibly softer than the
 *     pro clips around them. Anything under 1920 wide is upscaled here with
 *     lanczos plus a light unsharp instead. This does NOT add real detail —
 *     only regenerating in `pro` mode does that — but it removes the
 *     resolution mismatch and the mushy GPU upscale.
 *
 *   node scripts/compress-clips.mjs              # CRF 20, keyframe every 3
 *   node scripts/compress-clips.mjs --crf 18     # higher quality, bigger
 *   node scripts/compress-clips.mjs --gop 15     # smaller, worse scrubbing
 *   node scripts/compress-clips.mjs --no-upscale # leave std clips native
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = path.join(root, "public", "clips-raw");
const outDir = path.join(root, "public", "clips");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const CRF = flag("crf", "20");
/** Keyframe every N frames. See note 2 above — 3 is measured, not guessed. */
const GOP = flag("gop", "3");
const UPSCALE = !args.includes("--no-upscale");
const TARGET_W = 1920;
const TARGET_H = 1080;

if (!fs.existsSync(rawDir)) {
  console.error(`No masters in ${rawDir}. Nothing to encode.`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const probe = (file) => {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  const [w, h] = (r.stdout || "").trim().split(",").map(Number);
  return { w: w || 0, h: h || 0 };
};

const clips = fs.readdirSync(rawDir).filter((f) => f.endsWith(".mp4"));
let before = 0;
let after = 0;
let upscaled = 0;

console.log(
  `\n  Encoding ${clips.length} clips from masters  (crf ${CRF}, keyframe every ${GOP} frames, no b-frames)\n`,
);

for (const file of clips) {
  const src = path.join(rawDir, file);
  const dst = path.join(outDir, file);
  const srcBytes = fs.statSync(src).size;
  const { w } = probe(src);

  const needsUpscale = UPSCALE && w > 0 && w < TARGET_W;
  const filters = needsUpscale
    ? [`scale=${TARGET_W}:${TARGET_H}:flags=lanczos`, "unsharp=5:5:0.5:5:5:0.0"]
    : [];

  const res = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i", src,
      ...(filters.length ? ["-vf", filters.join(",")] : []),
      "-c:v", "libx264",
      "-crf", CRF,
      "-preset", "slow",
      // Set through x264-params as well as the ffmpeg flags: -g alone still
      // lets x264 insert extra keyframes on scene cuts, which makes the GOP
      // length non-uniform and puts the seek-cost tail back.
      "-x264-params", `keyint=${GOP}:min-keyint=${GOP}:scenecut=0:bframes=0`,
      "-bf", "0",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      // The brief specifies no audio anywhere on this site.
      "-an",
      dst,
    ],
    { encoding: "utf8", shell: process.platform === "win32" },
  );

  if (res.status !== 0) {
    console.error(`  ${file}  FAILED`);
    console.error(res.stderr?.split("\n").slice(-6).join("\n"));
    continue;
  }

  const dstBytes = fs.statSync(dst).size;
  before += srcBytes;
  after += dstBytes;
  if (needsUpscale) upscaled++;

  console.log(
    `  ${file.padEnd(42)} ${(dstBytes / 1048576).toFixed(1).padStart(6)} MB` +
      (needsUpscale ? `  (upscaled ${w}px -> ${TARGET_W}px)` : ""),
  );
}

console.log("");
console.log(`  Masters ${(before / 1048576).toFixed(0)} MB  ->  shipped ${(after / 1048576).toFixed(0)} MB`);
if (upscaled) {
  console.log(`  ${upscaled} std-mode clips upscaled to ${TARGET_W}x${TARGET_H}.`);
  console.log(`  For true detail at this resolution they must be regenerated in pro mode.`);
}
console.log("");
