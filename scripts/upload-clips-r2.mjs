#!/usr/bin/env node
/**
 * upload-clips-r2.mjs — push both clip renditions to a Cloudflare R2 bucket.
 *
 * public/clips and public/clips-720 go up under matching key prefixes, so one
 * public base URL serves the desktop and mobile cuts of the film.
 *
 * R2 speaks the S3 API, so this signs requests with AWS SigV4 using Node's
 * built-in crypto. No SDK: @aws-sdk/client-s3 is ~20MB of node_modules for a
 * script that makes 52 PUTs.
 *
 * Credentials come from the environment (see .env.local, gitignored):
 *
 *   R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY  R2_BUCKET
 *
 * Two things about the headers matter more than they look:
 *
 *   Cache-Control  The clips never change once generated — a new cut gets a
 *                  new filename. Marking them immutable for a year means a
 *                  returning visitor re-downloads nothing, which on 286MB of
 *                  video is the difference between a fast second visit and a
 *                  slow one.
 *
 *   Content-Type   Must be video/mp4. If R2 serves these as
 *                  application/octet-stream the browser will not treat them as
 *                  media, and `video.currentTime` scrubbing — the entire site —
 *                  stops working.
 *
 *   node scripts/upload-clips-r2.mjs            # upload everything
 *   node scripts/upload-clips-r2.mjs --dry-run  # list what would go
 *   node scripts/upload-clips-r2.mjs --verify   # check what is already there
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Both renditions, uploaded under keys that mirror their local directories so
 * `clipSrc` in lib/shots.ts can build either URL from the same base.
 *
 * `clips-720` is what phones fetch. It is a separate set of objects rather
 * than a transform of the first because R2 has no image or video pipeline in
 * front of it — what is in the bucket is what is served.
 */
const RENDITIONS = [
  { dir: path.join(root, "public", "clips"), prefix: "clips" },
  { dir: path.join(root, "public", "clips-720"), prefix: "clips-720" },
];

/* -- env ---------------------------------------------------------------- */

// Minimal .env.local reader. Next loads it for the app; a plain node script
// does not get it for free.
function loadEnv() {
  const f = path.join(root, ".env.local");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const ACCOUNT = process.env.R2_ACCOUNT_ID;
const KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const VERIFY_ONLY = args.includes("--verify");

if (!DRY && (!ACCOUNT || !KEY_ID || !SECRET || !BUCKET)) {
  console.error(
    "\n  Missing R2 credentials. Set these in .env.local:\n" +
      "    R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY  R2_BUCKET\n",
  );
  process.exit(1);
}

const HOST = `${ACCOUNT}.r2.cloudflarestorage.com`;
const REGION = "auto";
const SERVICE = "s3";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

/* -- SigV4 -------------------------------------------------------------- */

const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
const hmac = (k, s) => crypto.createHmac("sha256", k).update(s).digest();

function signingKey(dateStamp) {
  return hmac(
    hmac(hmac(hmac(`AWS4${SECRET}`, dateStamp), REGION), SERVICE),
    "aws4_request",
  );
}

/** Encode a key the way S3 canonicalises it: percent-encoded, `/` preserved. */
const encodeKey = (key) => key.split("/").map(encodeURIComponent).join("/");

/**
 * Sign and send one request. `host` is signed but deliberately not passed to
 * fetch — it is a forbidden header there, and undici sets it from the URL to
 * exactly the same value.
 */
async function signedFetch(method, key, { body = "", extraHeaders = {} } = {}) {
  const canonicalUri = `/${BUCKET}/${encodeKey(key)}`;
  const amzDate = new Date()
    .toISOString()
    .replace(/[:-]/g, "")
    .replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);

  const signed = {
    host: HOST,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders,
  };

  const names = Object.keys(signed)
    .map((n) => n.toLowerCase())
    .sort();
  const lower = {};
  for (const [k, v] of Object.entries(signed)) lower[k.toLowerCase()] = v;

  const canonicalHeaders = names
    .map((n) => `${n}:${String(lower[n]).trim()}\n`)
    .join("");
  const signedHeaders = names.join(";");

  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");

  const signature = crypto
    .createHmac("sha256", signingKey(dateStamp))
    .update(stringToSign)
    .digest("hex");

  const sendHeaders = { ...lower };
  delete sendHeaders.host;
  sendHeaders.Authorization =
    `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(`https://${HOST}${canonicalUri}`, {
    method,
    headers: sendHeaders,
    body: method === "PUT" ? body : undefined,
  });
}

/* -- work --------------------------------------------------------------- */

/** One entry per object to upload, across every rendition. */
const files = [];
for (const r of RENDITIONS) {
  if (!fs.existsSync(r.dir)) {
    console.error(`No clips at ${r.dir}. Run compress-clips.mjs first.`);
    process.exit(1);
  }
  for (const name of fs.readdirSync(r.dir).filter((f) => f.endsWith(".mp4")).sort()) {
    const abs = path.join(r.dir, name);
    files.push({ key: `${r.prefix}/${name}`, abs, size: fs.statSync(abs).size });
  }
}
if (!files.length) {
  console.error("No .mp4 files found in either rendition.");
  process.exit(1);
}

const totalBytes = files.reduce((n, f) => n + f.size, 0);

console.log("");
console.log(`  Bucket   ${BUCKET ?? "(unset)"}`);
console.log(`  Files    ${files.length}  (${(totalBytes / 1048576).toFixed(0)} MB)`);
console.log(`  Cache    ${CACHE_CONTROL}`);
console.log("");

if (DRY) {
  for (const f of files) {
    console.log(`  would put  ${f.key.padEnd(56)} ${(f.size / 1048576).toFixed(1).padStart(6)} MB`);
  }
  console.log("\n  Dry run — nothing uploaded.\n");
  process.exit(0);
}

async function head(key) {
  const res = await signedFetch("HEAD", key);
  return {
    ok: res.ok,
    status: res.status,
    length: Number(res.headers.get("content-length") || 0),
    type: res.headers.get("content-type"),
    cache: res.headers.get("cache-control"),
  };
}

if (VERIFY_ONLY) {
  let good = 0;
  for (const f of files) {
    const r = await head(f.key);
    const match = r.ok && r.length === f.size;
    if (match) good++;
    console.log(
      `  ${match ? "ok  " : "MISS"}  ${f.key.padEnd(56)}` +
        (r.ok ? ` ${r.length === f.size ? "size ok" : `size ${r.length} vs ${f.size}`}  ${r.type}` : `  HTTP ${r.status}`),
    );
  }
  // Range support is not optional for this site. Every frame of the film is
  // reached by assigning video.currentTime, which the browser serves with a
  // byte-range GET. If ranges are ignored the browser refetches the whole
  // clip for each seek — megabytes per frame — and scrubbing dies.
  const rangeRes = await signedFetch("GET", files[0].key, {
    extraHeaders: { range: "bytes=0-1023" },
  });
  const partial = rangeRes.status === 206;
  console.log("");
  console.log(
    `  range    ${partial ? "ok" : "NOT SUPPORTED"}  ` +
      `HTTP ${rangeRes.status}, ${rangeRes.headers.get("content-length")} bytes, ` +
      `content-range: ${rangeRes.headers.get("content-range") ?? "none"}`,
  );
  if (!partial) {
    console.error(
      "  Byte ranges are required for scrubbing. Check that nothing in " +
        "front of the bucket strips Range or buffers whole responses.",
    );
  }

  console.log(`\n  ${good} / ${files.length} present and matching.\n`);
  process.exit(good === files.length && partial ? 0 : 1);
}

/* Upload, a few at a time. Serial is slow for 286MB; unbounded parallelism
   just fights itself for bandwidth. */
const CONCURRENCY = 4;
let done = 0;
let failed = 0;
const queue = [...files];

async function worker() {
  for (;;) {
    const f = queue.shift();
    if (!f) return;
    const body = fs.readFileSync(f.abs);
    let res;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        res = await signedFetch("PUT", f.key, {
          body,
          extraHeaders: {
            "content-type": "video/mp4",
            "cache-control": CACHE_CONTROL,
          },
        });
        if (res.ok) break;
      } catch (e) {
        res = { ok: false, status: 0, statusText: e.message };
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 800 * attempt));
    }
    done++;
    if (res && res.ok) {
      console.log(
        `  [${String(done).padStart(2)}/${files.length}] ${f.key.padEnd(56)} ${(body.length / 1048576).toFixed(1).padStart(6)} MB`,
      );
    } else {
      failed++;
      const detail = res ? `HTTP ${res.status} ${res.statusText}` : "no response";
      console.error(`  [${String(done).padStart(2)}/${files.length}] ${f.key}  FAILED  ${detail}`);
      if (res && res.text) {
        try {
          console.error(`      ${(await res.text()).slice(0, 300)}`);
        } catch {}
      }
    }
  }
}

const t0 = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const secs = (Date.now() - t0) / 1000;

console.log("");
console.log(
  `  ${files.length - failed} / ${files.length} uploaded in ${secs.toFixed(0)}s ` +
    `(${(totalBytes / 1048576 / secs).toFixed(1)} MB/s)`,
);
if (failed) {
  console.error(`  ${failed} failed.\n`);
  process.exit(1);
}
console.log("");
