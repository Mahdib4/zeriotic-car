#!/usr/bin/env node
/**
 * verify-manifest.mjs
 *
 * Emits public/manifest/shot-manifest.csv from lib/shots.ts, and checks the
 * manifest for the three failure modes that would break the film:
 *
 *   1. Gaps    — a scroll range with no clip and no real-time act covering it.
 *   2. Overlaps— two clips claiming the same scroll position.
 *   3. Budget  — first-pass credit total exceeding the available balance.
 *
 * It also reports which clips are present on disk, so you can see how much of
 * the film is still running on the real-time placeholder path.
 *
 *   npm run manifest
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, ".manifest-build");

/* -- compile the TS sources to CommonJS so this script can read them ---- */
function compile() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  const tsc = path.join(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsc.cmd" : "tsc",
  );
  execFileSync(
    tsc,
    ["-p", "scripts/tsconfig.build.json", "--outDir", ".manifest-build"],
    { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
  );
}

compile();

const require_ = createRequire(import.meta.url);
const shots = require_(path.join(buildDir, "lib", "shots.js"));
const timeline = require_(path.join(buildDir, "lib", "timeline.js"));

const { RESOLVED_SHOTS, STILLS, BUDGET, effectiveDuration } = shots;
const { ACT_LIST, TOTAL_VH, validateHandoffs } = timeline;

/* -- CSV ---------------------------------------------------------------- */

const csvEscape = (v) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const header = [
  "shot_id",
  "act",
  "file",
  "scroll_from_pct",
  "scroll_to_pct",
  "tier",
  "model",
  "mode",
  "duration_sec",
  "credits",
  "seed",
  "anchor_still",
  "reuse_of",
  "description",
];

const rows = RESOLVED_SHOTS.map((s) => [
  s.id,
  s.act,
  s.file,
  (s.globalFrom * 100).toFixed(2),
  (s.globalTo * 100).toFixed(2),
  s.tier,
  s.model,
  s.mode,
  s.durationSec,
  s.credits,
  s.seed,
  s.anchorStill ?? "",
  s.reuseOf ?? "",
  s.description,
]);

const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";

const outDir = path.join(root, "public", "manifest");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "shot-manifest.csv"), csv, "utf8");

/* -- checks ------------------------------------------------------------- */

const problems = [];
const notes = [];

// Overlaps, within the sorted list.
const sorted = [...RESOLVED_SHOTS].sort((a, b) => a.globalFrom - b.globalFrom);
for (let i = 1; i < sorted.length; i++) {
  const prev = sorted[i - 1];
  const cur = sorted[i];
  if (cur.globalFrom < prev.globalTo - 1e-9) {
    problems.push(
      `Overlap: ${prev.id} ends at ${(prev.globalTo * 100).toFixed(2)}% but ` +
        `${cur.id} starts at ${(cur.globalFrom * 100).toFixed(2)}%.`,
    );
  }
}

// Gaps. Every act is now covered by clips; nothing is intentionally
// clip-free. Add an act id here if that ever changes again.
const REALTIME_ACTS = new Set([]);
let cursor = 0;
for (const s of sorted) {
  if (s.globalFrom > cursor + 1e-6) {
    const act = ACT_LIST.find(
      (a) => cursor >= a.start - 1e-9 && cursor < a.end - 1e-9,
    );
    if (!act || !REALTIME_ACTS.has(act.id)) {
      problems.push(
        `Gap: no clip covers ${(cursor * 100).toFixed(2)}% – ` +
          `${(s.globalFrom * 100).toFixed(2)}% (act "${act ? act.id : "?"}").`,
      );
    } else {
      notes.push(
        `Real-time span: ${(cursor * 100).toFixed(2)}% – ` +
          `${(s.globalFrom * 100).toFixed(2)}% is act "${act.id}", clip-free by design.`,
      );
    }
  }
  cursor = Math.max(cursor, s.globalTo);
}

// Camera hand-off continuity.
problems.push(...validateHandoffs());

// Playback-rate uniformity. Each clip's scroll span should be proportional to
// its duration, so the film advances at a constant frames-per-vh. A clip that
// is given too little scroll plays fast and demands a proportionally higher
// seek rate, which is a guaranteed stutter — A1-090 once had three times the
// frames-per-vh of its neighbours because the act's fractions had
// mis-accumulated, and it read as a lurch at the end of the assembly act.
{
  const byAct = new Map();
  for (const s2 of RESOLVED_SHOTS) {
    if (s2.reuseOf) continue;
    const span = (s2.globalTo - s2.globalFrom) * TOTAL_VH;
    if (span <= 0) continue;
    if (!byAct.has(s2.act)) byAct.set(s2.act, []);
    // Trimmed seconds, not file seconds — a shot given scroll for footage it
    // never plays would read as running slow.
    byAct.get(s2.act).push({ id: s2.id, rate: (effectiveDuration(s2) * 24) / span });
  }
  for (const [act, entries] of byAct) {
    if (entries.length < 2) continue;
    const rates = entries.map((e) => e.rate).sort((a, b) => a - b);
    const median = rates[Math.floor(rates.length / 2)];
    for (const e of entries) {
      const drift = Math.abs(e.rate - median) / median;
      if (drift > 0.25) {
        problems.push(
          `Playback rate: ${e.id} runs at ${e.rate.toFixed(2)} frames/vh but act ` +
            `"${act}" sits at ${median.toFixed(2)} (${(drift * 100).toFixed(0)}% off). ` +
            `Give it scroll span proportional to its duration.`,
        );
      }
    }
  }
}

/* -- budget ------------------------------------------------------------- */

const firstPass = BUDGET.firstPass;
const buffer = BUDGET.correctionBuffer;
if (BUDGET.totalSpent > BUDGET.accountBalance) {
  problems.push(
    `Budget: ${BUDGET.totalSpent} credits committed but only ` +
      `${BUDGET.accountBalance} were available.`,
  );
}
if (BUDGET.totalSpent > BUDGET.briefCeiling) {
  problems.push(
    `Budget: ${BUDGET.totalSpent} credits committed, over the ${BUDGET.briefCeiling}-credit brief ceiling.`,
  );
}

/* -- assets on disk ----------------------------------------------------- */

const clipDir = path.join(root, "public", "clips");
const present = new Set(
  fs.existsSync(clipDir) ? fs.readdirSync(clipDir).filter((f) => f.endsWith(".mp4")) : [],
);
const wanted = new Set(RESOLVED_SHOTS.map((s) => s.file));
const have = [...wanted].filter((f) => present.has(f));

/* -- report ------------------------------------------------------------- */

const pct = (n) => `${((n / TOTAL_VH) * 100).toFixed(1)}%`;
void pct;

console.log("");
console.log("  Shot manifest");
console.log("  " + "-".repeat(64));
console.log(`  Shots            ${RESOLVED_SHOTS.length}`);
console.log(`  Anchor stills    ${STILLS.length}`);
console.log(`  Scroll length    ${TOTAL_VH}vh across ${ACT_LIST.length} acts`);
console.log(`  CSV              public/manifest/shot-manifest.csv`);
console.log("");
console.log("  Credits");
console.log("  " + "-".repeat(64));
console.log(`  Stills           ${BUDGET.stills}`);
console.log(`  Tier 1           ${BUDGET.tier1}`);
console.log(`  Tier 2           ${BUDGET.tier2}`);
console.log(`  Act 5            0   (DOM configurator over footage)`);
console.log(`  Shots subtotal   ${firstPass}`);
console.log(`  Re-generations   ${BUDGET.corrections}`);
console.log(`  Total spent      ${BUDGET.totalSpent}`);
console.log(`  Opening balance  ${BUDGET.accountBalance}`);
console.log(`  Remaining        ${buffer.toFixed(2)}`);
console.log("");
console.log("  Assets");
console.log("  " + "-".repeat(64));
console.log(`  Clips on disk    ${have.length} / ${wanted.size}`);
if (have.length < wanted.size) {
  console.log(`  Missing clips fall back to the real-time scene automatically.`);
}
console.log("");

for (const n of notes) console.log(`  note: ${n}`);
if (notes.length) console.log("");

if (problems.length) {
  console.error("  PROBLEMS");
  console.error("  " + "-".repeat(64));
  for (const p of problems) console.error(`  ! ${p}`);
  console.error("");
  fs.rmSync(buildDir, { recursive: true, force: true });
  process.exit(1);
}

console.log("  Manifest OK.\n");
fs.rmSync(buildDir, { recursive: true, force: true });
