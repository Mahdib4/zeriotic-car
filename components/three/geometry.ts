/**
 * geometry.ts — the procedural vehicle.
 *
 * Every car on this site is generated from the `Proportions` block in
 * content.ts. No external models, no downloads, no licence questions, and
 * adding a vehicle costs nothing but a few numbers.
 *
 * The important design decision here: the body is NOT one mesh. It is built as
 * genuine, separable panels — quarter panels, doors, hood, roof, deck,
 * fascias — because the brief's central promise is that the car assembles
 * "panel by panel". A monolithic body could only ever fade in.
 *
 * Coordinate system, in metres:
 *   +Z  toward the nose        +X  toward the right-hand side
 *   +Y  up, with y = 0 at the floor
 */

import * as THREE from "three";
import type { Proportions } from "@/lib/content";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
};

/* ------------------------------------------------------------------ */
/* Derived dimensions                                                  */
/* ------------------------------------------------------------------ */

export interface Dims {
  p: Proportions;
  half: number;
  /** Bottom edge of the bodywork. */
  sillY: number;
  /** Height of the wheel centres. */
  axleY: number;
  /** Radius of the wheel arch opening. */
  archR: number;
  /** Top of the arch opening. */
  archTop: number;
  frontAxleZ: number;
  rearAxleZ: number;
  /** Lateral centre of a wheel. */
  wheelX: number;
  /** Z of the split between the door and the front quarter panel. */
  doorFrontZ: number;
  /** Z of the split between the door and the rear quarter panel. */
  doorRearZ: number;
  noseY: number;
  tailY: number;
  /** Half-width of the greenhouse. */
  cabinHalfW: number;
  /** Z of the front and rear edges of the roof panel. */
  roofFrontZ: number;
  roofRearZ: number;
}

export function dims(p: Proportions): Dims {
  const half = p.bodyLength / 2;
  const sillY = p.rideHeight;
  const axleY = p.wheelRadius;
  const archR = p.wheelRadius * 1.06;
  const archTop = axleY + archR;
  const frontAxleZ = p.wheelbase / 2;
  const rearAxleZ = -p.wheelbase / 2;
  const wheelX = p.bodyWidth / 2 - p.tireWidth / 2 - 0.02;
  const drop = (p.beltlineY - p.rideHeight) * p.noseDrop * 0.55;
  const cabinLen = p.cabinFront - p.cabinRear;

  // Pillar rake comes from the height of the glass and how wedge-shaped the
  // car is, not from cabin length. Deriving it from length made upright
  // vehicles lay their pillars down like a coupe.
  const glassH = Math.max(0.08, p.roofY - p.beltlineY);
  const rake = 0.8 + p.noseDrop * 1.8;
  const maxRun = Math.max(0.05, (cabinLen - 0.22) / 1.86);
  const frontRun = Math.min(glassH * rake, maxRun);
  const rearRun = Math.min(glassH * rake * 0.86, maxRun * 0.86);

  return {
    p,
    half,
    sillY,
    axleY,
    archR,
    archTop,
    frontAxleZ,
    rearAxleZ,
    wheelX,
    doorFrontZ: frontAxleZ - archR - 0.05,
    doorRearZ: rearAxleZ + archR + 0.05,
    noseY: Math.max(p.beltlineY - drop, archTop + 0.05),
    tailY: Math.max(p.beltlineY - (p.beltlineY - p.rideHeight) * 0.08, archTop + 0.05),
    cabinHalfW: (p.bodyWidth * (1 - p.roofTaper)) / 2,
    roofFrontZ: p.cabinFront - frontRun,
    roofRearZ: p.cabinRear + rearRun,
  };
}

/** Height of the top edge of the bodywork at a given Z. */
export function topY(d: Dims, z: number): number {
  const { p, half, noseY, tailY, archTop } = d;
  const noseRun = p.bodyLength * 0.2;
  const tailRun = p.bodyLength * 0.16;
  let y = p.beltlineY;
  if (z > half - noseRun) {
    y = lerp(p.beltlineY, noseY, smoothstep((z - (half - noseRun)) / noseRun));
  } else if (z < -half + tailRun) {
    y = lerp(p.beltlineY, tailY, smoothstep((-half + tailRun - z) / tailRun));
  }
  // The top edge may never dip into a wheel arch.
  return Math.max(y, archTop + 0.05);
}

/* ------------------------------------------------------------------ */
/* Side panels — extruded profiles with real wheel arches              */
/* ------------------------------------------------------------------ */

const ARCH_SEGMENTS = 16;
const TOP_SEGMENTS = 14;

/** Bottom outline of a Z-slice of the bodyside, including any wheel arch. */
function bottomEdge(d: Dims, z0: number, z1: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [new THREE.Vector2(z0, d.sillY)];
  const arches = [d.rearAxleZ, d.frontAxleZ]
    .filter((c) => c + d.archR > z0 && c - d.archR < z1)
    .sort((a, b) => a - b);

  for (const c of arches) {
    const a0 = Math.max(c - d.archR, z0);
    const a1 = Math.min(c + d.archR, z1);
    const yAt = (z: number) =>
      d.axleY + Math.sqrt(Math.max(0, d.archR * d.archR - (z - c) * (z - c)));

    pts.push(new THREE.Vector2(a0, d.sillY));
    pts.push(new THREE.Vector2(a0, yAt(a0)));
    for (let i = 1; i <= ARCH_SEGMENTS; i++) {
      const z = a0 + ((a1 - a0) * i) / ARCH_SEGMENTS;
      pts.push(new THREE.Vector2(z, yAt(z)));
    }
    pts.push(new THREE.Vector2(a1, d.sillY));
  }

  pts.push(new THREE.Vector2(z1, d.sillY));
  return dedupe(pts);
}

function dedupe(pts: THREE.Vector2[]): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 1e-5 || Math.abs(last.y - p.y) > 1e-5) {
      out.push(p);
    }
  }
  return out;
}

/**
 * One bodyside panel, extruded across `thickness`. Authored in the Z/Y plane
 * then rotated into place, so the profile reads as a true car silhouette
 * rather than a box with decals.
 */
export function sidePanelGeometry(
  d: Dims,
  z0: number,
  z1: number,
  thickness: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const bottom = bottomEdge(d, z0, z1);

  shape.moveTo(bottom[0].x, bottom[0].y);
  for (let i = 1; i < bottom.length; i++) shape.lineTo(bottom[i].x, bottom[i].y);

  shape.lineTo(z1, topY(d, z1));
  for (let i = TOP_SEGMENTS - 1; i >= 0; i--) {
    const z = z0 + ((z1 - z0) * i) / TOP_SEGMENTS;
    shape.lineTo(z, topY(d, z));
  }
  shape.closePath();

  const bevel = Math.min(0.018, thickness * 0.34);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - bevel * 2,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -(thickness - bevel * 2) / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** The greenhouse volume: windscreen, side glass, backlight as one shell. */
export function greenhouseGeometry(d: Dims, thickness: number): THREE.BufferGeometry {
  const { p } = d;
  const shape = new THREE.Shape();
  shape.moveTo(p.cabinRear, p.beltlineY);
  shape.lineTo(p.cabinFront, p.beltlineY);
  // A-pillar / windscreen
  shape.quadraticCurveTo(
    p.cabinFront - (p.cabinFront - d.roofFrontZ) * 0.45,
    p.roofY - (p.roofY - p.beltlineY) * 0.12,
    d.roofFrontZ,
    p.roofY,
  );
  shape.lineTo(d.roofRearZ, p.roofY);
  // C-pillar / backlight
  shape.quadraticCurveTo(
    p.cabinRear + (d.roofRearZ - p.cabinRear) * 0.45,
    p.roofY - (p.roofY - p.beltlineY) * 0.12,
    p.cabinRear,
    p.beltlineY,
  );
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 12,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/* Rounded box — the workhorse for panels, interior and hard parts     */
/* ------------------------------------------------------------------ */

export function roundedBoxGeometry(
  w: number,
  h: number,
  depth: number,
  radius = 0.03,
): THREE.BufferGeometry {
  const r = Math.max(0.002, Math.min(radius, w / 2 - 0.002, h / 2 - 0.002));
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const bevel = Math.min(r * 0.7, depth / 2 - 0.001);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 2),
    bevelEnabled: bevel > 0.0015,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 5,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/* Panels that bridge two points along the roofline                    */
/* ------------------------------------------------------------------ */

export interface Bridge {
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
}

/** Place a flat panel spanning (zA,yA) to (zB,yB) in the Z/Y plane. */
export function bridge(
  zA: number,
  yA: number,
  zB: number,
  yB: number,
): Bridge {
  const dz = zB - zA;
  const dy = yB - yA;
  return {
    position: [0, (yA + yB) / 2, (zA + zB) / 2],
    // Rotating about X tilts a Z-aligned panel to follow the roofline.
    rotation: [Math.atan2(dy, dz), 0, 0],
    length: Math.hypot(dz, dy),
  };
}

/* ------------------------------------------------------------------ */
/* Wheels                                                              */
/* ------------------------------------------------------------------ */

export interface WheelGeometries {
  tire: THREE.BufferGeometry;
  rim: THREE.BufferGeometry;
  spoke: THREE.BufferGeometry;
  disc: THREE.BufferGeometry;
  caliper: THREE.BufferGeometry;
  cap: THREE.BufferGeometry;
}

export function wheelGeometries(p: Proportions): WheelGeometries {
  const r = p.wheelRadius;
  const w = p.tireWidth;

  // Axis along X, so every cylinder is rotated onto its side.
  const tire = new THREE.CylinderGeometry(r, r, w, 40, 1, false);
  tire.rotateZ(Math.PI / 2);

  const rimR = r * 0.66;
  const rim = new THREE.CylinderGeometry(rimR, rimR, w * 0.94, 32, 1, false);
  rim.rotateZ(Math.PI / 2);

  const spoke = roundedBoxGeometry(w * 0.42, rimR * 0.92, 0.028, 0.012);
  spoke.rotateY(Math.PI / 2);

  const disc = new THREE.CylinderGeometry(r * 0.52, r * 0.52, 0.022, 28);
  disc.rotateZ(Math.PI / 2);

  const caliper = roundedBoxGeometry(w * 0.3, r * 0.42, 0.09, 0.02);

  const cap = new THREE.CylinderGeometry(rimR * 0.26, rimR * 0.26, w * 0.98, 20);
  cap.rotateZ(Math.PI / 2);

  return { tire, rim, spoke, disc, caliper, cap };
}

/* ------------------------------------------------------------------ */
/* Powertrain and chassis — only the flagship is ever taken this far   */
/* ------------------------------------------------------------------ */

export interface MechanicalGeometries {
  rail: THREE.BufferGeometry;
  crossmember: THREE.BufferGeometry;
  floorpan: THREE.BufferGeometry;
  tub: THREE.BufferGeometry;
  block: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  runner: THREE.BufferGeometry;
  pulley: THREE.BufferGeometry;
  turbo: THREE.BufferGeometry;
  driveshaft: THREE.BufferGeometry;
  diff: THREE.BufferGeometry;
  controlArm: THREE.BufferGeometry;
  upright: THREE.BufferGeometry;
  damper: THREE.BufferGeometry;
  springCoil: THREE.BufferGeometry;
  exhaustPipe: THREE.BufferGeometry;
  exhaustTip: THREE.BufferGeometry;
  batteryPack: THREE.BufferGeometry;
  batteryCell: THREE.BufferGeometry;
}

export function mechanicalGeometries(p: Proportions, d: Dims): MechanicalGeometries {
  const railLen = p.bodyLength * 0.78;
  const rail = roundedBoxGeometry(0.1, 0.13, railLen, 0.03);
  const crossmember = roundedBoxGeometry(p.bodyWidth * 0.6, 0.08, 0.09, 0.022);
  const floorpan = roundedBoxGeometry(p.bodyWidth * 0.82, 0.05, p.bodyLength * 0.8, 0.03);
  const tub = roundedBoxGeometry(
    p.bodyWidth * 0.74,
    (p.beltlineY - p.rideHeight) * 0.86,
    p.bodyLength * 0.6,
    0.06,
  );

  const block = roundedBoxGeometry(0.56, 0.44, 0.6, 0.05);
  const head = roundedBoxGeometry(0.5, 0.16, 0.56, 0.03);
  const runner = new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12);
  const pulley = new THREE.TorusGeometry(0.1, 0.028, 8, 20);
  const turbo = new THREE.SphereGeometry(0.13, 16, 12);
  const driveshaft = new THREE.CylinderGeometry(0.035, 0.035, p.wheelbase * 0.52, 12);
  driveshaft.rotateX(Math.PI / 2);
  const diff = new THREE.SphereGeometry(0.16, 18, 14);

  const controlArm = roundedBoxGeometry(0.3, 0.05, 0.09, 0.02);
  const upright = roundedBoxGeometry(0.07, 0.2, 0.09, 0.02);
  const damper = new THREE.CylinderGeometry(0.026, 0.03, 0.3, 12);
  const springCoil = new THREE.TorusGeometry(0.058, 0.011, 6, 18);

  const exhaustPipe = new THREE.CylinderGeometry(0.036, 0.036, p.bodyLength * 0.42, 12);
  exhaustPipe.rotateX(Math.PI / 2);
  const exhaustTip = new THREE.CylinderGeometry(0.055, 0.045, 0.14, 18, 1, true);
  exhaustTip.rotateX(Math.PI / 2);

  const batteryPack = roundedBoxGeometry(
    p.bodyWidth * 0.78,
    0.13,
    p.wheelbase * 0.94,
    0.03,
  );
  const batteryCell = roundedBoxGeometry(p.bodyWidth * 0.7, 0.015, 0.09, 0.006);

  void d;
  return {
    rail,
    crossmember,
    floorpan,
    tub,
    block,
    head,
    runner,
    pulley,
    turbo,
    driveshaft,
    diff,
    controlArm,
    upright,
    damper,
    springCoil,
    exhaustPipe,
    exhaustTip,
    batteryPack,
    batteryCell,
  };
}

/* ------------------------------------------------------------------ */
/* The full geometry set for one vehicle, built once and cached        */
/* ------------------------------------------------------------------ */

export interface VehicleGeometry {
  d: Dims;
  frontQuarterL: THREE.BufferGeometry;
  frontQuarterR: THREE.BufferGeometry;
  doorL: THREE.BufferGeometry;
  doorR: THREE.BufferGeometry;
  rearQuarterL: THREE.BufferGeometry;
  rearQuarterR: THREE.BufferGeometry;
  greenhouse: THREE.BufferGeometry;
  roof: THREE.BufferGeometry;
  hood: THREE.BufferGeometry;
  deck: THREE.BufferGeometry;
  frontFascia: THREE.BufferGeometry;
  rearFascia: THREE.BufferGeometry;
  sill: THREE.BufferGeometry;
  pillar: THREE.BufferGeometry;
  headlight: THREE.BufferGeometry;
  headlightLens: THREE.BufferGeometry;
  taillight: THREE.BufferGeometry;
  grille: THREE.BufferGeometry;
  grilleSlat: THREE.BufferGeometry;
  mirrorStalk: THREE.BufferGeometry;
  mirrorHousing: THREE.BufferGeometry;
  dash: THREE.BufferGeometry;
  seatBase: THREE.BufferGeometry;
  seatBack: THREE.BufferGeometry;
  wheelRim: THREE.BufferGeometry;
  steeringWheel: THREE.BufferGeometry;
  console: THREE.BufferGeometry;
  diffuser: THREE.BufferGeometry;
  wing: THREE.BufferGeometry;
  wingUpright: THREE.BufferGeometry;
  wheels: WheelGeometries;
  mech: MechanicalGeometries;
  /** Placement of the panels that follow the roofline. */
  hoodBridge: Bridge;
  deckBridge: Bridge;
  /** Z of the door hinge line. Door geometry is authored around this. */
  hingeZ: number;
}

const cache = new Map<string, VehicleGeometry>();

export function vehicleGeometry(key: string, p: Proportions): VehicleGeometry {
  const hit = cache.get(key);
  if (hit) return hit;

  const d = dims(p);
  const SIDE_T = 0.085;

  const mkSide = (z0: number, z1: number) => sidePanelGeometry(d, z0, z1, SIDE_T);

  const frontQuarter = mkSide(d.doorFrontZ, d.half);
  const rearQuarter = mkSide(-d.half, d.doorRearZ);

  // Side panels are authored at absolute Z, so they drop straight onto the
  // body at the origin. The doors are the exception: shifting their origin to
  // the hinge line is what lets them swing on the hinge rather than pivot
  // around the middle of the car.
  const door = mkSide(d.doorRearZ, d.doorFrontZ);
  door.translate(0, 0, -d.doorFrontZ);

  // Hood spans the windscreen base to the nose; deck spans the backlight to
  // the tail. Both follow the roofline rather than sitting flat.
  const hoodFrontZ = d.half - 0.1;
  const hoodBridge = bridge(p.cabinFront, topY(d, p.cabinFront), hoodFrontZ, topY(d, hoodFrontZ));
  const deckRearZ = -d.half + 0.1;
  const deckBridge = bridge(deckRearZ, topY(d, deckRearZ), p.cabinRear, topY(d, p.cabinRear));

  const bodyInnerW = p.bodyWidth - SIDE_T * 2 - 0.01;

  const g: VehicleGeometry = {
    d,
    frontQuarterL: frontQuarter,
    frontQuarterR: frontQuarter.clone(),
    doorL: door,
    doorR: door.clone(),
    rearQuarterL: rearQuarter,
    rearQuarterR: rearQuarter.clone(),
    greenhouse: greenhouseGeometry(d, d.cabinHalfW * 2),
    roof: roundedBoxGeometry(d.cabinHalfW * 2 * 0.97, 0.05, d.roofFrontZ - d.roofRearZ, 0.035),
    hood: roundedBoxGeometry(bodyInnerW, 0.05, hoodBridge.length, 0.03),
    deck: roundedBoxGeometry(bodyInnerW, 0.05, deckBridge.length, 0.03),
    frontFascia: roundedBoxGeometry(p.bodyWidth * 0.98, d.noseY - p.rideHeight, 0.2, 0.05),
    rearFascia: roundedBoxGeometry(p.bodyWidth * 0.98, d.tailY - p.rideHeight, 0.2, 0.05),
    sill: roundedBoxGeometry(0.09, 0.11, d.doorFrontZ - d.doorRearZ, 0.025),
    pillar: roundedBoxGeometry(0.05, p.roofY - p.beltlineY, 0.07, 0.02),

    headlight: roundedBoxGeometry(0.34, 0.11, 0.1, 0.03),
    headlightLens: new THREE.SphereGeometry(0.052, 16, 12),
    taillight: roundedBoxGeometry(0.3, 0.075, 0.06, 0.022),
    grille: roundedBoxGeometry(p.bodyWidth * 0.5, 0.18, 0.06, 0.03),
    grilleSlat: roundedBoxGeometry(p.bodyWidth * 0.47, 0.014, 0.05, 0.006),
    mirrorStalk: new THREE.CylinderGeometry(0.014, 0.014, 0.11, 8),
    mirrorHousing: roundedBoxGeometry(0.06, 0.07, 0.15, 0.025),

    dash: roundedBoxGeometry(bodyInnerW * 0.95, 0.16, 0.3, 0.05),
    seatBase: roundedBoxGeometry(0.44, 0.1, 0.46, 0.05),
    seatBack: roundedBoxGeometry(0.42, 0.56, 0.11, 0.05),
    wheelRim: new THREE.TorusGeometry(0.16, 0.019, 10, 28),
    steeringWheel: roundedBoxGeometry(0.03, 0.03, 0.15, 0.01),
    console: roundedBoxGeometry(0.22, 0.14, 0.7, 0.04),

    diffuser: roundedBoxGeometry(p.bodyWidth * 0.8, 0.1, 0.28, 0.02),
    wing: roundedBoxGeometry(p.bodyWidth * 0.86, 0.035, 0.24, 0.014),
    wingUpright: roundedBoxGeometry(0.03, 0.24, 0.14, 0.012),

    wheels: wheelGeometries(p),
    mech: mechanicalGeometries(p, d),
    hoodBridge,
    deckBridge,
    hingeZ: d.doorFrontZ,
  };

  cache.set(key, g);
  return g;
}
