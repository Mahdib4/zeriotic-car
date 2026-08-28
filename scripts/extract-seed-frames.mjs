#!/usr/bin/env node
/**
 * extract-seed-frames.mjs
 *
 * The hand-off rule, mechanised. For every shot in the manifest marked
 * `seed: "chain"`, this pulls the LAST frame of the preceding clip and writes
 * it to public/seed-frames/<shot-id>_seed.png. That frame is then uploaded to
 * Higgsfield and passed as `start_image` for the next generation, which is
 * what makes the whole film read as one continuous take rather than a
 * sequence of cuts.
 *
 * Extraction costs zero credits. Only shots marked `seed: "anchor"` need a
 * generated still, and there are three of them.
 *
 *   npm run seed-frames             # every chained shot with a source on disk
 *   npm run seed-frames -- A1-040   # just one
 *
 * Requires ffmpeg on PATH.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, ".seed-build");
const clipDir = path.join(root, "public", "clips");
const outDir = path.join(root, "public", "seed-frames");

/* -- ffmpeg present? ---------------------------------------------------- */
const probe = spawnSync("ffmpeg", ["-version"], { encoding: "utf8", shell: process.platform === "win32" });
if (probe.status !== 0) {
  console.error("\n  ffmpeg is not on PATH. Install it, then re-run.\n");
  process.exit(1);
}

/* -- read the manifest -------------------------------------------------- */
fs.rmSync(buildDir, { recursive: true, force: true });
const tsc = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
execFileSync(tsc, ["-p", "scripts/tsconfig.build.json", "--outDir", ".seed-build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

const require_ = createRequire(import.meta.url);
const { RESOLVED_SHOTS } = require_(path.join(buildDir, "lib", "shots.js"));

const only = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });

const ordered = [...RESOLVED_SHOTS].sort((a, b) => a.globalFrom - b.globalFrom);
let written = 0;
let skipped = 0;

console.log("");
for (let i = 0; i < ordered.length; i++) {
  const shot = ordered[i];
  if (only && shot.id !== only) continue;

  if (shot.seed === "anchor") {
    console.log(`  ${shot.id}  anchor — seeded by generated still ${shot.anchorStill}`);
    continue;
  }

  const prev = ordered[i - 1];
  if (!prev) {
    console.log(`  ${shot.id}  has no preceding shot to chain from`);
    continue;
  }

  const source = path.join(clipDir, prev.file);
  if (!fs.existsSync(source)) {
    console.log(`  ${shot.id}  waiting on ${prev.file}`);
    skipped++;
    continue;
  }

  const dest = path.join(outDir, `${shot.id}_seed.png`);
  // -sseof -0.05 seeks relative to the end; -update 1 keeps overwriting the
  // single output so we land on the genuine final frame.
  const res = spawnSync(
    "ffmpeg",
    ["-y", "-sseof", "-0.05", "-i", source, "-update", "1", "-frames:v", "1", "-q:v", "1", dest],
    { encoding: "utf8", shell: process.platform === "win32" },
  );

  if (res.status !== 0) {
    console.error(`  ${shot.id}  FAILED\n${res.stderr?.split("\n").slice(-6).join("\n")}`);
    continue;
  }

  console.log(`  ${shot.id}  <- last frame of ${prev.file}`);
  written++;
}

console.log("");
console.log(`  ${written} seed frame(s) written to public/seed-frames/`);
if (skipped) console.log(`  ${skipped} still waiting on their source clip.`);
console.log("");

fs.rmSync(buildDir, { recursive: true, force: true });
