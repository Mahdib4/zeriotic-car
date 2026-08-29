# Meridian Motorworks

A scroll-driven cinematic car showroom. The visitor arrives in darkness, scrolls
a car into existence part by part, orbits it, watches a showroom build around
it, discovers six more vehicles, configures the one that catches their eye, and
ends at an invitation.

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run manifest     # regenerate + validate the shot manifest CSV
```

```bash
npm run seed-frames  # extract ffmpeg hand-off frames for Higgsfield chaining
```

---

## The two layers, and why the seam is invisible

The experience runs on two layers that share one clock.

**The video layer** plays Higgsfield-generated cinematic clips, scrubbed by
scroll — `video.currentTime` is bound to scroll position and nothing ever
autoplays. It covers Acts 0–3 and 6.

**The real-time layer** is a Three.js scene containing the whole film in code:
the same void, the same assembly, the same orbit, the same showroom, every
vehicle, and the configurator.

Both read scroll position from the same place (`lib/scroll.ts`) and both derive
their camera from the same keyframes (`lib/timeline.ts`). So at any scroll
position they agree on camera height, lens, aim and lighting state — which is
what lets the video layer fade over the real-time layer without a visible seam,
and what lets Act 5 take over live and hand back.

**All 26 clips are generated and in `public/clips`**, and they now cover 100%
of the scroll — Acts 0 through 6, including the per-vehicle exploration beats.

The real-time layer is therefore a fallback rather than a co-star: if a clip is
missing or fails to load, that shot silently falls back to the scene and the
film keeps running. That is also the placeholder mode the whole scaffold was
built and validated in, before any credits were spent.

Act 5, the configurator, is still a DOM layer over the footage and still costs
nothing to extend.

---

## Replacing or re-generating a clip

The full run is documented in `docs/HIGGSFIELD-SHOTLIST.md` — 364 credits
spent of 372.24, leaving 8.24.

To swap a clip:

1. Generate it, seeded from `public/seed-frames/<shot-id>_seed.png` as
   `start_image` so it still joins the chain.
2. Name the file exactly as the `file` column in
   `public/manifest/shot-manifest.csv`, e.g. `AxiomGT-A1-040_panels-weld.mp4`.
3. `node scripts/land-clip.mjs <SHOT-ID> <url>` — downloads it under the right
   name and re-extracts the seed frame for the shot that follows.
4. `node scripts/compress-clips.mjs` before shipping (see below).
5. `npm run manifest` — reports how many of the 26 clips are present.

Because each shot's seed comes from the previous clip, **re-generating a clip
means the next one's seed frame changes too.** Either re-generate forward from
that point, or accept a small discontinuity at that single boundary.

Nothing else changes — see "Performance" below for how clips are mounted and
scrubbed.

To retime a clip, change its `from`/`to` in `lib/shots.ts`. Those are
**act-local** (0–1 within the act), so retiming an act moves its clips with it
and the CSV can never drift out of sync with the timeline.

### The hand-off chain

`npm run seed-frames` walks the manifest, and for every shot marked
`seed: "chain"` extracts the final frame of the preceding clip into
`public/seed-frames/<shot-id>_seed.png`. Upload that as `start_image` for the
next generation. Extraction is free; only the single shot marked
`seed: "anchor"` — the very first frame of the film — needs a generated still.

`npm run manifest` also fails if any act boundary jumps in camera position,
aim or lens — the hand-off rule enforced in code rather than by eye.

---

## How Act 5 hands off to and from video

Act 5 never swaps layers, because it is not a layer — it is DOM over whatever
is already on screen. Paint, trim, packages and live pricing are controls in
`Overlays.tsx`; selecting a swatch changes the configured price and the
material state, not the render path. Nothing remounts and nothing hands over.

The camera is continuous across the boundary because
`ACTS.lineup.end` and `ACTS.explore.start` share an identical camera keyframe
(the validator enforces it), and the lighting rig is a single environment that
re-weights across acts rather than being replaced — the Act 0 spotlight is
still traceable in the paint here.

Selections live in `lib/config.ts`, an external store read by both the DOM
controls and the canvas. Changing a swatch mutates material properties on the
existing meshes; nothing remounts. Selections persist as you scroll away and
back.

---

## The real-time layer no longer draws the cars

`Scene.tsx` renders the room — void, studio lighting, showroom architecture,
and a camera locked to the same scroll position as the film — but not the
vehicles.

The procedural cars were built when most of the film was still a placeholder
and this layer had to stand in for footage that did not exist. Every scroll
position is now covered by a clip, so the only way this layer reaches the
screen is as a fallback when a clip cannot be loaded — and there, low-poly
stand-ins look like a broken build rather than a design. An empty, correctly
lit showroom reads as intentional.

`Vehicle.tsx` and `geometry.ts` are kept but unreferenced: they are the only
record of the proportions each model was designed to, and they are tree-shaken
out of the bundle.

Related, and the reason this was visible at all: a clip that failed to load
used to be added to a `failed` set that was never cleared, which permanently
fell back to this layer for that shot. Off local disk a load error essentially
never happened; over object storage a single dropped request is ordinary.
Failed clips are now retried three times with backoff, and clear on success.

## Tier 3 vehicles vs. the Tier 1 flagship

Both use the same `<Vehicle>` component and the same procedural geometry. The
difference is treatment:

| | Flagship (Axiom GT) | The other six |
|---|---|---|
| `renderTier` in content.ts | `higgsfield-hero` | `realtime` |
| Higgsfield clips | Acts 0–2 | one Act 4 orbit each |
| Detail level | `hero` — ~130 parts incl. chassis, engine, suspension, interior | `silhouette` — ~28 parts |
| Assembly | Full nine-beat build across 520vh of Act 1 | Compressed build over the first 62% of its Act 3b reveal |
| Signature move | quad-exhaust, during Act 2 | one per vehicle, during its Act 4 chapter |
| Credit cost | 228 | 80 (60 + 2 corrections) |

The six vehicles exist twice over. In the shipped film their Act 4 beats are
Higgsfield clips — the exploration act was originally real-time only, and
against twenty clips of generated footage a procedural mesh read as a
placeholder, so it was re-shot (see the shot list, §10).

The real-time versions remain as the fallback and still genuinely assemble —
the brief's "components finishing their assembly" reveal — in code, compressed,
as the camera arrives. Their signature moves (`battery-slide`,
`suspension-lift`, `wing-deploy`, `door-present`, `grille-shutter`,
`seat-recline`) are code-driven animations in `applySignature()` in
`components/three/Vehicle.tsx`, and adding a seventh vehicle still costs zero
credits on that path.

---

## Editing the content file

`lib/content.ts` holds every word and number. Nothing in it knows about layout,
scroll or animation.

**To change copy, specs, prices, paints, trims or packages:** edit the vehicle
object. The overlays, the catalogue, the configurator and the pricing all read
from it.

**To add a vehicle:** append an object to `vehicles`. Everything re-derives —
the scroll timeline grows by one chapter, the showroom floor gains a slot, the
Act 3b reveal gains a beat, the lineup gains a car, the accessible catalogue
gains an entry. It costs zero Higgsfield credits, because non-flagship
vehicles never use video.

**To change which vehicle is the flagship:** move `renderTier:
"higgsfield-hero"` to a different entry. Exactly one vehicle should have it.
Note that this invalidates the Act 0–2 clips, which are flagship-specific.

**Proportions** drive the procedural body directly, in metres. After changing
them run:

```bash
node scripts/preview-profile.mjs sports
```

which rasterises the real generated meshes to the terminal, viewed from the
side, so you can check the silhouette without a GPU.

---

## Timing

`lib/timeline.ts` is the master scroll map. Every act, beat and chapter is a
slice of global progress in [0,1].

To retime the film, change the `vh` numbers in `ACT_DEFS`. Everything —
overlays, clips, camera, per-vehicle chapters — re-derives. Total is currently
2560vh across 7 acts.

`BEAT_DEFS` controls the nine Act 1 assembly stages and their relative
weights. Beats deliberately overlap by 22% so the build never stalls: the
brief's most important rule is that nothing is ever frozen waiting for the
camera.

---

## Accessibility & performance

- **`prefers-reduced-motion`** — the film never mounts. No WebGL context, no
  scroll hijack, no video. `components/Catalogue.tsx` becomes the site: a
  complete, still, one-page catalogue with every specification.
- **No JavaScript** — same path. The catalogue and the Act 6 contact section
  are server-rendered and always in the document.
- **Screen readers** — the catalogue is always present in the DOM regardless of
  scroll, so the full range is reachable without scrubbing a canvas. Overlay
  beats set `aria-hidden` dynamically so only what is actually on screen is
  announced.
- **Mobile / low-power** — detected in `Stage.tsx`; drops DPR, switches the
  floor from a reflector to a standard material, and stops re-rendering the
  environment map every frame.
- **Frame budget** — the scene runs zero React renders per frame. All animation
  is direct mutation inside one `useFrame`; DOM overlays write `opacity` and
  `transform` only, and only when the value actually changes.

---

## Layout

```
app/                    route, layout, design system
components/
  Stage.tsx             pinned frame, Lenis + GSAP scroll loop
  Overlays.tsx          all scroll-synced content beats
  Catalogue.tsx         the accessible site underneath the film
  Epilogue.tsx          Act 6 contact section
  three/
    Scene.tsx           camera rig + scene assembly
    Vehicle.tsx         part registry, assembly, signature moves
    geometry.ts         the procedural car
    materials.ts        paint, glass, chrome; the shared environment
    Studio.tsx          lighting continuity across acts
    Showroom.tsx        Act 3 environment construction
  video/
    ScrubVideoLayer.tsx Higgsfield clips, scrubbed by scroll
lib/
  content.ts            all copy, specs, pricing, proportions
  timeline.ts           acts, beats, chapters, camera keyframes, floor layout
  shots.ts              the shot manifest and credit budget
  config.ts             Act 5 selections
  scroll.ts             the single scroll source of truth
docs/
  HIGGSFIELD-SHOTLIST.md   costed shot list, pending approval
scripts/
  verify-manifest.mjs      emit CSV + validate ranges, budget, hand-offs
  extract-seed-frames.mjs  ffmpeg last-frame chaining
  preview-profile.mjs      rasterise the generated car to the terminal
```

---

## Compression

`node scripts/compress-clips.mjs` — required before shipping. It always encodes
from `public/clips-raw/` (the untouched masters, gitignored), so it is safe to
re-run and never compounds generation loss. 312 MB of masters become 286 MB
shipped.

The unusual setting is the GOP: **a keyframe every 3 frames**.
`video.currentTime` can only land on a keyframe, so every seek decodes forward
from the preceding one — and on a scrubbed film that seek cost *is* the frame
budget. Measured in Chrome, 120 random seeks into this footage at 1080p:

| keyframe every | mean | p95 | p99 | worst | frames blown |
| --- | --- | --- | --- | --- | --- |
| 15 frames | 7.65ms | 15.1ms | 18.1ms | 18.7ms | 2.5% |
| **3 frames** | **3.75ms** | **4.8ms** | **5.0ms** | **6.5ms** | **0%** |
| 2 frames | 3.96ms | 4.9ms | 10.5ms | 14.3ms | 0% |
| every frame | 3.88ms | 8.2ms | 15.3ms | 18.8ms | 0.8% |

The mean was never the problem — the tail was. At a keyframe every 15 frames,
one seek in forty overran a 16.7ms frame and the picture visibly stuck.
All-intra is not the answer either: the files grow until I/O puts the tail back,
and it measured *lower* SSIM than GOP 3 at nearly 1.5× the size. Three is the
floor. B-frames are disabled for the same reason — they decode out of order, so
landing on one costs an extra reference frame for nothing.

Quality went up rather than down: GOP 3 at CRF 20 measures SSIM 0.9945 against
the master, against 0.9939 for the old GOP-15 encode.

Re-encode with `--crf 18` or `--gop 15`.

## Why the clips don't crossfade

`ScrubVideoLayer` mounts a four-shot window (one behind, two ahead), switches
between clips instantly with no CSS transition, and never assigns
`currentTime` while a seek is already in flight.

All three exist for the same reason — the film used to blink at every shot
boundary:

- Mounting only `[current, next]` meant the outgoing element was torn down
  before the incoming one had decoded a frame, so the WebGL canvas showed
  through for a frame or two.
- A crossfade is actively wrong here. Consecutive clips are frame-chained, so
  the hand-off is a hard cut and is invisible; mid-fade you instead see two
  near-identical frames blended at partial opacity over a dark canvas, which
  reads as a brightness dip.
- Assigning `currentTime` during a seek cancels and restarts it, so a fast
  scroll could starve the decoder and stall the picture. The newest target is
  parked in a single slot instead, and the element's own `seeked` event drives
  the next seek — the loop self-clocks at exactly the rate the decoder can
  sustain, so no queue can build up and no seek is wasted.

## A note on chaining and subject drift

Seeding each clip from the previous clip's last frame anchors the **subject**,
not just the environment. That is what makes the film continuous, but it also
means the model will happily keep the car already in frame when you ask for a
different one.

If a shot needs to change vehicle, say so explicitly — the reliable pattern is
the one used in the lineup transitions and in `A4-050` / `A4-060`: the current
car breaks apart into particles and **reforms as a completely different
vehicle**, described in contrast to what it replaced ("dramatically taller and
more upright than the car it replaced"), plus a negative ("not a saloon"), at
`cfg_scale` 0.75. Asking the camera to simply "orbit a new vehicle" does not
work.

## Hosting the clips on Cloudflare R2

The app bundle is 168KB. The film is 286MB. There is no reason for those to
share a host, and R2 charges nothing for egress, so the clips live in object
storage and the app is served separately.

### Where the URL comes from

`lib/shots.ts` builds every clip URL from `NEXT_PUBLIC_CLIP_BASE_URL`:

| value | resulting src |
| --- | --- |
| unset (default) | `https://pub-….r2.dev/clips/AxiomGT-…` |
| `https://media.example.com` | `https://media.example.com/clips/AxiomGT-…` |
| `local` | `/clips/AxiomGT-A0-010_void-ignition.mp4` |

**The default is the real bucket, committed deliberately.** The footage is
gitignored and served from object storage, so a build without this variable
pointed at `/clips/…`, which does not exist, and every clip 404'd. The first
Vercel deploy shipped exactly that way — the variable lives in `.env.local`
alongside the R2 keys, and that file is correctly not in the repo, so it was
simply absent at build time. Defaulting to the bucket means a clone, a preview
branch and a fresh deploy all work with no setup, and the URL is public by
design: it is inlined into the client bundle and fetched by every visitor.

Use `local` to serve from `public/clips` when working offline. An explicit
word rather than an empty string, because an unset `NEXT_PUBLIC_` variable is
not reliably distinguishable from a blank one once the bundler has inlined it.

**It is inlined at build time**, not read at runtime — `NEXT_PUBLIC_` variables
are baked into the client bundle by webpack. Setting it after the fact does
nothing; it has to be present when `next build` runs.

### Uploading

```bash
npm run upload:clips
```

Credentials come from `.env.local` (see `.env.example`). Note which are and
are not `NEXT_PUBLIC_`: the account id, access key and secret must never carry
that prefix or they would be shipped to every visitor in the JS bundle. Only
the base URL is public.

The uploader signs S3 requests with AWS SigV4 using Node's built-in crypto
rather than pulling in `@aws-sdk/client-s3`, which is ~20MB of node_modules
for 26 PUTs. It uploads four at a time and retries three times per file.

Two headers it sets deliberately:

- `Content-Type: video/mp4`. If R2 serves these as
  `application/octet-stream` the browser will not treat them as media and
  scrubbing stops working entirely.
- `Cache-Control: public, max-age=31536000, immutable`. A recut gets a new
  filename, so the objects genuinely never change. On 286MB this is the
  difference between a fast second visit and a slow one.

### Verifying

```bash
npm run verify:clips
```

Checks every object is present and byte-for-byte the size of its local
counterpart, then makes a byte-range request and asserts a **206**.

That last check matters more than it looks. Every frame of this film is
reached by assigning `video.currentTime`, which the browser serves with a
range GET. If anything in front of the bucket strips `Range` or buffers whole
responses, each seek refetches a 14MB clip and the site becomes unusable —
while still looking fine on a fast connection at the top of the page.

### Why clips wait to be fully downloaded

Serving the clips from object storage changed what "ready" means, and it is
the one thing about this move that is not obvious.

`readyState >= HAVE_CURRENT_DATA` only promises a decoded frame at the
current position. Off local disk that is as good as ready, because a seek
anywhere else is free. Over a network it is not: seeking into a byte range the
browser has not fetched costs a full round trip. Measured against R2:

| clip state | mean seek | p95 | seeks over an 8.3ms budget |
| --- | --- | --- | --- |
| just reached `canplaythrough` | 148.7ms | 279.5ms | 53 of 80 |
| fully buffered | 5.9ms | 8.1ms | 3 of 80 |

So `ScrubVideoLayer` will not put a clip on screen until roughly all of it is
buffered (rule 6). The mount window already runs two clips ahead and a clip
buffers in about a second, so in normal scrolling the gate is satisfied well
before the boundary. A 700ms timeout covers slow connections, where a briefly
stuttery clip beats a frozen frame.

This is worth knowing before changing the mount window: narrowing it would cut
the prefetch lead time, and the cost would not show up in local development at
all.

### What R2 cannot do

R2 is object storage, not a web host. A public bucket will not serve
`index.html` for `/`, so the Next app itself needs Cloudflare Pages, Workers,
or any static host — the build is fully static (`○ Static` for every route),
so `output: 'export'` is an option too.

The bucket also needs public access enabled before the browser can read it:
either a custom domain, or the `pub-*.r2.dev` URL. The `r2.dev` URL is
rate-limited and explicitly not for production; with 10–14MB objects you will
hit that limit immediately, so bind a real domain before launch.

## Trimming a clip instead of regenerating it

Generated footage often overruns the beat it was cut for. `ShotDef` takes
optional `trimStart` / `trimEnd` fractions, and only `shotClipTime()` knows
about them — everything upstream still works in untrimmed shot progress.

Two shots use it:

- **`A3-050`** ends at 7.3s of 10.0s. The source carries on past the point
  where the silver saloon clears frame and drifts toward the EV at the far end
  of the room, which pre-empted that vehicle's own reveal in Act 4.
- **`A6-010`** ends at 8.0s of 12.0s, and is now the film's closing shot. The
  camera keeps climbing past that point and the overhead cross-rig comes down
  into frame; 8.0s is the last moment the wide reveal of the range is clean.

`A6-020`, the aerial, was cut from the film altogether. It is the shot where
that rig dominates frame, and a rig baked into generated footage cannot be
removed by trimming. Its file is still in `public/clips` and in the bucket but
no longer referenced — the film now ends on the rise-out and hands over to the
epilogue, which lifts up from below.

**A trimmed shot must have its scroll span cut to match**, or it plays fast and
demands a proportionally higher seek rate. `npm run manifest` computes
frames-per-vh from `effectiveDuration()`, so a trim without a matching span
change fails the check rather than shipping as a speed-up.

What trimming cannot do is change what is *inside* a frame. The dark gantry
running through the middle of `A6-020` is baked into the footage; removing it
needs a regeneration, not a cut.

## Why the lineup runs once

Act 3b used to be sized for six vehicle reveals but only ever had three clips.
The other three rows replayed `Lineup-A3-030/040/050` verbatim — the
descriptions claimed a re-grade to each incoming vehicle's accent, but no such
grade existed. The result was a visible loop: a vehicle was introduced, the
film cut back to the car before it, and introduced it again.

The reuse rows are gone and the act is sized to the footage that exists
(`LINEUP_REVEAL_COUNT = 3`, 180vh instead of 360vh). Only the first three
vehicles get an Act 3b reveal; all six still get a full chapter in Act 4, so
nothing was lost by shortening it.

## The opening, and why nothing flashes before it

Three separate things had to be true for the first frame of the page to be
correct, and each was wrong in a different way.

**The catalogue is hidden by CSS, not by a class.** It is server-rendered — it
has to be, it is the site for anyone without the film — and it used to be
hidden by a `film-active` class added in an effect. An effect runs after
hydration, so every visitor saw one fully painted frame of the catalogue before
the film replaced it. It is now hidden by default and revealed by a
`prefers-reduced-motion` media query, so that frame cannot exist. A
`<noscript>` block in `layout.tsx` puts it back when JavaScript never runs.

An inline script setting the class before paint also works and was tried first.
It is worse: React sees the className it rendered and the one it finds as a
hydration mismatch it "won't patch up", and `suppressHydrationWarning` does not
cover `<html>` in App Router. The CSS version mutates nothing React owns.

**The title card is server-rendered.** `Preloader` lives in `page.tsx`, not
inside the film, so it is in the HTML and covers the very first paint — the
film is a client component and only mounts after hydration. It animates the
wordmark letter by letter while the whole mark's tracking settles from 0.62em
to 0.30em, then lifts.

It is also load-bearing rather than decorative: `ScrubVideoLayer` will not show
a clip until it is fully buffered, which off object storage takes about a
second, so without it the opening moment was the empty fallback room. It holds
until the first clip is genuinely ready, with a floor so a warm cache does not
make it flash and a ceiling so a failed clip cannot trap anyone behind it.

## The footer lift, and two traps in it

`RevealOnScroll` slides the epilogue up as it enters view. Both non-obvious
parts exist because the first version of each was wrong.

**The hidden state is applied by `is-armed`, which only JavaScript adds.** Hide
in CSS and reveal with JS — the obvious arrangement — means any failure in that
component deletes the showroom's address and phone number from the page.

**Being in view is not sufficient to trigger it.** The film mounts after
hydration and only then claims its ~2400vh, so for the first moments this block
genuinely sits near the top of a short document, and an IntersectionObserver
reports intersection state *as soon as you observe* rather than waiting for a
change. Observing during that window fires immediately and the footer is
already up before anyone scrolls. Waiting for layout to "settle" is a race;
requiring evidence the visitor actually travelled here is not — so the reveal
also needs either movement, or a document too short to contain a film at all.

Two smaller notes. Position is read with `window.scrollY` rather than trusted
to `scroll` events, because Lenis can drive the page without one reaching the
window. And the backstop is a **poll, not a deadline**: a "reveal after N
seconds no matter what" fires while the footer is still far off screen for any
reader moving at a human pace through 2400vh, losing the animation for exactly
the people who were watching properly.

## Delivery is the bottleneck, not decoding

Once the clips moved to object storage the limiting factor stopped being how
fast the decoder could seek and became how fast the bytes arrive. Two numbers
matter, both measured in-browser against the live bucket:

| | before | after |
| --- | --- | --- |
| Time before a shot boundary can be crossed | 1811ms | **468ms** |
| Shipped footage | 286MB | **196MB** |

Three things caused the original figure.

**The readiness gate demanded the whole file.** That was correct off local
disk and badly wrong over a network: a 14MB clip takes ~1.8s to download in
full, so every boundary became a wall the film could not cross, and scrolling
faster than that froze the picture outright. The gate is now position-aware —
what has to be true is that the bytes about to be scrubbed *into* are present,
not that the file is complete. 3.5s of runway ahead of the playhead is enough,
because scrubbing tracks scroll and therefore advances through a clip roughly
monotonically.

It deliberately measures the buffered range *containing* the playhead rather
than a total. A clip with two disjoint buffered islands summing to most of its
length is still one seek away from a network round trip, and summing them
would call that ready when it is not.

**Bitrate is a latency cost here, not a storage one.** Nothing can be scrubbed
until it arrives, so CRF moved from 20 to 23: SSIM against the master goes
0.9944 → 0.9926 for 31% fewer bytes. Resolution stays at 1080p deliberately —
that is the part viewers notice, and dropping to 720p saves less than the CRF
change while being far more visible.

**The lookahead is a network parameter.** The mount window runs one clip
behind and three ahead. The extra depth is not for the decoder; it decides how
fast a visitor may scroll before they outrun the prefetch.

### The r2.dev hostname is not on the CDN

```
$ curl -I https://pub-….r2.dev/clips/…mp4
HTTP/1.1 200 OK
Server: cloudflare
Cache-Control: public, max-age=31536000, immutable
```

Note what is **missing**: there is no `cf-cache-status` header, on any
request, however many times it is repeated. The `r2.dev` development hostname
does not sit behind Cloudflare's cache, so every clip is pulled from the R2
origin — measured TTFB is a flat ~250–435ms with no improvement on repeat.

Binding a custom domain to the bucket puts it behind the CDN properly: cached
at an edge near the visitor, with TTFB in the tens of milliseconds instead of
hundreds. That is the largest remaining win and it needs no code change — set
`NEXT_PUBLIC_CLIP_BASE_URL` to the new hostname, which overrides the default
in `lib/shots.ts`. It is also the documented requirement: `r2.dev` is
rate-limited and Cloudflare does not support it for production traffic.

### Re-uploading over the same filenames

The clips carry `immutable` for a year and a recut keeps its filename, so a
browser that already has the old bytes will not re-request them. That is the
right trade for visitors, but it means **you** need a hard reload after
re-running `npm run upload:clips`.

## Known gaps

- **Number plates and badges.** The generator put garbled characters on some
  number plates (mostly early Act 1) and recognisable real-brand grille
  emblems on some lineup vehicles (most visibly the SUV in `Lineup-A3-030`).
  Later prompts suppress both. For a real commercial deployment of a fictional
  dealership these should be cleaned up — the 88-credit buffer covers it.
- **The 3D scene has not been viewed on a GPU.** The build, types and geometry
  are verified (`node scripts/preview-profile.mjs` rasterises the real meshes
  to the terminal), but materials, lighting balance and frame rate need a look
  in a real browser via `npm run dev`. Expect to tune exposure and light
  intensities in `components/three/Studio.tsx` on first viewing.
- `public/stills/` holds only the Act 0 anchor; the reduced-motion catalogue
  uses CSS gradient placeholders where key-frame stills would go. Any frame
  from `public/seed-frames/` can be dropped in.

## Performance

Two things dominate frame rate on this page, and both are handled explicitly.

**The WebGL scene parks itself when video covers the frame.** `ScrubVideoLayer`
reports coverage up to `Stage`, which passes `paused` to `CanvasLayer`. When
paused the canvas gets `frameloop="never"` and `visibility: hidden`, so the
render loop stops — and with it the reflective floor's second scene pass and
the environment cube-map refresh. Video now covers 100% of the scroll, so in
normal use the scene renders only as a fallback. Leaving it running behind
opaque video was the original cause of scroll stutter.

**Seek cost is an encoding problem, not a scheduling one.** An earlier version
of this file described a throttle that limited seeks to roughly 11 a second
during fast scrolls, to dodge the 40ms seek spikes the old 15-frame GOP
produced. That was a mistake: it capped fast scrolling at 11fps, which is
precisely when smoothness matters most. The real fix was in the encode — see
[Compression](#compression). At a keyframe every 3 frames a seek costs 3.75ms
mean and 5.0ms p99, so seeking on every frame is comfortably affordable at
60Hz. The layer chases the newest scroll target instead of queueing:
whatever position arrives while a seek is in flight overwrites the pending one,
and the element's `seeked` event starts the next seek immediately rather than
waiting for the next animation frame.

**Seeks are paced at 60Hz, not at display rate.** This is the one that only
shows up on high-refresh monitors. The scroll ticker runs at the display's
rate, so on a 120Hz screen the layer was asking for 120 seeks a second — on
24fps source material, with a budget of 8.3ms per seek rather than 16.7ms. It
could not keep up, and scrubbing stuttered on exactly the machines that should
have handled it best. A 14ms floor is a no-op at 60Hz and halves the rate at
120Hz, which is still five times the film's own frame rate.

This is not the old 90ms throttle, which capped fast scrolling at 11fps and
made things worse; it caps at 60 seeks a second and applies uniformly rather
than only during flings.

**Every clip gets scroll span proportional to its duration.** Otherwise the
film changes speed mid-act: a clip given half the scroll it needs plays at
double rate and demands double the seek rate with it. `A1-090` once had
**12.15 frames per vh against its neighbours' 3.9** — the assembly act's
fractions had mis-accumulated, leaving a 10-second clip 3.8% of the act — and
it read as a lurch right at the end of the assembly. `npm run manifest` now
fails if any clip drifts more than 25% from its act's median frames-per-vh.

**Nothing expensive is allowed to composite over the film.** Two CSS properties
were quietly costing a full-frame compositor read-back on every frame of the
entire scroll, because the thing behind them — a 1080p clip being scrubbed —
invalidates continuously and can never be cached:

- `.floating-nav` used `mix-blend-mode: difference` to stay legible over both
  bright and dark footage. It is a fixed, full-width bar, so it blended against
  the video on every frame. It now uses a fixed colour over a static scrim
  gradient, which buys the same legibility for one static paint.
- `.panel` used `backdrop-filter: blur(18px)`, re-blurring the footage behind
  all twelve panels every frame. A slightly more opaque surface
  (`--surface-panel`) reads almost identically and costs nothing.

**Only the visible beat is promoted.** `.beat` carried a standing
`will-change: opacity, transform`, and there are 34 of them — 34 full-viewport
compositor layers held in GPU memory for the 33 nobody is looking at.
`will-change` is now set and cleared from `Overlays.tsx` as each beat crosses
the visibility threshold.

Supporting changes: the mount window is one clip behind and two ahead (a new
`<video>` means a new decoder, so a tight window churns them at the worst
moment), and Lenis uses frame-rate-independent `lerp` rather than a fixed
`duration` ease, which otherwise keeps animating after the wheel stops and
reads as the picture lagging behind the input.

### Diagnostics

Append `?debug` to the URL for an overlay showing frame rate and worst frame
rate, whether the canvas is parked or rendering, live seek timing, the active
clip ID, and scroll position and energy. Not mounted at all without the flag.

If scrolling ever feels wrong again, that overlay says why:

- `canvas RENDERING` during a clip means coverage is not being reported, and
  the WebGL scene is drawing seven cars behind opaque video.
- `seek` shows mean / p95, how many seeks overran the frame budget, and what
  that budget is. The budget is the display's own refresh period — 8.3ms at
  120Hz, 16.7ms at 60Hz — so the readout means the same thing on any screen.
  Healthy is a p95 under budget with 0 blown. A high p95 means the clips need
  re-encoding at a denser GOP; check `ffprobe` shows a keyframe every 3 frames.
- `fps` is coloured against the display's refresh rate, not against 60. Sixty
  frames a second is healthy on a 60Hz panel and half rate on a 120Hz one.
- A low `min` with the canvas parked and seeks healthy points at something
  else compositing over the film. Check for newly added `backdrop-filter`,
  `mix-blend-mode`, or a standing `will-change`.

### Running dev and building at the same time

Don't — or rather, use `npm run build:check`. `next build` and `next dev` both
write to `.next`, and a build run against a live dev server leaves it serving
chunk ids that no longer exist (404s, and
`__webpack_modules__[moduleId] is not a function`). `npm run build:check` builds
into `.next-check` instead, and `npm run dev:verify` starts a second dev server
on :3100 with its own `.next-verify`, so neither disturbs a running `npm run dev`.
