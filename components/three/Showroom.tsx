"use client";

/**
 * Showroom.tsx — Act 3. The room builds itself around the finished car.
 *
 * Everything here starts collapsed, dark or below the floor and is driven into
 * place by scroll: the floor resolves, the lighting rigs lower and ignite, the
 * display platform forms under the hero car, and the architecture grows in
 * behind it. The hero car exists first and the room is assembled around it,
 * which is what turns one vehicle into an anchor for a whole showroom.
 */

import { MeshReflectorMaterial } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { dealership, vehicles } from "@/lib/content";
import { scrollState } from "@/lib/scroll";
import {
  ACTS,
  FLOOR_SLOTS,
  actProgress,
  clamp01,
  focusedVehicle,
  invLerp,
  lerp,
  slotFor,
  smoothstep,
} from "@/lib/timeline";

const RIG_COUNT = 9;
const RIG_SPACING = 9;
const RIG_START_Z = 5;

interface ShowroomProps {
  quality: "high" | "low";
}

/** The dealership wordmark, drawn to a canvas so nothing is fetched. */
function useSignTexture(): THREE.CanvasTexture | null {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 2048;
    c.height = 512;
    const ctx = c.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "600 190px ui-sans-serif, system-ui, 'Segoe UI', Helvetica, Arial";
    ctx.letterSpacing = "34px";
    ctx.fillText(dealership.wordmark.primary, c.width / 2, c.height / 2 - 60);

    ctx.font = "400 76px ui-sans-serif, system-ui, 'Segoe UI', Helvetica, Arial";
    ctx.letterSpacing = "26px";
    ctx.globalAlpha = 0.66;
    ctx.fillText(dealership.wordmark.secondary, c.width / 2, c.height / 2 + 96);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);
}

export function Showroom({ quality }: ShowroomProps) {
  const floorRef = useRef<THREE.Mesh>(null);
  const floorMat = useRef<THREE.Material & { color?: THREE.Color; roughness?: number; metalness?: number }>(null);
  const platformRef = useRef<THREE.Mesh>(null);
  const rigGroup = useRef<THREE.Group>(null);
  const wallL = useRef<THREE.Mesh>(null);
  const wallR = useRef<THREE.Mesh>(null);
  const backWall = useRef<THREE.Mesh>(null);
  const signRef = useRef<THREE.Mesh>(null);
  const accentSpot = useRef<THREE.SpotLight>(null);
  const accentTarget = useRef<THREE.Object3D>(null);
  const poolRefs = useRef<(THREE.Mesh | null)[]>([]);

  const signTex = useSignTexture();

  const stoneColor = useMemo(() => new THREE.Color("#14171c"), []);
  const voidColor = useMemo(() => new THREE.Color("#020304"), []);
  const scratch = useMemo(() => new THREE.Color(), []);
  const accentColor = useMemo(() => new THREE.Color("#ffffff"), []);

  const rigs = useMemo(
    () => Array.from({ length: RIG_COUNT }, (_, i) => RIG_START_Z - i * RIG_SPACING),
    [],
  );

  useFrame((state) => {
    const p = scrollState.p;
    const t = state.clock.elapsedTime;

    // Act 3 splits into two halves: the floor and rigs resolve first, the
    // architecture grows behind them.
    const build = p < ACTS.showroom.start ? 0 : actProgress(p, "showroom");
    const floorP = smoothstep(clamp01(build / 0.55));
    const rigP = smoothstep(clamp01(invLerp(0.1, 0.7, build)));
    const archP = smoothstep(clamp01(invLerp(0.45, 1, build)));
    const after = p >= ACTS.showroom.end ? 1 : 0;

    /* -- floor ---------------------------------------------------- */
    const fm = floorMat.current;
    if (fm?.color) {
      scratch.copy(voidColor).lerp(stoneColor, floorP);
      fm.color.copy(scratch);
      if (typeof fm.roughness === "number") fm.roughness = lerp(0.95, 0.16, floorP);
      if (typeof fm.metalness === "number") fm.metalness = lerp(0.0, 0.62, floorP);
    }
    if (floorRef.current) {
      floorRef.current.visible = floorP > 0.004;
      const s = lerp(0.25, 1, floorP);
      floorRef.current.scale.set(s, s, 1);
    }

    /* -- display platform ----------------------------------------- */
    if (platformRef.current) {
      platformRef.current.visible = floorP > 0.02;
      platformRef.current.position.y = lerp(-0.5, 0.015, smoothstep(clamp01(invLerp(0.15, 0.75, build))));
      platformRef.current.rotation.y = t * 0.012;
    }

    /* -- lighting rigs lower and ignite --------------------------- */
    if (rigGroup.current) {
      rigGroup.current.visible = rigP > 0.004;
      rigGroup.current.children.forEach((child, i) => {
        const stagger = clamp01((rigP - i * 0.045) / 0.5);
        const e = smoothstep(stagger);
        child.position.y = lerp(15.5, 6.4, e);
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
        if (mat?.emissiveIntensity !== undefined) {
          // Ignition flickers once, the way a real fixture strikes.
          const flick = e > 0.82 ? 1 : e > 0.7 ? 0.35 + Math.abs(Math.sin(t * 26 + i)) * 0.65 : 0;
          mat.emissiveIntensity = e * 3.4 * flick;
        }
      });
    }

    /* -- architecture --------------------------------------------- */
    const wallScale = Math.max(0.0001, archP);
    if (wallL.current) {
      wallL.current.visible = archP > 0.004;
      wallL.current.scale.y = wallScale;
      wallL.current.position.y = 5.5 * wallScale;
    }
    if (wallR.current) {
      wallR.current.visible = archP > 0.004;
      wallR.current.scale.y = wallScale;
      wallR.current.position.y = 5.5 * wallScale;
    }
    if (backWall.current) {
      backWall.current.visible = archP > 0.004;
      backWall.current.scale.y = wallScale;
      backWall.current.position.y = 6 * wallScale;
    }

    /* -- signage, held back for the epilogue ---------------------- */
    if (signRef.current) {
      const signP = smoothstep(invLerp(ACTS.lineup.end, ACTS.epilogue.start + 0.02, p));
      signRef.current.visible = signP > 0.01;
      const mat = signRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = signP * 0.9;
    }

    /* -- the accent spot follows whichever car holds focus --------- */
    const focus = focusedVehicle(p);
    if (accentSpot.current && accentTarget.current) {
      const slot = focus.id ? slotFor(focus.id) : FLOOR_SLOTS[0];
      const v = focus.id ? vehicles.find((x) => x.id === focus.id) : vehicles[0];
      // The target object only exists after the first render, so the light is
      // pointed here rather than through a prop.
      accentSpot.current.target = accentTarget.current;
      accentTarget.current.position.set(slot.x, 0.4, slot.z);
      accentTarget.current.updateMatrixWorld();
      accentSpot.current.position.set(slot.x + 1.2, 6.2, slot.z + 1.6);
      accentColor.set(v?.accentHex ?? "#ffffff");
      accentSpot.current.color.copy(accentColor);
      accentSpot.current.intensity = (0.35 + focus.strength * 0.65) * 42 * after;
    }

    /* -- pools of light on the floor, one per slot ---------------- */
    poolRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const slot = FLOOR_SLOTS[i];
      const near = 1 - clamp01(Math.abs(slot.z - (focus.id ? slotFor(focus.id).z : 0)) / 26);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mesh.visible = after > 0 && floorP > 0.5;
      mat.opacity = (0.05 + near * 0.16) * floorP;
    });
  });

  return (
    <group>
      {/* Floor */}
      <mesh
        ref={floorRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -32]}
        visible={false}
      >
        <planeGeometry args={[70, 150]} />
        {quality === "high" ? (
          <MeshReflectorMaterial
            ref={floorMat as never}
            color="#020304"
            resolution={512}
            blur={[420, 120]}
            mixBlur={0.95}
            mixStrength={2.4}
            depthScale={1.05}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.3}
            metalness={0.0}
            roughness={0.95}
            mirror={0.45}
          />
        ) : (
          <meshStandardMaterial
            ref={floorMat as never}
            color="#020304"
            metalness={0}
            roughness={0.95}
            envMapIntensity={1.4}
          />
        )}
      </mesh>

      {/* Pools of light, one per vehicle slot */}
      {FLOOR_SLOTS.map((slot, i) => {
        const v = vehicles.find((x) => x.id === slot.id);
        return (
          <mesh
            key={`pool-${slot.id}`}
            ref={(el) => {
              poolRefs.current[i] = el;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[slot.x, 0.004, slot.z]}
            visible={false}
          >
            <circleGeometry args={[4.2, 40]} />
            <meshBasicMaterial
              color={v?.accentHex ?? "#ffffff"}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {/* Display platform under the hero car */}
      <mesh ref={platformRef} position={[0, -0.5, 0]} visible={false}>
        <cylinderGeometry args={[4.1, 4.25, 0.1, 64]} />
        <meshStandardMaterial color="#0d1014" metalness={0.85} roughness={0.24} envMapIntensity={1.5} />
      </mesh>

      {/* Ceiling lighting rigs */}
      <group ref={rigGroup} visible={false}>
        {rigs.map((z, i) => (
          <mesh key={`rig-${i}`} position={[0, 15.5, z]}>
            <boxGeometry args={[16, 0.14, 0.4]} />
            <meshStandardMaterial
              color="#0a0c10"
              emissive="#dce8f8"
              emissiveIntensity={0}
              metalness={0.6}
              roughness={0.3}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* Architecture */}
      <mesh ref={wallL} position={[-15, 0, -32]} visible={false}>
        <boxGeometry args={[0.4, 11, 150]} />
        <meshStandardMaterial color="#0b0e12" metalness={0.25} roughness={0.72} />
      </mesh>
      <mesh ref={wallR} position={[15, 0, -32]} visible={false}>
        <boxGeometry args={[0.4, 11, 150]} />
        <meshStandardMaterial color="#0b0e12" metalness={0.25} roughness={0.72} />
      </mesh>
      <mesh ref={backWall} position={[0, 0, -84]} visible={false}>
        <boxGeometry args={[30, 12, 0.4]} />
        <meshStandardMaterial color="#0a0d11" metalness={0.2} roughness={0.78} />
      </mesh>

      {/* Dealership signage — the identity only resolves in the epilogue */}
      {signTex && (
        <mesh ref={signRef} position={[0, 7.4, -83.6]} visible={false}>
          <planeGeometry args={[17, 4.25]} />
          <meshBasicMaterial
            map={signTex}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* The moving accent spot */}
      <object3D ref={accentTarget} position={[0, 0.4, 0]} />
      <spotLight
        ref={accentSpot}
        position={[1.2, 6.2, 1.6]}
        angle={0.5}
        penumbra={0.9}
        intensity={0}
        distance={20}
        decay={1.5}
      />
    </group>
  );
}
