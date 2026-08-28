"use client";

/**
 * Scene.tsx — the real-time layer.
 *
 * This draws the room: the void, the studio lighting, the showroom
 * architecture, and a camera locked to the same scroll position the film uses.
 *
 * It no longer draws the cars.
 *
 * The procedural vehicles were built when most of the film was still a
 * placeholder and this layer had to stand in for footage that did not exist
 * yet. Every scroll position is now covered by a Higgsfield clip, so the only
 * way this layer reaches the screen is as a fallback when a clip cannot be
 * loaded at all — and in that situation, low-poly stand-in cars look like a
 * broken build rather than a design. An empty, correctly lit showroom reads as
 * intentional, and the camera and lighting still match the footage exactly, so
 * a fallback frame sits in the same space as the shot it replaces.
 *
 * The vehicle geometry itself is kept in Vehicle.tsx / geometry.ts. Nothing
 * imports it now; it is left in place because it is the only record of the
 * proportions each model was designed to, and it is tree-shaken out of the
 * bundle regardless.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { scrollState } from "@/lib/scroll";
import { cameraAt, fovFromFocal, pivotAt } from "@/lib/timeline";
import { AtmosphericFog, Studio } from "./Studio";
import { Showroom } from "./Showroom";

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const drift = useRef(0);

  useFrame((_, delta) => {
    const p = scrollState.p;
    const cam = cameraAt(p);
    const pivot = pivotAt(p);
    const dt = Math.min(delta, 1 / 30);

    // The brief's Act 4 rule: lingering slows the camera into a focused orbit.
    // Scroll already stops the rig, so instead of freezing — which the brief
    // forbids — a slow orbit takes over whenever the visitor stops scrolling,
    // and unwinds as soon as they move again.
    const idle = 1 - Math.min(1, scrollState.energy * 3);
    drift.current = Math.min(0.75, drift.current + dt * idle * 0.09);
    if (scrollState.energy > 0.06) drift.current *= 1 - Math.min(1, dt * 2.4);

    const angle = cam.angle + drift.current;
    camera.position.set(
      pivot.x + Math.sin(angle) * cam.radius,
      cam.height,
      pivot.z + Math.cos(angle) * cam.radius,
    );
    camera.lookAt(pivot.x, cam.targetY, pivot.z);

    const fov = fovFromFocal(cam.focal);
    if (Math.abs(camera.fov - fov) > 0.02) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

export interface SceneProps {
  quality: "high" | "low";
}

export function Scene({ quality }: SceneProps) {
  return (
    <>
      <AtmosphericFog />
      <CameraRig />
      <Studio quality={quality} />
      <Showroom quality={quality} />
    </>
  );
}
