/**
 * timeline.ts — the master scroll map.
 *
 * One continuous route, one scroll axis. Every act, beat, vehicle chapter and
 * camera state is expressed as a slice of global scroll progress `p` in [0,1].
 *
 * Nothing here touches the DOM. The pinned stage, the video layer, the 3D scene
 * and the text overlays all read the same numbers from this file, which is what
 * keeps them frame-locked to each other.
 *
 * To retime the film, change the `vh` values below. Everything re-derives.
 */

import { flagship, realtimeVehicles, type CategoryId } from "./content";

/* ------------------------------------------------------------------ */
/* Acts                                                                */
/* ------------------------------------------------------------------ */

export type ActId =
  | "void" // Act 0 — dark space, floating components, wordmark resolve
  | "assembly" // Act 1 — the car builds itself
  | "showcase" // Act 2 — hero orbit of the finished flagship
  | "showroom" // Act 3 — the environment constructs around it
  | "lineup" // Act 3b — spatial reveal across the rest of the range
  | "explore" // Act 4 + 5 — per-vehicle beat, spec sheet, configurator
  | "epilogue"; // Act 6 — rise out, contact and invitation

interface ActDef {
  id: ActId;
  label: string;
  /** Scroll distance this act occupies, in viewport heights. */
  vh: number;
}

/** Per-vehicle chapter length inside `explore`, in viewport heights. */
const EXPLORE_VH_PER_VEHICLE = 150;
/** Per-vehicle reveal length inside `lineup`, in viewport heights. */
const LINEUP_VH_PER_VEHICLE = 60;
/**
 * How many vehicles get a reveal in Act 3b.
 *
 * The act is a three-clip transition montage, but it used to be sized for all
 * six and padded by replaying the same three clips a second time — so the
 * range appeared to loop: a vehicle was introduced, the film cut back to the
 * car before it, and introduced it again. The montage now runs once and the
 * act is sized to the footage that actually exists. Every vehicle still gets
 * its own full chapter in Act 4, so nothing is lost by shortening this.
 */
export const LINEUP_REVEAL_COUNT = 3;

const ACT_DEFS: ActDef[] = [
  { id: "void", label: "The Void", vh: 100 },
  { id: "assembly", label: "Assembly", vh: 520 },
  { id: "showcase", label: "Showcase", vh: 260 },
  { id: "showroom", label: "Showroom", vh: 200 },
  {
    id: "lineup",
    label: "The Range",
    vh: LINEUP_VH_PER_VEHICLE * LINEUP_REVEAL_COUNT,
  },
  {
    id: "explore",
    label: "Exploration",
    vh: EXPLORE_VH_PER_VEHICLE * realtimeVehicles.length,
  },
  { id: "epilogue", label: "Meridian", vh: 120 },
];

export interface ActRange {
  id: ActId;
  label: string;
  vh: number;
  /** Global scroll progress at which this act begins, 0–1. */
  start: number;
  /** Global scroll progress at which this act ends, 0–1. */
  end: number;
  index: number;
}

export const TOTAL_VH: number = ACT_DEFS.reduce((sum, a) => sum + a.vh, 0);

export const ACT_LIST: ActRange[] = (() => {
  let cursor = 0;
  return ACT_DEFS.map((def, index) => {
    const start = cursor / TOTAL_VH;
    cursor += def.vh;
    const end = cursor / TOTAL_VH;
    return { ...def, start, end, index };
  });
})();

export const ACTS: Record<ActId, ActRange> = Object.fromEntries(
  ACT_LIST.map((a) => [a.id, a]),
) as Record<ActId, ActRange>;

/* ------------------------------------------------------------------ */
/* Progress helpers                                                    */
/* ------------------------------------------------------------------ */

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Inverse lerp, clamped. Maps `v` from the range [a,b] onto [0,1]. */
export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp01((v - a) / (b - a));

/** Progress through a single act, 0–1. */
export const actProgress = (p: number, id: ActId): number => {
  const a = ACTS[id];
  return invLerp(a.start, a.end, p);
};

/** True when global progress sits inside the act (with a small margin). */
export const inAct = (p: number, id: ActId, margin = 0): boolean => {
  const a = ACTS[id];
  return p >= a.start - margin && p <= a.end + margin;
};

/** Smoothstep — the default easing for anything that must not feel linear. */
export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Slow in, slow out, with a longer tail. Used for camera moves. */
export const easeInOutCubic = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/**
 * Mechanical settle. Overshoots very slightly, then damps to a stop — the
 * motion signature of a part seating into its mount and locking. Used by every
 * assembly beat so the whole build feels like one machine.
 */
export const easeMechanical = (t: number): number => {
  const x = clamp01(t);
  if (x >= 1) return 1;
  // Fast approach for the first 78%, then a damped oscillation into the seat.
  const approach = 1 - Math.pow(1 - x, 3);
  const settle = Math.exp(-9 * x) * Math.sin(11 * Math.PI * x) * 0.055;
  return approach + settle;
};

/** Fade band helper: 0 outside [a,b], ramping in/out over `edge`. */
export const band = (p: number, a: number, b: number, edge = 0.08): number => {
  if (p < a || p > b) return 0;
  const span = b - a;
  const e = Math.min(edge, span / 2);
  return Math.min(smoothstep(invLerp(a, a + e, p)), smoothstep(invLerp(b, b - e, p)));
};

/* ------------------------------------------------------------------ */
/* Act 1 — assembly beats                                              */
/* ------------------------------------------------------------------ */

export type BeatId =
  | "chassis"
  | "powertrain"
  | "suspension"
  | "panels"
  | "glazing"
  | "lighting"
  | "interior"
  | "rolling"
  | "paint";

interface BeatDef {
  id: BeatId;
  label: string;
  /** Relative share of Act 1. Not normalised — the code does that. */
  weight: number;
}

/**
 * The build order. This is mechanical logic, not arbitrary: nothing may seat
 * into a structure that has not arrived yet. Panels cannot hang before the
 * suspension defines the wheel arches; glass cannot seal before panels exist.
 */
const BEAT_DEFS: BeatDef[] = [
  { id: "chassis", label: "Chassis and subframe", weight: 1.05 },
  { id: "powertrain", label: "Engine and drivetrain", weight: 1.05 },
  { id: "suspension", label: "Suspension and wheel wells", weight: 0.85 },
  { id: "panels", label: "Body panels", weight: 1.35 },
  { id: "glazing", label: "Glass and doors", weight: 1.05 },
  { id: "lighting", label: "Lighting and grille", weight: 1.0 },
  { id: "interior", label: "Interior", weight: 1.05 },
  { id: "rolling", label: "Exhaust, wheels and tyres", weight: 1.25 },
  { id: "paint", label: "Finish", weight: 1.0 },
];

export interface BeatRange {
  id: BeatId;
  label: string;
  /** Progress within Act 1, 0–1. */
  start: number;
  end: number;
  index: number;
}

export const BEATS: BeatRange[] = (() => {
  const total = BEAT_DEFS.reduce((s, b) => s + b.weight, 0);
  let cursor = 0;
  return BEAT_DEFS.map((def, index) => {
    const start = cursor / total;
    cursor += def.weight;
    return { id: def.id, label: def.label, start, end: cursor / total, index };
  });
})();

export const BEAT_BY_ID: Record<BeatId, BeatRange> = Object.fromEntries(
  BEATS.map((b) => [b.id, b]),
) as Record<BeatId, BeatRange>;

/**
 * Beats overlap slightly so the build never stalls — the most important rule in
 * the brief is that nothing is ever frozen waiting for the camera. A part
 * begins moving before the previous group has fully locked.
 */
const BEAT_OVERLAP = 0.22;

/** Progress of one assembly beat given progress through Act 1, 0–1. */
export const beatProgress = (assemblyP: number, id: BeatId): number => {
  const b = BEAT_BY_ID[id];
  const span = b.end - b.start;
  return clamp01(invLerp(b.start - span * BEAT_OVERLAP, b.end, assemblyP));
};

/* ------------------------------------------------------------------ */
/* Per-vehicle chapters                                                */
/* ------------------------------------------------------------------ */

export interface VehicleChapter {
  id: CategoryId;
  index: number;
  /** Global scroll range of this vehicle's Act 4 + 5 chapter. */
  start: number;
  end: number;
  /** Global scroll range of this vehicle's Act 3b spatial reveal. */
  revealStart: number;
  revealEnd: number;
}

export const CHAPTERS: VehicleChapter[] = realtimeVehicles.map((v, index) => {
  const explore = ACTS.explore;
  const lineup = ACTS.lineup;
  const eSpan = (explore.end - explore.start) / realtimeVehicles.length;
  // The lineup covers only the first LINEUP_REVEAL_COUNT vehicles. The rest
  // get a zero-width reveal, which never becomes visible, and their proper
  // introduction in Act 4 instead.
  const lSpan = (lineup.end - lineup.start) / LINEUP_REVEAL_COUNT;
  const revealed = index < LINEUP_REVEAL_COUNT;
  return {
    id: v.id,
    index,
    start: explore.start + eSpan * index,
    end: explore.start + eSpan * (index + 1),
    revealStart: revealed ? lineup.start + lSpan * index : lineup.end,
    revealEnd: revealed ? lineup.start + lSpan * (index + 1) : lineup.end,
  };
});

/** The vehicles that actually get an Act 3b reveal. */
export const LINEUP_REVEALS: VehicleChapter[] = CHAPTERS.slice(
  0,
  LINEUP_REVEAL_COUNT,
);

export const chapterFor = (id: CategoryId): VehicleChapter | undefined =>
  CHAPTERS.find((c) => c.id === id);

/**
 * Which vehicle currently holds focus, and how strongly. Used by the lighting
 * rig, the configurator and the spec overlay so they never disagree about who
 * the subject is.
 */
export const focusedVehicle = (
  p: number,
): { id: CategoryId | null; strength: number; local: number } => {
  for (const c of CHAPTERS) {
    if (p >= c.start && p < c.end) {
      const local = invLerp(c.start, c.end, p);
      // Ramp focus in and out so hand-offs between cars are not a hard cut.
      const strength = band(local, 0, 1, 0.14);
      return { id: c.id, strength, local };
    }
  }
  for (const c of CHAPTERS) {
    if (p >= c.revealStart && p < c.revealEnd) {
      return { id: c.id, strength: 0.4, local: invLerp(c.revealStart, c.revealEnd, p) };
    }
  }
  return { id: null, strength: 0, local: 0 };
};

/**
 * Sub-beats inside one vehicle chapter. Act 4 (signature move + spec sheet)
 * runs first, then Act 5 (configuration) takes over the same pinned frame.
 */
export const CHAPTER_BEATS = {
  /** Camera settles into a focused orbit of this car. */
  arrive: [0.0, 0.18] as const,
  /** The signature component performs its move. Code-driven, never video. */
  signature: [0.14, 0.5] as const,
  /** Full spec sheet resolves alongside the car. */
  specs: [0.3, 0.66] as const,
  /** Act 5 — paint, trim and packages become live controls. */
  configure: [0.6, 1.0] as const,
};

/* ------------------------------------------------------------------ */
/* Camera continuity bible (encoded)                                   */
/* ------------------------------------------------------------------ */

/** Vertical FOV in degrees for a focal length on full-frame (24mm sensor height). */
export const fovFromFocal = (mm: number): number =>
  (2 * Math.atan(12 / mm) * 180) / Math.PI;

export interface CameraState {
  /** Focal length in mm. Converted to FOV at render time. */
  focal: number;
  /** Camera height above the floor, metres. */
  height: number;
  /** Distance from the subject, metres. */
  radius: number;
  /** Orbit angle in radians. Continuous — it accumulates across acts. */
  angle: number;
  /** Height of the point the camera aims at, metres. */
  targetY: number;
}

/* ------------------------------------------------------------------ */
/* Showroom floor layout                                               */
/* ------------------------------------------------------------------ */

/**
 * Where each vehicle stands on the finished showroom floor, in metres.
 * The flagship holds the origin — it is the anchor the whole room is built
 * around — and the rest of the range runs away from it down a staggered
 * avenue, so the Act 3b glide reveals them one at a time in depth rather
 * than presenting them as a grid.
 */
export interface FloorSlot {
  id: CategoryId;
  x: number;
  z: number;
  /** Y rotation in radians — each car is angled slightly toward the aisle. */
  rotY: number;
}

export const HERO_SLOT: FloorSlot = { id: flagship.id, x: 0, z: 0, rotY: 0 };

export const FLOOR_SLOTS: FloorSlot[] = [
  HERO_SLOT,
  ...realtimeVehicles.map((v, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    return {
      id: v.id,
      x: side * 3.6,
      z: -(13 + i * 10.5),
      rotY: side * 0.28,
    };
  }),
];

export const slotFor = (id: CategoryId): FloorSlot =>
  FLOOR_SLOTS.find((s) => s.id === id) ?? HERO_SLOT;

/**
 * The point the camera orbits at a given scroll position. Acts 0–3 hold the
 * flagship at the origin; from the lineup onward the pivot glides down the
 * avenue to whichever car currently holds focus.
 */
export const pivotAt = (p: number): { x: number; z: number } => {
  if (p < ACTS.lineup.start) return { x: 0, z: 0 };

  if (p >= ACTS.epilogue.start) {
    // Rising out — pull the pivot back to the middle of the room so the
    // aerial composes the whole floor rather than one car.
    const t = smoothstep(actProgress(p, "epilogue"));
    const last = slotFor(CHAPTERS[CHAPTERS.length - 1].id);
    const mid = { x: 0, z: -((13 + (CHAPTERS.length - 1) * 10.5) / 2) };
    return { x: lerp(last.x, mid.x, t), z: lerp(last.z, mid.z, t) };
  }

  // Walk the pivot between consecutive slots across lineup + explore.
  const stops = [HERO_SLOT, ...CHAPTERS.map((c) => slotFor(c.id))];
  const span = ACTS.epilogue.start - ACTS.lineup.start;
  const t = clamp01((p - ACTS.lineup.start) / span) * (stops.length - 1);
  const i = Math.min(Math.floor(t), stops.length - 2);
  const f = smoothstep(t - i);
  return {
    x: lerp(stops[i].x, stops[i + 1].x, f),
    z: lerp(stops[i].z, stops[i + 1].z, f),
  };
};

/**
 * One keyframe per act boundary. The rig interpolates between them, so the
 * camera never cuts — the last state of every act IS the first state of the
 * next, which is the hand-off rule expressed in code rather than in ffmpeg.
 */
export const CAMERA_KEYS: { at: number; state: CameraState }[] = [
  // Act 0 — 35mm, eye level, close in among the floating components.
  { at: ACTS.void.start, state: { focal: 35, height: 1.15, radius: 3.4, angle: -0.55, targetY: 0.95 } },
  { at: ACTS.void.end, state: { focal: 35, height: 1.2, radius: 4.6, angle: 0.15, targetY: 0.9 } },

  // Act 1 — 35mm, rising 1.2m -> 1.8m as the car completes, then easing back
  // to 1.6m and zooming to 50mm across the final beats so it arrives already
  // holding the Act 2 orbit state. The bible's two rows meet inside this act
  // rather than at the boundary, which is what keeps the film from cutting.
  { at: ACTS.assembly.start, state: { focal: 35, height: 1.2, radius: 4.6, angle: 0.15, targetY: 0.9 } },
  { at: lerp(ACTS.assembly.start, ACTS.assembly.end, 0.5), state: { focal: 35, height: 1.62, radius: 5.6, angle: 1.5, targetY: 0.78 } },
  { at: lerp(ACTS.assembly.start, ACTS.assembly.end, 0.82), state: { focal: 42, height: 1.8, radius: 6.4, angle: 2.2, targetY: 0.74 } },
  { at: ACTS.assembly.end, state: { focal: 50, height: 1.6, radius: 6.9, angle: 2.62, targetY: 0.7 } },

  // Act 2 — 50mm, fixed 1.6m, constant-radius orbit.
  { at: ACTS.showcase.start, state: { focal: 50, height: 1.6, radius: 6.9, angle: 2.62, targetY: 0.7 } },
  { at: ACTS.showcase.end, state: { focal: 50, height: 1.6, radius: 6.9, angle: 5.9, targetY: 0.7 } },

  // Act 3 — widening to 28mm and rising, to sell the scale of the room.
  { at: ACTS.showroom.start, state: { focal: 50, height: 1.6, radius: 6.9, angle: 5.9, targetY: 0.7 } },
  { at: ACTS.showroom.end, state: { focal: 28, height: 3.4, radius: 12.5, angle: 7.1, targetY: 0.85 } },

  // Act 3b — gliding down the avenue past the range. The tail already
  // descends back to the Act 4 orbit so the first car is entered, not cut to.
  { at: ACTS.lineup.start, state: { focal: 28, height: 3.4, radius: 12.5, angle: 7.1, targetY: 0.85 } },
  { at: lerp(ACTS.lineup.start, ACTS.lineup.end, 0.7), state: { focal: 32, height: 2.6, radius: 10.0, angle: 8.2, targetY: 0.82 } },
  { at: ACTS.lineup.end, state: { focal: 50, height: 1.6, radius: 6.8, angle: 8.6, targetY: 0.78 } },

  // Act 4 + 5 — the 50mm 1.6m orbit, roughly two radians per car so every
  // vehicle gets a genuine focused orbit rather than a static presentation.
  { at: ACTS.explore.start, state: { focal: 50, height: 1.6, radius: 6.8, angle: 8.6, targetY: 0.78 } },
  { at: ACTS.explore.end, state: { focal: 50, height: 1.6, radius: 6.8, angle: 8.6 + 2.0 * CHAPTERS.length, targetY: 0.78 } },

  // Act 6 — 24mm, rising out of the room.
  { at: ACTS.epilogue.start, state: { focal: 50, height: 1.6, radius: 6.8, angle: 8.6 + 2.0 * CHAPTERS.length, targetY: 0.78 } },
  { at: lerp(ACTS.epilogue.start, ACTS.epilogue.end, 0.45), state: { focal: 32, height: 6.5, radius: 13.0, angle: 9.6 + 2.0 * CHAPTERS.length, targetY: 0.4 } },
  { at: ACTS.epilogue.end, state: { focal: 24, height: 19.0, radius: 16.0, angle: 10.3 + 2.0 * CHAPTERS.length, targetY: 0.0 } },
];

/** Interpolate the rig state for any global scroll position. */
export const cameraAt = (p: number): CameraState => {
  const keys = CAMERA_KEYS;
  if (p <= keys[0].at) return keys[0].state;
  if (p >= keys[keys.length - 1].at) return keys[keys.length - 1].state;

  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].at) i++;

  const a = keys[i];
  const b = keys[i + 1];
  const t = easeInOutCubic(invLerp(a.at, b.at, p));

  return {
    focal: lerp(a.state.focal, b.state.focal, t),
    height: lerp(a.state.height, b.state.height, t),
    radius: lerp(a.state.radius, b.state.radius, t),
    angle: lerp(a.state.angle, b.state.angle, t),
    targetY: lerp(a.state.targetY, b.state.targetY, t),
  };
};

/**
 * Development guard for the hand-off rule. Every act boundary must have a
 * matching pair of camera keys — if a boundary state jumps, the film cuts, and
 * a cut is the one thing this experience is not allowed to do.
 */
export const validateHandoffs = (): string[] => {
  const problems: string[] = [];
  const EPS = 1e-4;
  for (const act of ACT_LIST) {
    const before = CAMERA_KEYS.filter((k) => Math.abs(k.at - act.start) < EPS);
    if (before.length === 2) {
      const [x, y] = before;
      const drift =
        Math.abs(x.state.height - y.state.height) +
        Math.abs(x.state.radius - y.state.radius) +
        Math.abs(x.state.angle - y.state.angle) +
        Math.abs(x.state.targetY - y.state.targetY) +
        // Lens is part of the hand-off rule, not just position.
        Math.abs(x.state.focal - y.state.focal) * 0.1;
      if (drift > EPS) {
        problems.push(
          `Camera jumps at the start of "${act.label}" (drift ${drift.toFixed(3)}). ` +
            `The outgoing and incoming keys must match in position and aim.`,
        );
      }
    }
  }
  return problems;
};
