/**
 * materials.ts — the material library.
 *
 * The brief's material rule: paint, glass and chrome must show consistent
 * environment reflections across the whole film, so every reflective surface
 * here shares one procedurally-built environment map (see Studio.tsx) rather
 * than each act lighting itself. The single Act 0 spotlight stays traceable in
 * the paint all the way through to the Act 6 aerial.
 *
 * Glass deliberately uses tinted transparency rather than true transmission:
 * with seven vehicles on screen a transmission pass is the single most
 * expensive thing we could ask for, and against a dark studio the two are
 * visually indistinguishable.
 */

import * as THREE from "three";
import type { Vehicle } from "@/lib/content";

export interface VehicleMaterials {
  paint: THREE.MeshPhysicalMaterial;
  /** Painted parts that should stay slightly duller than the main body. */
  paintSoft: THREE.MeshPhysicalMaterial;
  carbon: THREE.MeshStandardMaterial;
  brightwork: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  headlight: THREE.MeshStandardMaterial;
  taillight: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
  engine: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  dispose: () => void;
}

const BRIGHTWORK = {
  chrome: { color: "#e8eaec", metalness: 1, roughness: 0.08 },
  satin: { color: "#9aa0a6", metalness: 1, roughness: 0.32 },
  "gloss-black": { color: "#16181b", metalness: 0.85, roughness: 0.12 },
} as const;

export function createVehicleMaterials(v: Vehicle): VehicleMaterials {
  const paintHex = v.paints[0].hex;
  const metallic = v.paints[0].metallic;
  const bw = BRIGHTWORK[v.trims[0].brightwork];

  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintHex),
    metalness: 0.15 + metallic * 0.55,
    // Starts matte — Act 1's final beat resolves it to gloss.
    roughness: 0.78,
    clearcoat: 0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.25,
  });

  const paintSoft = paint.clone();
  paintSoft.roughness = 0.82;

  const carbon = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#15171b"),
    metalness: 0.55,
    roughness: 0.42,
    envMapIntensity: 0.8,
  });

  const brightwork = new THREE.MeshStandardMaterial({
    color: new THREE.Color(bw.color),
    metalness: bw.metalness,
    roughness: bw.roughness,
    envMapIntensity: 1.6,
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#0a0b0d"),
    metalness: 0,
    roughness: 0.94,
    envMapIntensity: 0.35,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#0d1418"),
    metalness: 0.1,
    roughness: 0.06,
    transparent: true,
    opacity: 0.42,
    envMapIntensity: 2.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const headlight = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#dfe9f5"),
    emissive: new THREE.Color("#cfe2ff"),
    emissiveIntensity: 0,
    metalness: 0.4,
    roughness: 0.16,
  });

  const taillight = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#3a0d10"),
    emissive: new THREE.Color("#ff2d3a"),
    emissiveIntensity: 0,
    metalness: 0.3,
    roughness: 0.22,
  });

  const accent = new THREE.MeshStandardMaterial({
    color: new THREE.Color(v.accentHex),
    emissive: new THREE.Color(v.accentHex),
    emissiveIntensity: 0,
    metalness: 0.2,
    roughness: 0.3,
  });

  const leather = new THREE.MeshStandardMaterial({
    color: new THREE.Color(v.trims[0].interiorHex),
    metalness: 0.05,
    roughness: 0.72,
    envMapIntensity: 0.6,
  });

  const engine = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#6c727a"),
    metalness: 0.92,
    roughness: 0.36,
    envMapIntensity: 1.1,
  });

  const steel = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#3d434a"),
    metalness: 0.88,
    roughness: 0.44,
    envMapIntensity: 0.9,
  });

  const all = [
    paint,
    paintSoft,
    carbon,
    brightwork,
    rubber,
    glass,
    headlight,
    taillight,
    accent,
    leather,
    engine,
    steel,
  ];

  return {
    paint,
    paintSoft,
    carbon,
    brightwork,
    rubber,
    glass,
    headlight,
    taillight,
    accent,
    leather,
    engine,
    steel,
    dispose: () => all.forEach((m) => m.dispose()),
  };
}

/* ------------------------------------------------------------------ */
/* Live updates                                                        */
/* ------------------------------------------------------------------ */

const tmpColor = new THREE.Color();

/**
 * Act 1's final beat. `t` runs 0 (bare primer) to 1 (finished gloss), and the
 * caller offsets it per panel so the coat sweeps nose to tail rather than
 * switching everywhere at once.
 */
export function applyPaintResolve(m: VehicleMaterials, t: number): void {
  const e = t < 0 ? 0 : t > 1 ? 1 : t;
  m.paint.roughness = 0.78 - 0.66 * e;
  m.paint.clearcoat = e;
  m.paintSoft.roughness = 0.82 - 0.6 * e;
  m.paintSoft.clearcoat = e * 0.85;
  m.paint.envMapIntensity = 1.25 + e * 0.55;
  m.paintSoft.envMapIntensity = 1.1 + e * 0.4;
}

/** Act 5. Swaps the paint without touching geometry or the camera. */
export function applyPaintOption(
  m: VehicleMaterials,
  hex: string,
  metallic: number,
  lerpAmount = 1,
): void {
  tmpColor.set(hex);
  m.paint.color.lerp(tmpColor, lerpAmount);
  m.paintSoft.color.lerp(tmpColor, lerpAmount);
  const targetMetal = 0.15 + metallic * 0.55;
  m.paint.metalness += (targetMetal - m.paint.metalness) * lerpAmount;
  m.paintSoft.metalness = m.paint.metalness;
}

/** Act 5. Trim changes the cabin hide and the brightwork finish together. */
export function applyTrimOption(
  m: VehicleMaterials,
  interiorHex: string,
  brightwork: keyof typeof BRIGHTWORK,
  lerpAmount = 1,
): void {
  tmpColor.set(interiorHex);
  m.leather.color.lerp(tmpColor, lerpAmount);

  const bw = BRIGHTWORK[brightwork];
  tmpColor.set(bw.color);
  m.brightwork.color.lerp(tmpColor, lerpAmount);
  m.brightwork.metalness += (bw.metalness - m.brightwork.metalness) * lerpAmount;
  m.brightwork.roughness += (bw.roughness - m.brightwork.roughness) * lerpAmount;
}

/** Lights ignite once their assembly seats, never before. */
export function applyLightState(m: VehicleMaterials, t: number, accent = 0): void {
  const e = t < 0 ? 0 : t > 1 ? 1 : t;
  m.headlight.emissiveIntensity = e * 3.2;
  m.taillight.emissiveIntensity = e * 2.4;
  m.accent.emissiveIntensity = accent * 3.5;
}
