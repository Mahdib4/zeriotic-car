"use client";

/**
 * Vehicle.tsx — one car, and its assembly.
 *
 * Every part is a real, separately-transformed object with a home transform, a
 * position out in the void, and a beat that owns its arrival. The whole thing
 * is driven from `scrollState` inside a single useFrame, so a 130-part
 * assembly costs zero React renders per frame.
 *
 * The brief's most important rule is enforced structurally here: no part is
 * ever simply faded in, and nothing sits still. Parts that have arrived keep a
 * residual micro-motion until their beat fully locks, and parts that have not
 * arrived yet drift and rotate in the void.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  type Vehicle as VehicleData,
  type PaintOption,
  type TrimOption,
} from "@/lib/content";
import {
  actProgress,
  band,
  beatProgress,
  chapterFor,
  CHAPTER_BEATS,
  clamp01,
  easeMechanical,
  invLerp,
  smoothstep,
  type BeatId,
} from "@/lib/timeline";
import { scrollState } from "@/lib/scroll";
import { vehicleGeometry, topY, type VehicleGeometry } from "./geometry";
import {
  applyLightState,
  applyPaintOption,
  applyPaintResolve,
  applyTrimOption,
  createVehicleMaterials,
  type VehicleMaterials,
} from "./materials";

/* ------------------------------------------------------------------ */
/* Part descriptors                                                    */
/* ------------------------------------------------------------------ */

type Dir = "below" | "above" | "left" | "right" | "front" | "rear";

interface PartDesc {
  id: string;
  beat: BeatId;
  /** Stagger within the beat, 0-based. */
  order: number;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  pos: [number, number, number];
  rot?: [number, number, number];
  /** Where this part waits before its beat calls it in. */
  dir: Dir;
  spread?: number;
  tag?: string;
}

interface Runtime {
  desc: PartDesc;
  group: THREE.Group | null;
  home: THREE.Vector3;
  away: THREE.Vector3;
  homeRot: THREE.Euler;
  awayRot: THREE.Euler;
  phase: number;
  stagger: number;
}

/** Deterministic 0–1 from a string, so the void never reshuffles on reload. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function awayPosition(
  home: [number, number, number],
  dir: Dir,
  spread: number,
  seed: number,
): THREE.Vector3 {
  const jx = (hash01(`x${seed}`) - 0.5) * 2.2;
  const jy = (hash01(`y${seed}`) - 0.5) * 1.6;
  const jz = (hash01(`z${seed}`) - 0.5) * 2.2;
  const v = new THREE.Vector3(...home);
  switch (dir) {
    case "below":
      v.add(new THREE.Vector3(jx * 0.5, -spread, jz * 0.5));
      break;
    case "above":
      v.add(new THREE.Vector3(jx * 0.6, spread, jz * 0.6));
      break;
    case "left":
      v.add(new THREE.Vector3(-spread, jy, jz));
      break;
    case "right":
      v.add(new THREE.Vector3(spread, jy, jz));
      break;
    case "front":
      v.add(new THREE.Vector3(jx, jy, spread));
      break;
    case "rear":
      v.add(new THREE.Vector3(jx, jy, -spread));
      break;
  }
  return v;
}

/* ------------------------------------------------------------------ */
/* Part list                                                           */
/* ------------------------------------------------------------------ */

type Detail = "hero" | "silhouette";

function buildParts(
  v: VehicleData,
  g: VehicleGeometry,
  m: VehicleMaterials,
  detail: Detail,
): PartDesc[] {
  const p = v.proportions;
  const d = g.d;
  const parts: PartDesc[] = [];
  const add = (x: PartDesc) => parts.push(x);

  const halfW = p.bodyWidth / 2;
  const sideX = halfW - 0.0425;
  const isMidEngine = v.id === "sports" || v.id === "performance";
  const isEV = v.id === "ev";
  const full = detail === "hero";

  /* --- Chassis -------------------------------------------------- */
  if (full) {
    add({ id: "rail-l", beat: "chassis", order: 0, geo: g.mech.rail, mat: m.steel, pos: [-0.42, d.sillY + 0.07, 0], dir: "below", spread: 3.2 });
    add({ id: "rail-r", beat: "chassis", order: 0, geo: g.mech.rail, mat: m.steel, pos: [0.42, d.sillY + 0.07, 0], dir: "below", spread: 3.2 });
    [-0.8, 0, 0.8].forEach((f, i) =>
      add({ id: `xmem-${i}`, beat: "chassis", order: 1, geo: g.mech.crossmember, mat: m.steel, pos: [0, d.sillY + 0.07, (p.wheelbase / 2) * f], dir: "below", spread: 2.8 }),
    );
    add({ id: "floorpan", beat: "chassis", order: 2, geo: g.mech.floorpan, mat: m.carbon, pos: [0, d.sillY + 0.02, 0], dir: "below", spread: 3.6 });
    add({ id: "tub", beat: "chassis", order: 3, geo: g.mech.tub, mat: m.carbon, pos: [0, d.sillY + ((p.beltlineY - p.rideHeight) * 0.86) / 2 + 0.04, -0.1], dir: "below", spread: 4.2 });
  } else {
    add({ id: "tub", beat: "chassis", order: 0, geo: g.mech.tub, mat: m.carbon, pos: [0, d.sillY + ((p.beltlineY - p.rideHeight) * 0.86) / 2 + 0.04, -0.1], dir: "below", spread: 3.4 });
    add({ id: "floorpan", beat: "chassis", order: 0, geo: g.mech.floorpan, mat: m.carbon, pos: [0, d.sillY + 0.02, 0], dir: "below", spread: 3.0 });
  }

  /* --- Powertrain ----------------------------------------------- */
  // Mid-engined cars carry the block behind the cabin and ahead of the rear
  // axle; everything else sits it over the front axle line.
  const engZ = isMidEngine ? -p.wheelbase * 0.42 : p.wheelbase * 0.34;
  const engY = d.sillY + 0.34;

  if (full && !isEV) {
    add({ id: "block", beat: "powertrain", order: 0, geo: g.mech.block, mat: m.engine, pos: [0, engY, engZ], dir: "above", spread: 3.4 });
    add({ id: "head-l", beat: "powertrain", order: 1, geo: g.mech.head, mat: m.engine, pos: [-0.16, engY + 0.29, engZ], dir: "above", spread: 3.0 });
    add({ id: "head-r", beat: "powertrain", order: 1, geo: g.mech.head, mat: m.engine, pos: [0.16, engY + 0.29, engZ], dir: "above", spread: 3.0 });
    for (let i = 0; i < 4; i++) {
      add({ id: `runner-${i}`, beat: "powertrain", order: 2, geo: g.mech.runner, mat: m.brightwork, pos: [-0.18 + i * 0.12, engY + 0.46, engZ], rot: [0.24, 0, 0], dir: "above", spread: 2.6 });
    }
    add({ id: "turbo-l", beat: "powertrain", order: 3, geo: g.mech.turbo, mat: m.engine, pos: [-0.34, engY + 0.06, engZ - 0.3], dir: "rear", spread: 2.4 });
    add({ id: "turbo-r", beat: "powertrain", order: 3, geo: g.mech.turbo, mat: m.engine, pos: [0.34, engY + 0.06, engZ - 0.3], dir: "rear", spread: 2.4 });
    add({ id: "pulley", beat: "powertrain", order: 3, geo: g.mech.pulley, mat: m.brightwork, pos: [0, engY, engZ + 0.33], rot: [0, Math.PI / 2, 0], dir: "front", spread: 2.4 });
    add({ id: "driveshaft", beat: "powertrain", order: 4, geo: g.mech.driveshaft, mat: m.brightwork, pos: [0, d.sillY + 0.12, isMidEngine ? -p.wheelbase * 0.4 : 0], dir: "below", spread: 2.8 });
    add({ id: "diff", beat: "powertrain", order: 4, geo: g.mech.diff, mat: m.steel, pos: [0, d.axleY, d.rearAxleZ], dir: "below", spread: 2.6 });
  }

  if (isEV) {
    add({ id: "battery", beat: full ? "powertrain" : "chassis", order: 0, geo: g.mech.batteryPack, mat: m.carbon, pos: [0, d.sillY + 0.08, 0], dir: "rear", spread: 4.4, tag: "battery" });
    if (full) {
      for (let i = 0; i < 5; i++) {
        add({ id: `cell-${i}`, beat: "powertrain", order: 1, geo: g.mech.batteryCell, mat: m.accent, pos: [0, d.sillY + 0.152, -p.wheelbase * 0.36 + i * ((p.wheelbase * 0.72) / 4)], dir: "rear", spread: 3.2, tag: "battery-cell" });
      }
    }
  }

  /* --- Suspension ----------------------------------------------- */
  if (full) {
    const corners: [number, number][] = [
      [-1, d.frontAxleZ],
      [1, d.frontAxleZ],
      [-1, d.rearAxleZ],
      [1, d.rearAxleZ],
    ];
    corners.forEach(([s, z], i) => {
      const dirSide: Dir = s < 0 ? "left" : "right";
      add({ id: `arm-lo-${i}`, beat: "suspension", order: 0, geo: g.mech.controlArm, mat: m.steel, pos: [s * d.wheelX * 0.55, d.axleY - 0.1, z], rot: [0, 0, s * 0.1], dir: dirSide, spread: 2.4, tag: `susp-${i}` });
      add({ id: `arm-hi-${i}`, beat: "suspension", order: 1, geo: g.mech.controlArm, mat: m.steel, pos: [s * d.wheelX * 0.5, d.axleY + 0.11, z], rot: [0, 0, s * -0.12], dir: dirSide, spread: 2.4, tag: `susp-${i}` });
      add({ id: `upright-${i}`, beat: "suspension", order: 2, geo: g.mech.upright, mat: m.steel, pos: [s * d.wheelX * 0.84, d.axleY, z], dir: dirSide, spread: 2.2, tag: `susp-${i}` });
      add({ id: `damper-${i}`, beat: "suspension", order: 3, geo: g.mech.damper, mat: m.brightwork, pos: [s * d.wheelX * 0.62, d.axleY + 0.16, z], rot: [0, 0, s * 0.16], dir: "above", spread: 2.6, tag: `damper-${i}` });
      for (let c = 0; c < 3; c++) {
        add({ id: `coil-${i}-${c}`, beat: "suspension", order: 3, geo: g.mech.springCoil, mat: m.accent, pos: [s * d.wheelX * 0.62 + s * c * 0.008, d.axleY + 0.08 + c * 0.07, z], rot: [Math.PI / 2, 0, 0], dir: "above", spread: 2.6, tag: `damper-${i}` });
      }
    });
  }

  /* --- Body panels ---------------------------------------------- */
  add({ id: "quarter-fl", beat: "panels", order: 0, geo: g.frontQuarterL, mat: m.paint, pos: [-sideX, 0, 0], dir: "left", spread: 5.2 });
  add({ id: "quarter-fr", beat: "panels", order: 0, geo: g.frontQuarterR, mat: m.paint, pos: [sideX, 0, 0], dir: "right", spread: 5.2 });
  add({ id: "quarter-rl", beat: "panels", order: 1, geo: g.rearQuarterL, mat: m.paint, pos: [-sideX, 0, 0], dir: "left", spread: 5.6 });
  add({ id: "quarter-rr", beat: "panels", order: 1, geo: g.rearQuarterR, mat: m.paint, pos: [sideX, 0, 0], dir: "right", spread: 5.6 });

  add({ id: "hood", beat: "panels", order: 2, geo: g.hood, mat: m.paint, pos: [g.hoodBridge.position[0], g.hoodBridge.position[1] - 0.024, g.hoodBridge.position[2]], rot: g.hoodBridge.rotation, dir: "above", spread: 4.4 });
  add({ id: "deck", beat: "panels", order: 2, geo: g.deck, mat: m.paint, pos: [g.deckBridge.position[0], g.deckBridge.position[1] - 0.024, g.deckBridge.position[2]], rot: g.deckBridge.rotation, dir: "above", spread: 4.4 });

  add({ id: "fascia-f", beat: "panels", order: 3, geo: g.frontFascia, mat: m.paint, pos: [0, d.sillY + (d.noseY - d.sillY) / 2, d.half - 0.1], dir: "front", spread: 4.8 });
  add({ id: "fascia-r", beat: "panels", order: 3, geo: g.rearFascia, mat: m.paint, pos: [0, d.sillY + (d.tailY - d.sillY) / 2, -d.half + 0.1], dir: "rear", spread: 4.8 });

  add({ id: "sill-l", beat: "panels", order: 4, geo: g.sill, mat: m.carbon, pos: [-(halfW - 0.05), d.sillY + 0.055, (d.doorFrontZ + d.doorRearZ) / 2], dir: "left", spread: 3.4 });
  add({ id: "sill-r", beat: "panels", order: 4, geo: g.sill, mat: m.carbon, pos: [halfW - 0.05, d.sillY + 0.055, (d.doorFrontZ + d.doorRearZ) / 2], dir: "right", spread: 3.4 });

  add({ id: "roof", beat: "panels", order: 5, geo: g.roof, mat: m.paint, pos: [0, p.roofY + 0.02, (d.roofFrontZ + d.roofRearZ) / 2], dir: "above", spread: 5.4 });

  /* --- Glazing and doors ---------------------------------------- */
  add({ id: "greenhouse", beat: "glazing", order: 0, geo: g.greenhouse, mat: m.glass, pos: [0, 0, 0], dir: "above", spread: 4.6 });
  add({ id: "bpillar-l", beat: "glazing", order: 1, geo: g.pillar, mat: m.carbon, pos: [-d.cabinHalfW * 0.98, (p.beltlineY + p.roofY) / 2, d.doorRearZ + 0.06], dir: "left", spread: 2.8 });
  add({ id: "bpillar-r", beat: "glazing", order: 1, geo: g.pillar, mat: m.carbon, pos: [d.cabinHalfW * 0.98, (p.beltlineY + p.roofY) / 2, d.doorRearZ + 0.06], dir: "right", spread: 2.8 });

  add({ id: "door-l", beat: "glazing", order: 2, geo: g.doorL, mat: m.paint, pos: [-sideX, 0, g.hingeZ], dir: "left", spread: 5.0, tag: "door-l" });
  add({ id: "door-r", beat: "glazing", order: 2, geo: g.doorR, mat: m.paint, pos: [sideX, 0, g.hingeZ], dir: "right", spread: 5.0, tag: "door-r" });

  /* --- Lighting and grille -------------------------------------- */
  const hlY = topY(d, d.half - 0.16) - 0.11;
  add({ id: "hl-l", beat: "lighting", order: 0, geo: g.headlight, mat: m.headlight, pos: [-p.bodyWidth * 0.29, hlY, d.half - 0.15], dir: "front", spread: 3.4, tag: "light" });
  add({ id: "hl-r", beat: "lighting", order: 0, geo: g.headlight, mat: m.headlight, pos: [p.bodyWidth * 0.29, hlY, d.half - 0.15], dir: "front", spread: 3.4, tag: "light" });
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    add({ id: `lens-${i}`, beat: "lighting", order: 1, geo: g.headlightLens, mat: m.headlight, pos: [s * p.bodyWidth * 0.29, hlY, d.half - 0.1], dir: "front", spread: 2.8, tag: "lens" });
  }
  add({ id: "tl-l", beat: "lighting", order: 2, geo: g.taillight, mat: m.taillight, pos: [-p.bodyWidth * 0.3, d.tailY - 0.09, -d.half + 0.13], dir: "rear", spread: 3.2, tag: "light" });
  add({ id: "tl-r", beat: "lighting", order: 2, geo: g.taillight, mat: m.taillight, pos: [p.bodyWidth * 0.3, d.tailY - 0.09, -d.half + 0.13], dir: "rear", spread: 3.2, tag: "light" });

  add({ id: "grille", beat: "lighting", order: 3, geo: g.grille, mat: m.carbon, pos: [0, d.sillY + 0.16, d.half - 0.06], dir: "front", spread: 3.0 });
  if (full) {
    for (let i = 0; i < 5; i++) {
      add({ id: `slat-${i}`, beat: "lighting", order: 4, geo: g.grilleSlat, mat: m.brightwork, pos: [0, d.sillY + 0.09 + i * 0.035, d.half - 0.04], dir: "front", spread: 2.4, tag: "grille-slat" });
    }
    add({ id: "mirror-sl", beat: "lighting", order: 5, geo: g.mirrorStalk, mat: m.carbon, pos: [-(halfW - 0.01), p.beltlineY + 0.04, p.cabinFront - 0.06], rot: [0, 0, Math.PI / 2.4], dir: "left", spread: 2.6 });
    add({ id: "mirror-sr", beat: "lighting", order: 5, geo: g.mirrorStalk, mat: m.carbon, pos: [halfW - 0.01, p.beltlineY + 0.04, p.cabinFront - 0.06], rot: [0, 0, -Math.PI / 2.4], dir: "right", spread: 2.6 });
    add({ id: "mirror-hl", beat: "lighting", order: 6, geo: g.mirrorHousing, mat: m.paint, pos: [-(halfW + 0.07), p.beltlineY + 0.07, p.cabinFront - 0.06], dir: "left", spread: 2.8 });
    add({ id: "mirror-hr", beat: "lighting", order: 6, geo: g.mirrorHousing, mat: m.paint, pos: [halfW + 0.07, p.beltlineY + 0.07, p.cabinFront - 0.06], dir: "right", spread: 2.8 });
  }

  /* --- Interior -------------------------------------------------- */
  if (full) {
    add({ id: "dash", beat: "interior", order: 0, geo: g.dash, mat: m.leather, pos: [0, p.beltlineY - 0.03, p.cabinFront - 0.24], dir: "above", spread: 3.0 });
    add({ id: "console", beat: "interior", order: 1, geo: g.console, mat: m.leather, pos: [0, d.sillY + 0.2, (p.cabinFront + p.cabinRear) / 2], dir: "above", spread: 2.8 });
    const seatZ = p.cabinRear + (p.cabinFront - p.cabinRear) * 0.42;
    [-1, 1].forEach((s, i) => {
      add({ id: `seat-base-${i}`, beat: "interior", order: 2, geo: g.seatBase, mat: m.leather, pos: [s * 0.34, d.sillY + 0.22, seatZ], dir: "above", spread: 3.2 });
      add({ id: `seat-back-${i}`, beat: "interior", order: 3, geo: g.seatBack, mat: m.leather, pos: [s * 0.34, d.sillY + 0.52, seatZ - 0.24], rot: [0.16, 0, 0], dir: "above", spread: 3.2, tag: i === 1 ? "seat-back" : undefined });
    });
    add({ id: "wheel-rim", beat: "interior", order: 4, geo: g.wheelRim, mat: m.carbon, pos: [-0.34, p.beltlineY - 0.02, p.cabinFront - 0.44], rot: [1.16, 0, 0], dir: "front", spread: 2.6 });
    for (let i = 0; i < 3; i++) {
      add({ id: `wheel-spoke-${i}`, beat: "interior", order: 5, geo: g.steeringWheel, mat: m.carbon, pos: [-0.34, p.beltlineY - 0.02, p.cabinFront - 0.44], rot: [1.16, 0, (i * Math.PI * 2) / 3], dir: "front", spread: 2.4 });
    }
  }

  /* --- Exhaust, aero and wheels --------------------------------- */
  if (full && !isEV) {
    add({ id: "exh-l", beat: "rolling", order: 0, geo: g.mech.exhaustPipe, mat: m.brightwork, pos: [-0.24, d.sillY + 0.05, -p.bodyLength * 0.16], dir: "below", spread: 2.8 });
    add({ id: "exh-r", beat: "rolling", order: 0, geo: g.mech.exhaustPipe, mat: m.brightwork, pos: [0.24, d.sillY + 0.05, -p.bodyLength * 0.16], dir: "below", spread: 2.8 });
    [-1, 1].forEach((s, i) =>
      add({ id: `tip-${i}`, beat: "rolling", order: 1, geo: g.mech.exhaustTip, mat: m.brightwork, pos: [s * 0.28, d.sillY + 0.09, -d.half + 0.04], dir: "rear", spread: 2.4, tag: "exhaust-tip" }),
    );
  }
  add({ id: "diffuser", beat: "rolling", order: 1, geo: g.diffuser, mat: m.carbon, pos: [0, d.sillY + 0.04, -d.half + 0.14], dir: "rear", spread: 3.0 });

  if (v.signatureMove === "wing-deploy") {
    add({ id: "wing", beat: "rolling", order: 2, geo: g.wing, mat: m.carbon, pos: [0, d.tailY + 0.24, -d.half + 0.36], dir: "above", spread: 3.6, tag: "wing" });
    [-1, 1].forEach((s, i) =>
      add({ id: `wing-up-${i}`, beat: "rolling", order: 2, geo: g.wingUpright, mat: m.carbon, pos: [s * p.bodyWidth * 0.34, d.tailY + 0.12, -d.half + 0.36], dir: "above", spread: 3.4, tag: "wing-upright" }),
    );
  }

  const spokeCount = full ? 5 : 0;
  const corners: [number, number, string][] = [
    [-1, d.frontAxleZ, "fl"],
    [1, d.frontAxleZ, "fr"],
    [-1, d.rearAxleZ, "rl"],
    [1, d.rearAxleZ, "rr"],
  ];
  corners.forEach(([s, z, name]) => {
    const x = s * d.wheelX;
    const wDir: Dir = z > 0 ? "front" : "rear";
    add({ id: `tire-${name}`, beat: "rolling", order: 3, geo: g.wheels.tire, mat: m.rubber, pos: [x, d.axleY, z], dir: wDir, spread: 6.5, tag: `wheel-${name}` });
    add({ id: `rim-${name}`, beat: "rolling", order: 3, geo: g.wheels.rim, mat: m.brightwork, pos: [x, d.axleY, z], dir: wDir, spread: 6.5, tag: `wheel-${name}` });
    add({ id: `cap-${name}`, beat: "rolling", order: 3, geo: g.wheels.cap, mat: m.carbon, pos: [x, d.axleY, z], dir: wDir, spread: 6.5, tag: `wheel-${name}` });
    if (full) {
      add({ id: `disc-${name}`, beat: "rolling", order: 3, geo: g.wheels.disc, mat: m.steel, pos: [x, d.axleY, z], dir: wDir, spread: 6.2, tag: `wheel-${name}-static` });
      add({ id: `cal-${name}`, beat: "rolling", order: 3, geo: g.wheels.caliper, mat: m.accent, pos: [x - s * 0.02, d.axleY + p.wheelRadius * 0.5, z], dir: wDir, spread: 6.2, tag: `wheel-${name}-static` });
      for (let i = 0; i < spokeCount; i++) {
        add({ id: `spoke-${name}-${i}`, beat: "rolling", order: 3, geo: g.wheels.spoke, mat: m.brightwork, pos: [x, d.axleY, z], rot: [(i * Math.PI * 2) / spokeCount, 0, 0], dir: wDir, spread: 6.5, tag: `wheel-${name}` });
      }
    }
  });

  return parts;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export interface VehicleProps {
  vehicle: VehicleData;
  role: "hero" | "lineup";
  detail: Detail;
  position: [number, number, number];
  rotationY: number;
  /** Act 5 selection. Changes rarely, so React state is the right home. */
  paint?: PaintOption;
  trim?: TrimOption;
}

const V_HOME = new THREE.Vector3();
const V_AWAY = new THREE.Vector3();

export function Vehicle({
  vehicle,
  role,
  detail,
  position,
  rotationY,
  paint,
  trim,
}: VehicleProps) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const coatRef = useRef<THREE.Mesh>(null);

  const geo = useMemo(
    () => vehicleGeometry(vehicle.id, vehicle.proportions),
    [vehicle],
  );
  const mats = useMemo(() => createVehicleMaterials(vehicle), [vehicle]);
  useEffect(() => () => mats.dispose(), [mats]);

  const parts = useMemo(
    () => buildParts(vehicle, geo, mats, detail),
    [vehicle, geo, mats, detail],
  );

  const runtime = useMemo<Runtime[]>(() => {
    const byBeat = new Map<BeatId, number>();
    for (const d of parts) byBeat.set(d.beat, Math.max(byBeat.get(d.beat) ?? 0, d.order));
    return parts.map((desc) => {
      const seed = hash01(`${vehicle.id}:${desc.id}`);
      const maxOrder = byBeat.get(desc.beat) ?? 1;
      return {
        desc,
        group: null,
        home: new THREE.Vector3(...desc.pos),
        away: awayPosition(desc.pos, desc.dir, desc.spread ?? 4, seed * 9973),
        homeRot: new THREE.Euler(...(desc.rot ?? [0, 0, 0])),
        awayRot: new THREE.Euler(
          (seed - 0.5) * 2.4,
          (hash01(`r${desc.id}`) - 0.5) * 3.2,
          (hash01(`q${desc.id}`) - 0.5) * 2.0,
        ),
        phase: seed * Math.PI * 2,
        // Later parts in a beat start later, but every beat still finishes
        // together, so the build reads as continuous rather than as a queue.
        stagger: maxOrder === 0 ? 0 : (desc.order / (maxOrder + 1)) * 0.55,
      };
    });
  }, [parts, vehicle.id]);

  const chapter = useMemo(() => chapterFor(vehicle.id), [vehicle.id]);
  const targetPaint = useRef(paint ?? vehicle.paints[0]);
  const targetTrim = useRef(trim ?? vehicle.trims[0]);
  targetPaint.current = paint ?? vehicle.paints[0];
  targetTrim.current = trim ?? vehicle.trims[0];

  useFrame((state, delta) => {
    const p = scrollState.p;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);

    /* -- how far through its own assembly is this car? -------------- */
    let assemblyP: number;
    let visible = true;

    if (role === "hero") {
      assemblyP = p < 0 ? 0 : actProgress(p, "assembly");
    } else if (chapter) {
      if (p < chapter.revealStart - 0.004) {
        visible = false;
        assemblyP = 0;
      } else {
        // A compressed version of the same build, finishing as the camera
        // arrives — the brief's "components finishing their assembly".
        assemblyP = smoothstep(clamp01(invLerp(chapter.revealStart, chapter.revealStart + (chapter.revealEnd - chapter.revealStart) * 0.62, p)));
      }
    } else {
      assemblyP = 1;
    }

    const root = rootRef.current;
    if (root) {
      root.visible = visible;
      if (!visible) return;
    }

    /* -- parts ------------------------------------------------------ */
    const lightBeat = beatProgress(assemblyP, "lighting");
    const paintBeat = beatProgress(assemblyP, "paint");

    for (const r of runtime) {
      const grp = r.group;
      if (!grp) continue;

      const raw = beatProgress(assemblyP, r.desc.beat);
      const local = clamp01((raw - r.stagger) / Math.max(0.0001, 1 - r.stagger));
      const e = easeMechanical(local);

      V_HOME.copy(r.home);
      V_AWAY.copy(r.away);
      grp.position.lerpVectors(V_AWAY, V_HOME, e);

      grp.rotation.set(
        THREE.MathUtils.lerp(r.awayRot.x, r.homeRot.x, e),
        THREE.MathUtils.lerp(r.awayRot.y, r.homeRot.y, e),
        THREE.MathUtils.lerp(r.awayRot.z, r.homeRot.z, e),
      );

      // Nothing is ever frozen: unseated parts drift and turn in the void.
      if (e < 0.999) {
        const idle = 1 - e;
        grp.position.y += Math.sin(t * 0.55 + r.phase) * 0.09 * idle;
        grp.position.x += Math.cos(t * 0.4 + r.phase) * 0.06 * idle;
        grp.rotation.y += Math.sin(t * 0.3 + r.phase) * 0.5 * idle;
      }

      // Wheels roll in rather than sliding.
      if (r.desc.tag?.startsWith("wheel-")) {
        const travel = V_AWAY.distanceTo(V_HOME) * (1 - e);
        grp.rotation.x += travel / Math.max(0.1, vehicle.proportions.wheelRadius);
      }
    }

    /* -- finish, lights, signature ---------------------------------- */
    applyPaintResolve(mats, role === "hero" ? paintBeat : Math.max(paintBeat, assemblyP > 0.98 ? 1 : 0));
    applyLightState(mats, lightBeat, lightBeat);

    // The coat bar: a travelling highlight that sells the matte-to-gloss
    // sweep as an event rather than a value change.
    if (coatRef.current) {
      const active = paintBeat > 0.001 && paintBeat < 0.999;
      coatRef.current.visible = active;
      if (active) {
        const d = geo.d;
        coatRef.current.position.z = THREE.MathUtils.lerp(d.half + 0.2, -d.half - 0.2, paintBeat);
        const mat = coatRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.sin(paintBeat * Math.PI) * 0.85;
      }
    }

    /* -- Act 5 material hand-off ------------------------------------ */
    const k = 1 - Math.pow(0.001, dt);
    applyPaintOption(mats, targetPaint.current.hex, targetPaint.current.metallic, k);
    applyTrimOption(mats, targetTrim.current.interiorHex, targetTrim.current.brightwork, k);

    /* -- signature move (Act 4), code-driven, zero credits ---------- */
    let sig = 0;
    if (chapter && p >= chapter.start && p <= chapter.end) {
      const local = invLerp(chapter.start, chapter.end, p);
      const [a, b] = CHAPTER_BEATS.signature;
      sig = band(local, a, b, 0.22);
    } else if (role === "hero") {
      sig = band(p, 0.34, 0.42, 0.03);
    }
    applySignature(vehicle.signatureMove, sig, runtime, bodyRef.current, mats, geo);
  });

  return (
    <group ref={rootRef} position={position} rotation={[0, rotationY, 0]}>
      <group ref={bodyRef}>
        {runtime.map((r, i) => (
          <group
            key={r.desc.id}
            ref={(el) => {
              runtime[i].group = el;
            }}
          >
            <mesh
              geometry={r.desc.geo}
              material={r.desc.mat}
              castShadow={false}
              receiveShadow={false}
            />
          </group>
        ))}

        {/* Travelling coat highlight for the paint-resolve beat. */}
        <mesh ref={coatRef} visible={false} rotation={[0, 0, 0]}>
          <planeGeometry args={[vehicle.proportions.bodyWidth * 1.35, vehicle.proportions.roofY * 1.5]} />
          <meshBasicMaterial
            color={vehicle.accentHex}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Signature moves — Act 4, entirely code-driven                       */
/* ------------------------------------------------------------------ */

function findByTag(runtime: Runtime[], tag: string): Runtime[] {
  return runtime.filter((r) => r.desc.tag === tag);
}

function applySignature(
  move: VehicleData["signatureMove"],
  t: number,
  runtime: Runtime[],
  body: THREE.Group | null,
  mats: VehicleMaterials,
  geo: VehicleGeometry,
): void {
  const e = smoothstep(t);
  if (e <= 0.0001 && move !== "suspension-lift") {
    // Still reset anything that may be mid-move.
  }

  switch (move) {
    case "battery-slide": {
      // The pack slides up into the floorpan and lights from within.
      for (const r of findByTag(runtime, "battery")) {
        if (!r.group) continue;
        r.group.position.z = r.home.z - (1 - e) * 0.0;
        r.group.position.y = r.home.y - (1 - e) * 0.14;
      }
      for (const r of findByTag(runtime, "battery-cell")) {
        if (!r.group) continue;
        r.group.position.y = r.home.y - (1 - e) * 0.14;
      }
      mats.accent.emissiveIntensity = Math.max(mats.accent.emissiveIntensity, e * 4.2);
      break;
    }
    case "suspension-lift": {
      // The body rises on its articulating suspension.
      if (body) body.position.y = e * 0.16;
      for (let i = 0; i < 4; i++) {
        for (const r of findByTag(runtime, `damper-${i}`)) {
          if (!r.group) continue;
          r.group.position.y = r.home.y + e * 0.05;
        }
        // Opposite corners articulate, which is what sells it as suspension
        // travel rather than the whole car simply moving up.
        const artic = (i === 0 || i === 3 ? 1 : -1) * e * 0.06;
        for (const r of findByTag(runtime, `susp-${i}`)) {
          if (!r.group) continue;
          r.group.position.y = r.home.y + artic;
        }
      }
      break;
    }
    case "wing-deploy": {
      for (const r of findByTag(runtime, "wing")) {
        if (!r.group) continue;
        r.group.position.y = r.home.y + e * 0.22;
        r.group.rotation.x = r.homeRot.x - e * 0.5;
      }
      for (const r of findByTag(runtime, "wing-upright")) {
        if (!r.group) continue;
        r.group.position.y = r.home.y + e * 0.11;
        r.group.scale.y = 1 + e * 0.9;
      }
      break;
    }
    case "door-present": {
      for (const r of findByTag(runtime, "door-l")) {
        if (!r.group) continue;
        r.group.rotation.y = r.homeRot.y - e * 0.85;
      }
      break;
    }
    case "grille-shutter": {
      const slats = findByTag(runtime, "grille-slat");
      slats.forEach((r, i) => {
        if (!r.group) return;
        const wave = Math.sin(e * Math.PI * 2 - i * 0.5);
        r.group.rotation.x = r.homeRot.x + wave * 0.7 * e;
      });
      break;
    }
    case "seat-recline": {
      for (const r of findByTag(runtime, "seat-back")) {
        if (!r.group) continue;
        r.group.rotation.x = r.homeRot.x + e * 0.55;
      }
      break;
    }
    case "quad-exhaust": {
      for (const r of findByTag(runtime, "exhaust-tip")) {
        if (!r.group) continue;
        r.group.scale.setScalar(1 + e * 0.12);
      }
      mats.accent.emissiveIntensity = Math.max(mats.accent.emissiveIntensity, e * 3.0);
      break;
    }
  }
  void geo;
}
