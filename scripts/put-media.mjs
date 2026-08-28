#!/usr/bin/env node
/**
 * put-media.mjs — upload a seed frame to a Higgsfield presigned URL.
 *
 *   node scripts/put-media.mjs <file> <url-file>
 *
 * The presigned URL is long and full of characters a shell will mangle, so it
 * is passed via a file rather than as an argument. Write the URL returned by
 * `media_upload` to a file, then run this, then call `media_confirm`.
 */

import fs from "node:fs";
import path from "node:path";

const [file, urlFile] = process.argv.slice(2);
if (!file || !urlFile) {
  console.error("usage: node scripts/put-media.mjs <file> <url-file>");
  process.exit(1);
}

const url = fs.readFileSync(urlFile, "utf8").trim();
const bytes = fs.readFileSync(file);
const ext = path.extname(file).toLowerCase();
const contentType =
  ext === ".png" ? "image/png" : ext === ".mp4" ? "video/mp4" : "image/jpeg";

const res = await fetch(url, {
  method: "PUT",
  headers: { "Content-Type": contentType },
  body: bytes,
});

console.log(`PUT ${path.basename(file)} -> HTTP ${res.status}`);
if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}
