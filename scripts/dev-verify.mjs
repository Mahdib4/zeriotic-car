#!/usr/bin/env node
/**
 * dev-verify.mjs — a second dev server that shares nothing with the first.
 *
 * Two `next dev` instances (or a dev server and a build) both writing .next
 * corrupt each other's chunk manifests. This one runs on port 3100 with its
 * own distDir, so it can be used to verify changes while the primary dev
 * server on :3000 keeps running untouched.
 */

import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["next", "dev", "-p", "3100"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, BUILD_DIST_DIR: ".next-verify" },
});
process.exit(r.status ?? 1);
