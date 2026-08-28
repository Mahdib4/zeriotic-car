#!/usr/bin/env node
/**
 * preview-profile.mjs
 *
 * Rasterises the real generated geometry to the terminal, viewed from the
 * side. This renders the actual BufferGeometry triangles — not an
 * approximation — so it is a true check that the procedural body reads as a
 * car before any of it reaches a GPU.
 *
 *   node scripts/preview-profile.mjs            # every vehicle
 *   node scripts/preview-profile.mjs sports     # just one
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, ".profile-build");

fs.rmSync(buildDir, { recursive: true, force: true });
const tsc = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
execFileSync(
  tsc,
  ["-p", "scripts/tsconfig.build.json", "--outDir", ".profile-build"],
  { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
);

const require_ = createRequire(import.meta.url);
const { vehicles } = require_(path.join(buildDir, "lib", "content.js"));
const geo = require_(path.join(buildDir, "components", "three", "geometry.js"));

const W = 108;
const H = 34;

/** Fill the triangles of a geometry into the grid, projected to Z/Y. */
function rasterise(grid, geometry, bounds, ch) {
  const pos = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index ? index.count : pos.count;
  const at = (i) => {
    const j = index ? index.getX(i) : i;
    return [pos.getZ(j), pos.getY(j)];
  };

  // +Z is the nose, and a car profile reads nose-right.
  const toPx = ([z, y]) => [
    ((z - bounds.zMin) / (bounds.zMax - bounds.zMin)) * (W - 1),
    ((bounds.yMax - y) / (bounds.yMax - bounds.yMin)) * (H - 1),
  ];

  for (let i = 0; i < count; i += 3) {
    const a = toPx(at(i));
    const b = toPx(at(i + 1));
    const c = toPx(at(i + 2));

    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));

    const d = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
    const area = d(a, b, c);
    if (Math.abs(area) < 1e-9) continue;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const p = [px + 0.5, py + 0.5];
        const w0 = d(b, c, p) / area;
        const w1 = d(c, a, p) / area;
        const w2 = d(a, b, p) / area;
        if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) grid[py][px] = ch;
      }
    }
  }
}

const only = process.argv[2];
const list = only ? vehicles.filter((v) => v.id === only) : vehicles;

for (const v of list) {
  const g = geo.vehicleGeometry(`preview-${v.id}`, v.proportions);
  const d = g.d;
  const p = v.proportions;

  const bounds = {
    zMin: -d.half - 0.35,
    zMax: d.half + 0.35,
    yMin: -0.06,
    yMax: p.roofY + 0.42,
  };

  const grid = Array.from({ length: H }, () => Array(W).fill(" "));

  // Body panels, each with its own character so the panel splits are visible.
  rasterise(grid, g.rearQuarterL, bounds, "R");
  rasterise(grid, g.frontQuarterL, bounds, "F");

  // The door geometry is authored around its hinge, so shift it back.
  const door = g.doorL.clone();
  door.translate(0, 0, g.hingeZ);
  rasterise(grid, door, bounds, "D");

  rasterise(grid, g.greenhouse, bounds, ":");

  const place = (geometry, pos, rot) => {
    const c = geometry.clone();
    if (rot) {
      c.rotateX(rot[0] || 0);
      c.rotateY(rot[1] || 0);
      c.rotateZ(rot[2] || 0);
    }
    c.translate(pos[0], pos[1], pos[2]);
    return c;
  };

  rasterise(grid, place(g.roof, [0, p.roofY + 0.02, (d.roofFrontZ + d.roofRearZ) / 2]), bounds, "=");
  rasterise(grid, place(g.hood, [0, g.hoodBridge.position[1] - 0.024, g.hoodBridge.position[2]], g.hoodBridge.rotation), bounds, "=");
  rasterise(grid, place(g.deck, [0, g.deckBridge.position[1] - 0.024, g.deckBridge.position[2]], g.deckBridge.rotation), bounds, "=");
  rasterise(grid, place(g.frontFascia, [0, d.sillY + (d.noseY - d.sillY) / 2, d.half - 0.1]), bounds, "N");
  rasterise(grid, place(g.rearFascia, [0, d.sillY + (d.tailY - d.sillY) / 2, -d.half + 0.1]), bounds, "T");

  // Wheels last, so they read on top of the arch openings.
  for (const z of [d.frontAxleZ, d.rearAxleZ]) {
    rasterise(grid, place(g.wheels.tire, [0, d.axleY, z]), bounds, "@");
    rasterise(grid, place(g.wheels.rim, [0, d.axleY, z]), bounds, "o");
  }

  console.log("");
  console.log(`  ${v.name}  —  ${v.category}`);
  console.log(
    `  length ${p.bodyLength}m   roof ${p.roofY}m   wheelbase ${p.wheelbase}m   ` +
      `wheel r ${p.wheelRadius}m   arch top ${d.archTop.toFixed(3)}m`,
  );
  console.log("  " + "-".repeat(W));
  for (const row of grid) console.log("  " + row.join(""));
  console.log("  " + "-".repeat(W) + "   (nose at right)");
}

fs.rmSync(buildDir, { recursive: true, force: true });
