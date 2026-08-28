"use client";

/**
 * Studio.tsx — light, and the reflections it leaves behind.
 *
 * The brief's material rule is the whole reason this file exists: the single
 * volumetric spotlight that cuts on in Act 0 must stay traceable in the paint
 * and chrome for the rest of the film, even once the showroom has been built
 * around it. So there is exactly one environment, built procedurally from
 * lightformers, and the acts re-weight it rather than replacing it.
 *
 * Nothing is fetched. The environment map is rendered in-engine from the
 * lightformer quads, which means no HDRI download and no CDN dependency.
 */

import { Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { scrollState } from "@/lib/scroll";
import { ACTS, band, clamp01, invLerp, smoothstep } from "@/lib/timeline";
import { flagship } from "@/lib/content";

interface StudioProps {
  /** Mobile drops the per-frame environment update to hold frame rate. */
  quality: "high" | "low";
}

const setIntensity = (
  ref: React.RefObject<THREE.Mesh | null>,
  base: THREE.Color,
  intensity: number,
) => {
  const mat = ref.current?.material as THREE.MeshBasicMaterial | undefined;
  if (mat?.color) mat.color.copy(base).multiplyScalar(Math.max(0, intensity));
};

const WHITE = new THREE.Color("#ffffff");
const KEY = new THREE.Color(flagship.keyLightHex);
const RIM_COOL = new THREE.Color("#7fa8d8");
const RIM_WARM = new THREE.Color("#ffd9a8");

export function Studio({ quality }: StudioProps) {
  const spotFormer = useRef<THREE.Mesh>(null);
  const keyFormer = useRef<THREE.Mesh>(null);
  const rimLFormer = useRef<THREE.Mesh>(null);
  const rimRFormer = useRef<THREE.Mesh>(null);
  const ceilFormer = useRef<THREE.Mesh>(null);

  const spotLight = useRef<THREE.SpotLight>(null);
  const keyLight = useRef<THREE.DirectionalLight>(null);
  const rimLight = useRef<THREE.DirectionalLight>(null);
  const fillLight = useRef<THREE.DirectionalLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const shaft = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const p = scrollState.p;

    // The void spotlight: full strength through Acts 0–1, then held at a low
    // but non-zero level forever, so it stays visible in the reflections.
    const voidPhase = 1 - smoothstep(invLerp(ACTS.assembly.start, ACTS.showcase.start, p));
    const spot = 0.28 + voidPhase * 0.72;

    // Three-point studio arrives with Act 2.
    const studio = smoothstep(
      invLerp(ACTS.assembly.start + (ACTS.assembly.end - ACTS.assembly.start) * 0.55, ACTS.showcase.start, p),
    );

    // Architectural lighting arrives with the room in Act 3.
    const architectural = smoothstep(invLerp(ACTS.showroom.start, ACTS.showroom.end, p));

    setIntensity(spotFormer, WHITE, spot * 5.5);
    setIntensity(keyFormer, KEY, 0.35 + studio * 2.6);
    setIntensity(rimLFormer, RIM_COOL, 0.2 + studio * 2.2 + architectural * 0.6);
    setIntensity(rimRFormer, RIM_WARM, 0.15 + studio * 1.6 + architectural * 0.5);
    setIntensity(ceilFormer, WHITE, architectural * 2.4);

    if (spotLight.current) spotLight.current.intensity = 18 + voidPhase * 55;
    if (keyLight.current) keyLight.current.intensity = 0.25 + studio * 1.9 + architectural * 0.6;
    if (rimLight.current) rimLight.current.intensity = 0.4 + studio * 2.4;
    if (fillLight.current) fillLight.current.intensity = 0.1 + studio * 0.5 + architectural * 0.9;
    if (ambient.current) ambient.current.intensity = 0.04 + studio * 0.1 + architectural * 0.22;

    // The visible light shaft only belongs to the void.
    if (shaft.current) {
      const vis = band(p, -0.02, ACTS.assembly.start + 0.06, 0.05);
      shaft.current.visible = vis > 0.01;
      const mat = shaft.current.material as THREE.MeshBasicMaterial;
      mat.opacity = vis * 0.055;
      // A slow breath, so even the empty void is never a still frame.
      const t = state.clock.elapsedTime;
      shaft.current.scale.x = 1 + Math.sin(t * 0.4) * 0.02;
      shaft.current.scale.z = 1 + Math.cos(t * 0.33) * 0.02;
    }
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.05} />

      {/* The Act 0 spotlight. Never removed — only dimmed. */}
      <spotLight
        ref={spotLight}
        position={[0.9, 7.5, 1.6]}
        angle={0.42}
        penumbra={0.85}
        intensity={60}
        distance={26}
        decay={1.4}
        color="#eaf2ff"
      />

      <directionalLight ref={keyLight} position={[5, 6, 6]} intensity={0.3} color={flagship.keyLightHex} />
      <directionalLight ref={rimLight} position={[-7, 3.2, -6]} intensity={0.5} color="#8fb4e0" />
      <directionalLight ref={fillLight} position={[3, 2, -7]} intensity={0.2} color="#ffd9b0" />

      {/* Volumetric shaft. A cone read from the inside reads as light in air. */}
      <mesh ref={shaft} position={[0.9, 3.9, 1.6]} visible={false}>
        <coneGeometry args={[3.1, 7.6, 40, 1, true]} />
        <meshBasicMaterial
          color="#cfe0ff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      <Environment
        resolution={quality === "high" ? 128 : 64}
        frames={quality === "high" ? Infinity : 1}
      >
        {/* Deep background — keeps reflections from reading as pure black. */}
        <Lightformer
          form="rect"
          intensity={0.06}
          color="#0b0e13"
          scale={[60, 60, 1]}
          position={[0, 4, -20]}
        />

        {/* The spotlight, as it appears in the paint. */}
        <mesh ref={spotFormer} position={[1.4, 9, 2.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.4, 24]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>

        {/* Soft key overhead. */}
        <mesh ref={keyFormer} position={[2.5, 7.5, 4]} rotation={[-Math.PI / 2.1, 0, 0]}>
          <planeGeometry args={[9, 5]} />
          <meshBasicMaterial color={flagship.keyLightHex} toneMapped={false} />
        </mesh>

        {/* Long vertical strips — these are what sweep across the paint as
            the camera orbits, and the reason the Act 2 orbit reads as studio
            footage rather than as a turntable. */}
        <mesh ref={rimLFormer} position={[-8, 3.4, -1]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[16, 3.2]} />
          <meshBasicMaterial color="#7fa8d8" toneMapped={false} />
        </mesh>
        <mesh ref={rimRFormer} position={[8, 3.4, -1]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[16, 3.2]} />
          <meshBasicMaterial color="#ffd9a8" toneMapped={false} />
        </mesh>

        {/* The showroom ceiling, once it exists. */}
        <mesh ref={ceilFormer} position={[0, 11, -28]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[26, 80]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      </Environment>
    </>
  );
}

/** Fog that opens up as the room is revealed. */
export function AtmosphericFog() {
  const fog = useRef<THREE.FogExp2>(null);
  useFrame(() => {
    if (!fog.current) return;
    const p = scrollState.p;
    const opened = smoothstep(invLerp(ACTS.showroom.start, ACTS.lineup.start, p));
    fog.current.density = clamp01(0.062 - opened * 0.044);
  });
  return <fogExp2 ref={fog} attach="fog" args={["#05070a", 0.062]} />;
}
