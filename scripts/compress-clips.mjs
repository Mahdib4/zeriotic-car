#!/usr/bin/env node
/**
 * compress-clips.mjs — prepare the raw renders for scroll scrubbing.
 *
 * Always encodes from `public/clips-raw` (the untouched masters), so it is
 * safe to re-run with different settings and never compounds generation loss.
 * It produces TWO renditions:
 *
 *   public/clips      1920x1080  CRF 23  High profile  L4.0   ~6.7 MB / 12s
 *   public/clips-720  1280x720   CRF 25  Main profile  L3.1   ~3.1 MB / 12s
 *
 * Four things are being balanced, and two of them were got wrong the first
 * time in ways that only showed up off local disk.
 *
 *  1. DIMENSIONS ARE A HARD COMPATIBILITY LIMIT, NOT A TASTE QUESTION.
 *     Higgsfield `pro` renders at 1928x1076. That is eight pixels wider than
 *     1080p, and those eight pixels were the worst bug in this pipeline.
 *     H.264 counts a frame in 16x16 macroblocks, so 1928x1076 pads to
 *     1936x1088 = 8228 macroblocks — over Level 4.0's ceiling of 8192. x264
 *     therefore tags the stream Level 5.0.
 *
 *     Mobile SoCs guarantee hardware decode to Level 4.0/4.1 at 1080p. Above
 *     it they may fall back to software, and software-decoding 1080p H.264
 *     while scrubbing is not something a phone can do. Fifteen of the
 *     twenty-six clips shipped that way and the site was unusable on a phone.
 *     1920x1080 is 8160 macroblocks and tags Level 4.0.
 *
 *     Every clip is now scaled to exactly the same dimensions, for the same
 *     reason they all use one codec: switching between clips of differing
 *     sizes can force the decoder to reconfigure at the moment of a cut.
 *
 *  2. SEEK COST, which is what decides whether a scrubbed film feels smooth.
 *     `video.currentTime` can only land on a keyframe, so every seek decodes
 *     forward from the preceding one — but a denser keyframe pattern also
 *     makes the file bigger, and past a point the bytes cost more than the
 *     shorter decode chain saves. Measured in Chrome, 120 random seeks each:
 *
 *       keyframe every   mean     p95      size/12s   SSIM vs master
 *       15 frames        7.65ms   15.1ms   —          —
 *        3 frames        4.78ms    7.5ms   9.2 MB     0.99222
 *        6 frames        3.74ms    5.0ms   6.7 MB     0.99226
 *       12 frames        4.03ms    5.4ms   5.4 MB     0.99216
 *
 *     Six wins on every axis at once: a third fewer bytes than three, a third
 *     faster to seek, and fractionally better SSIM. This file previously
 *     defaulted to 3 on the strength of a table that jumped from 3 straight to
 *     15 and never measured the middle — where the optimum turned out to be.
 *     The crossover is real: at a keyframe every three frames a third of all
 *     frames are I-frames, and the file gets large enough that I/O and parsing
 *     put back more than the short decode chains save.
 *
 *     B-frames stay disabled. They decode out of order, so landing on one
 *     costs an extra reference frame for no benefit when scrubbing.
 *
 *  3. BITRATE IS A LATENCY COST. The clips are served from object storage and
 *     nothing can be scrubbed until it arrives, so bytes are not a storage
 *     question — they are the wait at every shot boundary. CRF 23 measures
 *     SSIM 0.9926 against the master versus 0.9944 at CRF 20, and resolution
 *     is held at 1080p on desktop, which is the thing viewers notice.
 *
 *  4. RESOLUTION PARITY. Higgsfield `std` renders at 1284x716 and `pro` at
 *     1928x1076. Left alone the browser upscales the std clips with cheap
 *     bilinear filtering mid-scroll and they read as visibly softer than the
 *     pro clips around them. Anything under target is upscaled with lanczos
 *     plus a light unsharp instead. This does NOT add real detail — only
 *     regenerating in `pro` mode does that — but it removes the mismatch.
 *
 *   node scripts/compress-clips.mjs               # both renditions
 *   node scripts/compress-clips.mjs --only hd     # desktop only
 *   node scripts/compress-clips.mjs --only sd     # mobile only
 *   node scripts/compress-clips.mjs --gop 12      # smaller, marginally slower
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = path.join(root, "public", "clips-raw");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

/** Keyframe every N frames. See note 2 — 6 is measured, not guessed. */
const GOP = flag("gop", "6");
const ONLY = flag("only", "");

/**
 * The two renditions.
 *
 * `sd` exists because a phone is not a small desktop. It has a fraction of the
 * decode budget, a fraction of the bandwidth, and a screen on which 720p and
 * 1080p are indistinguishable. It is 70% fewer bytes and tags Level 3.1, which
 * every mobile decoder made this decade accelerates in hardware.
 */
const PROFILES = [
  { id: "hd", dir: "clips", w: 1920, h: 1080, level: "4.0", h264: "high", crfFlag: "crf", crfDefault: "23" },
  { id: "sd", dir: "clips-720", w: 1280, h: 720, level: "3.1", h264: "main", crfFlag: "crf-sd", crfDefault: "25" },
];

if (!fs.existsSync(rawDir)) {
  console.error(`No masters in ${rawDir}. Nothing to encode.`);
  process.exit(1);
}

const probe = (file) => {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  const [w, h] = (r.stdout || "").trim().split(",").map(Number);
  return { w: w || 0, h: h || 0 };
};

const clips = fs.readdirSync(rawDir).filter((f) => f.endsWith(".mp4")).sort();

for (const prof of PROFILES) {
  if (ONLY && ONLY !== prof.id) continue;
  const crf = flag(prof.crfFlag, prof.crfDefault);
  const outDir = path.join(root, "public", prof.dir);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(
    `\n  ${prof.id.toUpperCase()}  ${clips.length} clips -> public/${prof.dir}` +
      `  (${prof.w}x${prof.h}, crf ${crf}, keyframe every ${GOP}, no b-frames)\n`,
  );

  let after = 0;
  for (const file of clips) {
    const src = path.join(rawDir, file);
    const dst = path.join(outDir, file);
    const { w } = probe(src);

    // Upscaling a smaller master needs the unsharp; downscaling never does.
    const filters = [`scale=${prof.w}:${prof.h}:flags=lanczos`];
    if (w > 0 && w < prof.w) filters.push("unsharp=5:5:0.5:5:5:0.0");

    const res = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-i", src,
        "-vf", filters.join(","),
        "-c:v", "libx264",
        "-crf", crf,
        "-preset", "slow",
        // Pin profile and level explicitly. Left to itself x264 picks the
        // lowest level the stream happens to fit, which is how 1928px footage
        // ended up tagged 5.0 — see note 1. Being explicit means a future
        // change to resolution fails loudly here rather than silently
        // shipping something a phone cannot decode in hardware.
        "-profile:v", prof.h264,
        "-level:v", prof.level,
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
    after += dstBytes;
    console.log(`  ${file.padEnd(42)} ${(dstBytes / 1048576).toFixed(1).padStart(6)} MB`);
  }

  console.log(`\n  public/${prof.dir}: ${(after / 1048576).toFixed(0)} MB\n`);
}
