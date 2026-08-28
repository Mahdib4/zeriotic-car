#!/usr/bin/env node
/**
 * land-clip.mjs — bring a finished Higgsfield render into the project.
 *
 *   node scripts/land-clip.mjs A0-010 https://.../render.mp4
 *
 * Downloads the clip under its manifest filename, then extracts its final
 * frame as the seed for the next shot in the chain. That extracted frame is
 * what gets passed to the next generation as `start_image`, and it is why the
 * film reads as one continuous take.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, ".land-build");
const clipDir = path.join(root, "public", "clips");
const seedDir = path.join(root, "public", "seed-frames");

const [shotId, url] = process.argv.slice(2);
if (!shotId || !url) {
  console.error("usage: node scripts/land-clip.mjs <SHOT_ID> <URL>");
  process.exit(1);
}

fs.rmSync(buildDir, { recursive: true, force: true });
const tsc = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
execFileSync(tsc, ["-p", "scripts/tsconfig.build.json", "--outDir", ".land-build"], {
  cwd: root,
  stdio: "pipe",
  shell: process.platform === "win32",
});

const require_ = createRequire(import.meta.url);
const { RESOLVED_SHOTS } = require_(path.join(buildDir, "lib", "shots.js"));
fs.rmSync(buildDir, { recursive: true, force: true });

const ordered = [...RESOLVED_SHOTS].sort((a, b) => a.globalFrom - b.globalFrom);
const idx = ordered.findIndex((s) => s.id === shotId);
if (idx === -1) {
  console.error(`No shot "${shotId}" in the manifest.`);
  process.exit(1);
}
const shot = ordered[idx];

fs.mkdirSync(clipDir, { recursive: true });
fs.mkdirSync(seedDir, { recursive: true });

const dest = path.join(clipDir, shot.file);
const dl = spawnSync("curl", ["-sSL", "--fail", "-o", dest, url], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (dl.status !== 0) {
  console.error(`Download failed: ${dl.stderr}`);
  process.exit(1);
}

const bytes = fs.statSync(dest).size;
console.log(`  ${shot.id}  ->  public/clips/${shot.file}  (${(bytes / 1_048_576).toFixed(1)} MB)`);

// The seed frame belongs to whichever shot chains off this one.
const next = ordered[idx + 1];
if (!next) {
  console.log("  last shot in the chain — no seed frame needed.");
  process.exit(0);
}
if (next.seed !== "chain") {
  console.log(`  next shot ${next.id} is anchor-seeded — no extraction needed.`);
  process.exit(0);
}
if (next.reuseOf) {
  console.log(`  next shot ${next.id} re-uses ${next.reuseOf} — no generation needed.`);
  process.exit(0);
}

const seedPath = path.join(seedDir, `${next.id}_seed.png`);
const ff = spawnSync(
  "ffmpeg",
  ["-y", "-sseof", "-0.05", "-i", dest, "-update", "1", "-frames:v", "1", "-q:v", "1", seedPath],
  { encoding: "utf8", shell: process.platform === "win32" },
);
if (ff.status !== 0) {
  console.error(`  ffmpeg failed:\n${ff.stderr?.split("\n").slice(-8).join("\n")}`);
  process.exit(1);
}

console.log(`  seed for ${next.id}  ->  public/seed-frames/${next.id}_seed.png`);
console.log(`  next: ${next.id}  ${next.mode} ${next.durationSec}s  ${next.credits}cr`);
console.log(`        ${next.description}`);
