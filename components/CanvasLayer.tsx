"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

import { fovFromFocal } from "@/lib/timeline";
import { Scene } from "./three/Scene";

export interface CanvasLayerProps {
  quality: "high" | "low";
  /**
   * True when a video clip is painting over the entire frame. The scene is
   * then invisible, so it stops rendering entirely: `frameloop="never"` halts
   * the render loop (and with it the reflective floor's second scene pass and
   * the environment cube-map refresh), and `visibility: hidden` lets the
   * compositor drop the layer as well.
   *
   * This is the difference between decoding one video per frame and decoding
   * one video per frame *plus* drawing seven cars nobody can see.
   */
  paused: boolean;
}

export function CanvasLayer({ quality, paused }: CanvasLayerProps) {
  return (
    <Canvas
      className="stage-canvas"
      style={{ visibility: paused ? "hidden" : "visible" }}
      frameloop={paused ? "never" : "always"}
      dpr={quality === "high" ? [1, 1.75] : [1, 1.25]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
      }}
      camera={{
        fov: fovFromFocal(35),
        near: 0.08,
        far: 420,
        position: [0, 1.15, 3.4],
      }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        // Slightly hot, so the spotlight blooms against the void without a
        // post-processing pass.
        gl.toneMappingExposure = 1.18;
        scene.background = new THREE.Color("#040507");
      }}
    >
      <Scene quality={quality} />
    </Canvas>
  );
}
