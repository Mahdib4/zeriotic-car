# Higgsfield shot list & credit budget

**Status: COMPLETE. All 26 clips generated, landed and compressed.**

| | |
|---|---|
| Opening balance | 372.24 |
| Spent | **364.00** |
| Closing balance | **8.24** |
| Clips delivered | 26 / 26 |
| Re-generations needed | **2** (Act 4 subject drift, see §10) |

The original 20-clip plan (284 credits) ran entirely first-pass — no
continuity break needed correcting, because each clip was seeded from the
previous clip's actual final frame rather than from a prompt.

Act 4 was then added after review (+80 including two corrections, see §10),
which is what draws the closing balance down to 8.24.

The plan below is what was approved and what was executed. Two changes were
made during the original run, both reducing cost:

- **ST-002 and ST-003 were dropped (−4 credits).** They were planned as fresh
  anchor stills for Acts 3 and 6. Once the first chained generation proved the
  model honours `start_image`, chaining became strictly better: the subject
  persists across the boundary, so the hand-off carries the car, the lighting
  and the reflections with it. A fresh still would have introduced a different
  car into an established film.
- **Higgsfield's "IN THE DARK" preset was declined** on every shot it was
  offered. A preset overrides camera and lighting, which is exactly what the
  continuity chain depends on.

---

## 1. Two ceilings, not one

The brief sets a 400-credit ceiling. The connected Higgsfield account actually
holds **372.24 credits** (Plus plan). The lower number is the real constraint,
so everything below is reconciled against 372.24.

| | Credits |
|---|---|
| Brief ceiling | 400 |
| **Actual account balance** | **372.24** |
| First-pass plan (as executed) | **284** |
| Correction buffer remaining | **88.24** (24% of balance) |

The brief asked for a first pass around 320–340 against a 400 cap, i.e. a
60–80 credit buffer. 284 against 372.24 leaves 88.24 — proportionally the same
discipline, with slightly more headroom.

---

## 2. Real pricing, measured not assumed

The brief says to check current pricing rather than assume a number. Every
figure below came from `get_cost` preflights against the live account, which
submit nothing and spend nothing:

| Model | Config | Measured cost |
|---|---|---|
| `seedance_2_5` | 1080p, 10s | 90 credits |
| `seedance_2_5` | 1080p, 5s | 45 credits |
| `seedance_2_5` | 720p, 10s | 65 credits |
| `kling3_0` | std, 10s, silent | 15 credits |
| **`cinematic_studio_video_v2`** | **std, 10s, silent** | **10 credits** |
| **`cinematic_studio_video_v2`** | **pro, 10s, silent** | **15 credits** |
| `cinematic_studio_video_v2` | pro, 12s, silent | 18 credits |
| `nano_banana_pro` | one still | 2 credits |

**The model choice is the whole budget.** Seedance runs 9 credits/second at
1080p — 372 credits would buy roughly 41 seconds of finished film, which
cannot carry this brief. Higgsfield's own Cinema Studio Video v2 runs at
**1.0 credit/second in std and 1.5 in pro**, a 6–9× difference, and critically
it accepts both `start_image` and `end_image`, which is exactly what the
seed-frame chaining method needs.

Audio is off on every generation — the brief specifies no autoplay sound, and
silent output is cheaper on several models.

---

## 3. Tiering

Following the brief's tier rules exactly:

| Tier | Treatment | Credits |
|---|---|---|
| **Tier 1** — Act 0 void, the complete Act 1 assembly for the flagship, its Act 2 orbit, Act 6 epilogue | Full cinematic, `pro` mode, not thinned | **228** |
| **Tier 2** — Act 3 showroom construction, spatial-reveal transitions | Abbreviated, `std` mode, fewer/longer generations | **54** |
| **Tier 3** — the other six vehicles' Act 4 exploration beats | Real-time Three.js, no video — **later revised, see §10** | **0 → 80** |
| **Act 5** — configurator | Real-time Three.js | **0** |
| Anchor still | 1 × `nano_banana_pro` | **2** |
| | **First pass total** | **284** |
| | **Total after Act 4 revision** | **364** |

---

## 4. Full shot list

`cinematic_studio_video_v2`, 16:9, sound off. Scroll ranges are percentages of
total scroll and are generated from `lib/shots.ts` — see
`public/manifest/shot-manifest.csv`.

### Anchor still — 2 credits

| ID | File | Purpose | Cost |
|---|---|---|---|
| ST-001 | `AxiomGT-A0-001_void-anchor.png` | Opening frame: near-black void, one volumetric spotlight, suspended components in rim light | 2 |

One still, for the very first frame of the film. Every other shot in the
manifest chains from the previous clip's actual last frame via ffmpeg, at zero
cost — including Acts 3 and 6, which were originally planned as fresh anchors
and were switched to chaining mid-run (see the note at the top).

### Tier 1 — Act 0, The Void — 24 credits

| ID | Description | Mode | Sec | Seed | Cost |
|---|---|---|---|---|---|
| A0-010 | Spotlight cuts on in black space; wordmark resolves out of lens flare | pro | 8 | ST-001 | 12 |
| A0-020 | 0.15 m/s drift through the suspended component field | pro | 8 | chain | 12 |

### Tier 1 — Act 1, Assembly — 138 credits

The one sequence the brief says cannot be thinned. Nine beats, matching the
nine mechanical stages in `lib/timeline.ts`.

| ID | Description | Mode | Sec | Cost |
|---|---|---|---|---|
| A1-010 | Chassis rails and subframe rise from below and lock | pro | 10 | 15 |
| A1-020 | Engine and drivetrain lower in and seat with a mechanical settle | pro | 10 | 15 |
| A1-030 | Suspension, coilovers and wheel wells attach; springs take load | pro | 8 | 12 |
| A1-040 | Body panels fly in and weld into place, panel by panel | pro | 12 | 18 |
| A1-050 | Glass slides in and seals; doors swing in and hang on hinges | pro | 10 | 15 |
| A1-060 | Headlights, grille, mirrors self-assemble; lights flicker on | pro | 10 | 15 |
| A1-070 | Interior: dash grows in, seats settle, wheel locks to column | pro | 10 | 15 |
| A1-080 | Exhaust seats; wheels roll in and mount; tyres inflate onto rims | pro | 12 | 18 |
| A1-090 | Paint resolves — matte-to-gloss sweep, arriving at the 3/4 hero | pro | 10 | 15 |

### Tier 1 — Act 2, Showcase orbit — 36 credits

| ID | Description | Mode | Sec | Cost |
|---|---|---|---|---|
| A2-010 | 50mm orbit, front 3/4 to profile, reflections sweeping the paint | pro | 12 | 18 |
| A2-020 | Orbit through rear 3/4, settling on the hero angle for the price | pro | 12 | 18 |

### Tier 2 — Act 3, Showroom construction — 24 credits

| ID | Description | Mode | Sec | Cost |
|---|---|---|---|---|
| A3-010 | Floor resolves; rigs lower and ignite; platform forms under the car | std | 12 | 12 |
| A3-020 | Architecture grows in; camera pulls back and rises to 3.4m | std | 12 | 12 |

### Tier 2 — Act 3b, Spatial reveals — 30 credits

Three generations cover six vehicle hand-offs. Per the brief's reuse rule,
A3-060/070/080 re-use the same files, re-graded in code to the incoming
vehicle's accent tone.

| ID | Description | Mode | Sec | Cost |
|---|---|---|---|---|
| A3-030 | Car dissolves into particles that reform as the next silhouette | std | 10 | 10 |
| A3-040 | Camera glides past; next vehicle finishes seating its panels | std | 10 | 10 |
| A3-050 | Rim light sweeps the outgoing car as the incoming one resolves | std | 10 | 10 |
| A3-060 | **Re-use of A3-030**, re-graded | — | — | **0** |
| A3-070 | **Re-use of A3-040**, re-graded | — | — | **0** |
| A3-080 | **Re-use of A3-050**, re-graded | — | — | **0** |

### Tier 3 — Acts 4 & 5 — 0 credits *(as originally planned; revised in §10)*

> **Superseded for Act 4.** Six clips were added after review — the reasoning
> and costs are in §10. Act 5, the configurator, remains at zero credits as
> planned. The original rationale is kept below for the record.

No clips. Deliberately. All six non-flagship vehicles, every signature
component move (EV battery pack sliding in and lighting, off-road suspension
articulating, active rear wing deploying, luxury door presenting, aero
shutters, rear lounge recline) and the entire colour/trim configurator are
real geometry driven by code. This is the single biggest saving in the plan,
and it means **adding or swapping a model later costs nothing**.

### Tier 1 — Act 6, Epilogue — 30 credits

| ID | Description | Mode | Sec | Cost |
|---|---|---|---|---|
| A6-010 | 24mm rise out of the showroom, whole range revealed as one shot | pro | 12 | 18 |
| A6-020 | Aerial settles; dealership signage and identity resolve | pro | 8 | 12 |

---

## 5. Running total

| Group | Credits | Running |
|---|---|---|
| Anchor still (ST-001 only) | 2 | 2 |
| Act 0 | 24 | 26 |
| Act 1 | 138 | 164 |
| Act 2 | 36 | 200 |
| Act 3 | 24 | 224 |
| Act 3b | 30 | 254 |
| Acts 4 & 5 | 0 | 254 |
| Act 6 | 30 | 284 |
| **First pass** | | **284** |
| **Buffer at this point** | | **88.24** |

Verified against the account after the final render of the original plan:
balance 88.24, matching the plan to the decimal, with no clip needing a
re-generation.

That buffer was subsequently spent on the Act 4 revision — see §10 for the
final position.

---

## 6. If a re-cut is needed

Per the brief's fallback rule, scope is cut by shortening Tier 1 before ever
cutting it. The cheapest meaningful reduction is grouping Act 1's nine beats
into six larger sub-assemblies — merging suspension into chassis, lighting
into panels, and interior into glazing — which saves 45 credits and still
shows the car building itself. The flagship's build sequence is not cut.

---

## 7. Method notes

- **Chaining.** `npm run seed-frames` extracts the last frame of each clip with
  ffmpeg and writes `public/seed-frames/<shot-id>_seed.png`, to be passed as
  `start_image` for the next generation. Free.
- **Continuity locks.** The lens, camera height, distance and move speed for
  every phase are encoded in `CAMERA_KEYS` in `lib/timeline.ts`, taken directly
  from the brief's continuity bible, and `npm run manifest` fails the build if
  any act boundary jumps in position, aim or lens.
- **Compression.** Paint and chrome reflections and hand-off frames are the
  quality-sensitive assets; test compression on A2-010 and A1-090 first.

---

## 8. Post-production (applied)

`node scripts/compress-clips.mjs` re-encoded every clip for the scrub layer.

Two requirements pull against each other here. Size: 266 MB of raw render is
far too heavy to ship. Seek accuracy: `video.currentTime` can only land
cheaply on a keyframe, and a normal web encode spaces keyframes 2–10 seconds
apart, which makes a scrubbed video snap between stills instead of gliding.

Settings: `libx264`, CRF 26, `preset slow`, **keyframe every 12 frames**,
`+faststart`, no audio track. The dense GOP costs bitrate and buys the smooth
scrub.

| | |
|---|---|
| Before | 266 MB |
| After | **58 MB** |
| Reduction | **78%** |

Quality was checked on A2-010 first, per the brief's instruction to test
compression on the reflection-critical assets: gloss paint gradients and the
near-black background show no banding, which is the hardest case for H.264.

Raw masters are retained in `public/clips-raw/` (gitignored). To re-encode at
higher quality: `node scripts/compress-clips.mjs --crf 24`.

## 9. Artefacts to be aware of

Two things the model introduced that are worth a pass before this goes live:

- **Number plates.** Several clips render garbled characters on the plate.
  Prompts from A1-090 onward explicitly request a blank plate, which mostly
  worked, but earlier Act 1 clips still show it. Small in frame and largely
  hidden by the vignette; fixable with a plate patch in post or a re-generation
  from the buffer.
- **Manufacturer badges.** The lineup vehicles picked up recognisable
  real-brand grille emblems in places — most visibly the SUV in
  `Lineup-A3-030`. Prompts from A3-040 onward request unbranded generic
  designs. For a real commercial deployment of a fictional dealership this
  should be cleaned up; the 88-credit buffer covers re-generating the affected
  clips.

---

## 10. Act 4 revision (+60 credits)

The exploration act was originally Tier 3 — real-time Three.js only, zero
credits. That was the right call on cost and the wrong call on quality:
against twenty clips of generated footage, a procedural mesh read as a
placeholder, and it was the one stretch of the film that broke the spell.

Six clips added, one per non-flagship vehicle, std 10s, chained as usual:

| ID | Vehicle | Signature move | Cost |
|---|---|---|---|
| A4-010 | Terra | Air suspension drops, tailgate opens, third row folds | 10 |
| A4-020 | Lumen | Active aero shutters cycle across the grille | 10 |
| A4-030 | Sovereign | Rear coach door opens, cabin lighting warms | 10 |
| A4-040 | Volta | Car lifts, battery pack slides in, cells ignite cyan | 10 |
| A4-050 | Apex RS | Active rear wing rises and tilts to high downforce | 10 |
| A4-060 | Basalt | Suspension articulates, body lifts, camera cranes out | 10 |

Two of these needed a second pass (20 credits), for a reason worth recording.

**Chaining anchors the subject, not just the environment.** Four of the six
first-pass clips inherited the silver saloon from earlier in the chain instead
of becoming their own vehicle, because the prompt only asked the camera to
"orbit a new vehicle". Sovereign and Volta survived that — a saloon reads
fine as a luxury four-door and as an EV fastback — but Apex RS came out as a
plain saloon instead of a winged track car, and Basalt came out as a saloon
instead of a boxy 4x4.

The fix is the same technique the lineup transitions already used
successfully: have the current car break apart into particles and **reform as
a completely different vehicle**, described in contrast to what it replaced
("dramatically taller and more upright than the car it replaced"), with an
explicit negative ("not a saloon"), at `cfg_scale` 0.75. Both regenerated
correctly first time.

| | Credits |
|---|---|
| Previous total | 284 |
| Act 4, six clips | 60 |
| Act 4, two corrections | 20 |
| **Total spent** | **364** |
| **Closing balance** | **8.24** |

This draws the correction buffer down to 8.24 credits. The number-plate and
badge artefacts noted in section 9 can no longer be fixed from the buffer and
would need a top-up.
