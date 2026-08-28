#!/usr/bin/env node
/**
 * build-check.mjs — a production build that cannot disturb a running dev server.
 *
 * `next build` and `next dev` both write to .next. Running a build while dev is
 * up leaves the dev server serving chunk ids that no longer exist, which shows
 * up in the browser as 404s and
 * `__webpack_modules__[moduleId] is not a function`, and the only cure is
 * restarting dev. Building into .next-check instead keeps the two apart.
 *
 *   npm run build:check
 */

import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, BUILD_DIST_DIR: ".next-check" },
});
process.exit(r.status ?? 1);
