/**
 * shots.ts — the shot manifest.
 *
 * Maps every Higgsfield generation to the scroll range it plays over, the file
 * it loads from, and what it cost to make. This is the single table that
 * decides which clip and which overlay are live at any scroll position.
 *
 * Scroll ranges are expressed as (act, from, to) in ACT-LOCAL progress, then
 * resolved to global progress against timeline.ts. Retiming an act therefore
 * moves its clips automatically — the manifest can never drift out of sync
 * with the timeline.
 *
 * `scripts/verify-manifest.mjs` emits public/manifest/shot-manifest.csv from
 * this file and checks the ranges for gaps and overlaps.
 */

import { ACTS, lerp, type ActId } from "./timeline";

export type Tier = 1 | 2;

export interface ShotDef {
  /** Stable ID. Also the CSV key and the ffmpeg seed-frame key. */
  id: string;
  act: ActId;
  /** Act-local range, 0–1. */
  from: number;
  to: number;
  description: string;
  /** [Vehicle]-[Act]-[###]_[description].mp4 */
  file: string;
  tier: Tier;
  model: "cinematic_studio_video_v2";
  mode: "pro" | "std";
  durationSec: number;
  credits: number;
  /**
   * Seed-frame chaining. `chain` means: start_image is the last frame of the
   * previous shot, extracted with ffmpeg at zero credit cost. `anchor` means
   * this shot starts a new chain from a generated still, because the
   * environment changes too much for a frame hand-off to survive.
   */
  seed: "anchor" | "chain";
  /** Which still seeds this shot, when seed === "anchor". */
  anchorStill?: string;
  /**
   * Reuse marker. A shot flagged as a reuse of another spends zero credits —
   * the same file is re-graded in code for a different accent tone.
   */
  reuseOf?: string;
  /**
   * Portion of the source clip to actually play, as fractions of its duration.
   * Generated footage often overruns the beat it was made for — the camera
   * carries on past the moment the cut wants, or a door opens that never
   * closes. Regenerating costs credits; trimming costs nothing and is exact.
   *
   * A shot's scroll span must stay proportional to its TRIMMED length, not its
   * file length, or it plays at the wrong speed. `effectiveDuration` is what
   * the manifest's playback-rate check uses.
   */
  trimStart?: number;
  trimEnd?: number;
}

/** Seconds of a shot that actually play, after trimming. */
export const effectiveDuration = (s: ShotDef): number =>
  s.durationSec * ((s.trimEnd ?? 1) - (s.trimStart ?? 0));

/* ------------------------------------------------------------------ */
/* Anchor stills — 2 credits each, generated with nano_banana_pro       */
/* ------------------------------------------------------------------ */

export interface StillDef {
  id: string;
  file: string;
  description: string;
  credits: number;
}

/**
 * Only the opening frame needs a generated still. Everything after it chains
 * from the previous clip's last frame, which is both free and strictly better
 * for continuity: the subject persists across the boundary, so the hand-off
 * carries the car, the lighting and the reflections with it. Two further
 * anchors were planned for Acts 3 and 6 and then dropped once the first
 * chained generation proved the model honours `start_image` — they would have
 * introduced a fresh car into an established film.
 */
export const STILLS: StillDef[] = [
  {
    id: "ST-001",
    file: "AxiomGT-A0-001_void-anchor.png",
    description:
      "Near-black void. One volumetric spotlight. Suspended car components in rim light, 35mm eye level.",
    credits: 2,
  },
];

/* ------------------------------------------------------------------ */
/* Shots                                                               */
/* ------------------------------------------------------------------ */

const pro = (sec: number) => ({ mode: "pro" as const, durationSec: sec, credits: sec * 1.5 });
const std = (sec: number) => ({ mode: "std" as const, durationSec: sec, credits: sec * 1.0 });

export const SHOTS: ShotDef[] = [
  /* --- Act 0 — The Void (Tier 1) --------------------------------- */
  {
    id: "A0-010",
    act: "void",
    from: 0,
    to: 0.5,
    description:
      "Volumetric spotlight cuts on in black space. Wordmark resolves out of lens flare and light streaks.",
    file: "AxiomGT-A0-010_void-ignition.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "anchor",
    anchorStill: "ST-001",
    ...pro(8),
  },
  {
    id: "A0-020",
    act: "void",
    from: 0.5,
    to: 1,
    description:
      "Slow 0.15 m/s drift through the suspended component field. Parts rotate gently in place, rim light only.",
    file: "AxiomGT-A0-020_component-drift.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(8),
  },

  /* --- Act 1 — Assembly (Tier 1, must not be thinned) ------------- */
  {
    id: "A1-010",
    act: "assembly",
    from: 0.0,
    to: 0.1087,
    description: "Chassis rails and subframe rise from below and lock together.",
    file: "AxiomGT-A1-010_chassis-lock.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(10),
  },
  {
    id: "A1-020",
    act: "assembly",
    from: 0.1087,
    to: 0.2174,
    description: "Engine block and drivetrain lower into the chassis and seat with a mechanical settle.",
    file: "AxiomGT-A1-020_powertrain-seat.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(10),
  },
  {
    id: "A1-030",
    act: "assembly",
    from: 0.2174,
    to: 0.3043,
    description: "Suspension arms, coilovers and wheel wells attach. Springs compress once as they take load.",
    file: "AxiomGT-A1-030_suspension-attach.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(8),
  },
  {
    id: "A1-040",
    act: "assembly",
    from: 0.3043,
    to: 0.4348,
    description: "Body panels fly in from the surrounding dark and weld into place, panel by panel. Seams glow at each weld.",
    file: "AxiomGT-A1-040_panels-weld.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(12),
  },
  {
    id: "A1-050",
    act: "assembly",
    from: 0.4348,
    to: 0.5435,
    description: "Windscreen and side glass slide in and seal. Doors swing in from the void and hang on their hinges.",
    file: "AxiomGT-A1-050_glazing-doors.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(10),
  },
  {
    id: "A1-060",
    act: "assembly",
    from: 0.5435,
    to: 0.6522,
    description: "Headlights, grille and mirrors self-assemble. Lens elements focus, then the lights flicker on once seated.",
    file: "AxiomGT-A1-060_lighting-ignite.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(10),
  },
  {
    id: "A1-070",
    act: "assembly",
    from: 0.6522,
    to: 0.7609,
    description: "Through the glazing: dashboard grows into place, seats slide in and settle, steering wheel locks onto the column.",
    file: "AxiomGT-A1-070_interior-build.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(10),
  },
  {
    id: "A1-080",
    act: "assembly",
    from: 0.7609,
    to: 0.8913,
    description: "Exhaust seats at the rear. Wheels roll in from off-frame and mount; tyres inflate and seat onto the rims.",
    file: "AxiomGT-A1-080_wheels-mount.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(12),
  },
  {
    id: "A1-090",
    act: "assembly",
    from: 0.8913,
    to: 1.0,
    description: "Paint resolves last — a matte-to-gloss sweep travels nose to tail as the camera arrives at the 3/4 hero angle.",
    file: "AxiomGT-A1-090_paint-resolve.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(10),
  },

  /* --- Act 2 — Showcase orbit (Tier 1) ---------------------------- */
  {
    id: "A2-010",
    act: "showcase",
    from: 0,
    to: 0.5,
    description: "50mm orbit, front 3/4 to profile. Studio reflections sweep the paint and glass as the camera moves.",
    file: "AxiomGT-A2-010_orbit-front.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(12),
  },
  {
    id: "A2-020",
    act: "showcase",
    from: 0.5,
    to: 1,
    description: "Orbit continues, profile through rear 3/4, settling back on the hero angle as the price resolves.",
    file: "AxiomGT-A2-020_orbit-rear.mp4",
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(12),
  },

  /* --- Act 3 — Showroom construction (Tier 2, abbreviated) -------- */
  {
    id: "A3-010",
    act: "showroom",
    from: 0,
    to: 0.5,
    description: "Floor material resolves to polished dark stone. Lighting rigs lower from above and ignite. Display platform forms beneath the car.",
    file: "Showroom-A3-010_floor-rigs.mp4",
    tier: 2,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...std(12),
  },
  {
    id: "A3-020",
    act: "showroom",
    from: 0.5,
    to: 1,
    description: "Architecture grows into place — minimal walls, glass, negative space. Camera pulls back and rises to 3.4m.",
    file: "Showroom-A3-020_architecture-grow.mp4",
    tier: 2,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...std(12),
  },

  /* --- Act 3b — Spatial reveal transitions (Tier 2) ----------------
     Three generated transitions cover six hand-offs. Each is re-graded in
     code to the incoming vehicle's accent tone, so the reused pair costs
     nothing. See README, "Transition reuse". ------------------------ */
  {
    id: "A3-030",
    act: "lineup",
    from: 0.0,
    to: 0.3663,
    description: "Hero car dissolves into particles that reform as the next silhouette in the depth of the room.",
    file: "Lineup-A3-030_dissolve-a.mp4",
    tier: 2,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...std(10),
  },
  {
    id: "A3-040",
    act: "lineup",
    from: 0.3663,
    to: 0.7326,
    description: "Camera glides past; the next vehicle comes into focus as its final panels finish seating.",
    file: "Lineup-A3-040_dissolve-b.mp4",
    tier: 2,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...std(10),
  },
  {
    id: "A3-050",
    act: "lineup",
    from: 0.7326,
    to: 1.0,
    description: "Rim light sweeps across the outgoing car as it clears frame. Trimmed at 7.3s: the source then drifts on toward the EV at the far end of the room, which pre-empts that vehicle's own reveal.",
    file: "Lineup-A3-050_dissolve-c.mp4",
    trimEnd: 0.727,
    tier: 2,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...std(10),
  },

  /* --- Act 4 — per-vehicle exploration ----------------------------
     Originally scoped as Tier 3, real-time only. That was the right call
     on cost and the wrong call on quality: against nineteen clips of
     generated footage, a procedural mesh reads as a placeholder, and the
     exploration act was the one stretch of the film that broke the spell.
     Each vehicle now gets a real orbit with its signature component move,
     at std rate. The configurator still costs nothing — see Act 5 below.
     Ranges are one-sixth of the act each, matching CHAPTERS. ---------- */
  {
    id: "A4-010",
    act: "explore",
    from: 0,
    to: 1 / 6,
    description:
      "Terra. Orbit of the SUV; air suspension drops to load height, tailgate opens and the third row folds flat, then the body rises again.",
    file: "Terra-A4-010_explore.mp4",
    tier: 2,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...std(10),
  },
  {
    id: "A4-020",
    act: "explore",
    from: 1 / 6,
    to: 2 / 6,
    description:
      "Lumen. Orbit of the saloon; the active aero shutters cycle open and closed across the grille as the camera passes the nose.",
    file: "Lumen-A4-020_explore.mp4",
    tier: 2,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...std(10),
  },
  {
    id: "A4-030",
    act: "explore",
    from: 2 / 6,
    to: 3 / 6,
    description:
      "Sovereign. Orbit of the luxury saloon; the rear coach door swings slowly open to present the cabin, interior lighting warming as it opens.",
    file: "Sovereign-A4-030_explore.mp4",
    tier: 2,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...std(10),
  },
  {
    id: "A4-040",
    act: "explore",
    from: 3 / 6,
    to: 4 / 6,
    description:
      "Volta. Orbit of the EV; the car lifts and the battery pack slides up into the floorpan, cell rows igniting cyan one after another.",
    file: "Volta-A4-040_explore.mp4",
    tier: 2,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...std(10),
  },
  {
    id: "A4-050",
    act: "explore",
    from: 4 / 6,
    to: 5 / 6,
    description:
      "Apex RS. Orbit of the track car; the active rear wing rises on its uprights and tilts to its high-downforce angle.",
    file: "ApexRS-A4-050_explore.mp4",
    tier: 2,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...std(10),
  },
  {
    id: "A4-060",
    act: "explore",
    from: 5 / 6,
    to: 1,
    description:
      "Basalt. Orbit of the off-roader; the suspension articulates corner by corner and the body lifts on its travel, then the camera pulls back wide into the hall.",
    file: "Basalt-A4-060_explore.mp4",
    tier: 2,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...std(10),
  },

  /* --- Act 5 — configuration. Still zero credits. -----------------
     Paint, trim, packages and live pricing remain a DOM layer over the
     footage. Swatch selection re-grades the clip rather than re-rendering
     a car, so adding a colour costs nothing. ------------------------- */

  /* --- Act 6 — Epilogue (Tier 1) ---------------------------------- */
  {
    id: "A6-010",
    act: "epilogue",
    from: 0,
    to: 1,
    description: "Camera rises out of the showroom at 24mm, revealing the full floor and the whole range as one composed shot.",
    file: "Showroom-A6-010_rise-out.mp4",
    // Trimmed at 8.0s. The camera keeps climbing past this point and the
    // overhead cross-rig comes down into frame; 8.0s is the last moment the
    // wide reveal of the range is clean. This is now the film's last frame.
    trimEnd: 0.664,
    tier: 1,
    model: "cinematic_studio_video_v2",
    seed: "chain",
    ...pro(12),
  },
];

/* ------------------------------------------------------------------ */
/* Resolution to global scroll space                                   */
/* ------------------------------------------------------------------ */

/**
 * Origin the browser fetches clips from. Empty — the default — serves them
 * from the app's own /clips, which is what local development uses.
 *
 * Point it at an R2 bucket's public origin and the 286MB of video comes off
 * object storage instead. The app bundle is 168KB, so there is little reason
 * for the two to share a host, and R2 charges nothing for egress.
 *
 * NEXT_PUBLIC_ because it is read in the browser, and it is the only R2 value
 * that is safe to expose. The account id and keys stay in .env.local without
 * that prefix, so they are never inlined into the client bundle; only
 * scripts/upload-clips-r2.mjs reads them.
 */
/**
 * Where the clips actually live. Committed rather than left to configuration.
 *
 * The 286MB of footage is gitignored — it is served from object storage, not
 * from the app — so a deployment built without this value points at
 * `/clips/…`, which does not exist, and every clip 404s. That is not a
 * hypothetical: the first Vercel deploy shipped exactly that way, because
 * `.env.local` holds the R2 keys and is correctly not in the repo, so the
 * variable simply was not there at build time.
 *
 * Defaulting to the real bucket means a clone, a preview branch and a fresh
 * deploy all work with no setup. The URL is public by design — it is inlined
 * into the client bundle and fetched by every visitor's browser — so there is
 * nothing here that was not already on the wire.
 */
const DEFAULT_CLIP_BASE = "https://pub-dc4ae1ce916f4ab387601a0adba9f6b3.r2.dev";

/**
 * `NEXT_PUBLIC_CLIP_BASE_URL` overrides it — set it to a custom domain when
 * moving off the rate-limited r2.dev hostname, which needs no code change.
 * Set it to the literal `local` to serve from this origin's own /clips
 * instead, which is what you want when working offline against
 * `public/clips`. An explicit word rather than an empty string, because an
 * unset NEXT_PUBLIC_ variable is not reliably distinguishable from a blank
 * one once the bundler has inlined it.
 */
const RAW_CLIP_BASE = (() => {
  const raw = (process.env.NEXT_PUBLIC_CLIP_BASE_URL ?? "").trim();
  if (raw === "") return DEFAULT_CLIP_BASE;
  if (raw === "local") return "";
  return raw;
})();

const CLIP_BASE = RAW_CLIP_BASE.endsWith("/")
  ? RAW_CLIP_BASE.slice(0, -1)
  : RAW_CLIP_BASE;

export interface ResolvedShot extends ShotDef {
  /** Global scroll progress, 0–1. */
  globalFrom: number;
  globalTo: number;
  /** Public URL of the clip. */
  src: string;
}

export const RESOLVED_SHOTS: ResolvedShot[] = SHOTS.map((s) => {
  const act = ACTS[s.act];
  return {
    ...s,
    globalFrom: lerp(act.start, act.end, s.from),
    globalTo: lerp(act.start, act.end, s.to),
    src: CLIP_BASE ? `${CLIP_BASE}/clips/${s.file}` : `/clips/${s.file}`,
  };
});

/** The shot covering a given global scroll position, if any. */
const LAST_SHOT: ResolvedShot | undefined = RESOLVED_SHOTS.reduce<
  ResolvedShot | undefined
>((best, s) => (!best || s.globalTo > best.globalTo ? s : best), undefined);

export const shotAt = (p: number): ResolvedShot | undefined => {
  const hit = RESOLVED_SHOTS.find((s) => p >= s.globalFrom && p < s.globalTo);
  if (hit) return hit;
  // Every range is half-open, so p === 1 matches nothing. Falling through to
  // "no clip here" means the film's last frame is replaced by the empty
  // real-time room for as long as the visitor rests at the bottom.
  return p >= 1 ? LAST_SHOT : undefined;
};

/** Progress through a shot, 0–1 — this is what drives `video.currentTime`. */
export const shotProgress = (p: number, s: ResolvedShot): number => {
  const span = s.globalTo - s.globalFrom;
  if (span <= 0) return 0;
  const t = (p - s.globalFrom) / span;
  return t < 0 ? 0 : t > 1 ? 1 : t;
};

/**
 * Where in the source file to sit for a given scroll position, in seconds.
 * This is what drives `video.currentTime`, and it is the only place that
 * knows about trimming — everything upstream works in untrimmed shot progress.
 */
export const shotClipTime = (
  p: number,
  s: ResolvedShot,
  duration: number,
): number => {
  const a = s.trimStart ?? 0;
  const b = s.trimEnd ?? 1;
  return (a + shotProgress(p, s) * (b - a)) * duration;
};

/** First frame of the playable range — where an upcoming clip parks. */
export const shotStartTime = (s: ResolvedShot, duration: number): number =>
  (s.trimStart ?? 0) * duration;

/**
 * The next shot after `p`, so the loader can warm the upcoming hand-off pair
 * before the visitor reaches it.
 */
export const nextShotAfter = (p: number): ResolvedShot | undefined =>
  RESOLVED_SHOTS.find((s) => s.globalFrom > p);

/* ------------------------------------------------------------------ */
/* Budget                                                              */
/* ------------------------------------------------------------------ */

export const BUDGET = {
  /** Ceiling stated in the brief. */
  briefCeiling: 400,
  /** Credits actually available on the connected Higgsfield account. */
  accountBalance: 372.24,
  get stills() {
    return STILLS.reduce((s, x) => s + x.credits, 0);
  },
  get tier1() {
    return SHOTS.filter((s) => s.tier === 1).reduce((s, x) => s + x.credits, 0);
  },
  get tier2() {
    return SHOTS.filter((s) => s.tier === 2).reduce((s, x) => s + x.credits, 0);
  },
  get firstPass() {
    return this.stills + this.tier1 + this.tier2;
  },
  /**
   * Credits spent on re-generations, which produce no new manifest row and so
   * are invisible to the sums above. Act 4's Apex RS and Basalt each needed a
   * second pass after the first inherited the wrong vehicle from its seed
   * frame — see the shot list, §10.
   */
  corrections: 20,
  /** Everything actually charged to the account. */
  get totalSpent() {
    return this.firstPass + this.corrections;
  },
  /** What is left. */
  get correctionBuffer() {
    return this.accountBalance - this.totalSpent;
  },
};
