"use client";

/**
 * Stage.tsx — the pinned frame, and the scroll that drives it.
 *
 * One tall container, one sticky viewport-height stage. Lenis smooths the
 * input, GSAP's ticker runs the read loop, and every layer inside — WebGL,
 * video, DOM — samples the same published scroll value. That single source of
 * truth is what keeps the video-driven and real-time-driven layers frame-
 * locked to each other, and it is why the seam between them is invisible.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { publishScroll } from "@/lib/scroll";
import { TOTAL_VH, clamp01, validateHandoffs } from "@/lib/timeline";
import { AccentSync, Chrome } from "./Chrome";
import { Overlays } from "./Overlays";
import { PerfHUD } from "./PerfHUD";
import { ScrubVideoLayer } from "./video/ScrubVideoLayer";

const CanvasLayer = dynamic(
  () => import("./CanvasLayer").then((m) => m.CanvasLayer),
  { ssr: false },
);

function detectQuality(): "high" | "low" {
  if (typeof window === "undefined") return "high";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth < 900;
  const cores = navigator.hardwareConcurrency ?? 8;
  return coarse || narrow || cores <= 4 ? "low" : "high";
}

export function Stage() {
  const filmRef = useRef<HTMLDivElement>(null);
  const [quality, setQuality] = useState<"high" | "low">("high");
  /**
   * Whether a Higgsfield clip is currently painting over the whole frame.
   * When it is, the WebGL scene is invisible, and rendering it anyway costs a
   * full scene pass, a second pass for the reflective floor, and six cube
   * faces for the environment map — every frame, for nothing. That was the
   * scroll stutter. Coverage now parks the canvas instead.
   */
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    setQuality(detectQuality());
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      // Frame-rate-independent smoothing rather than a fixed duration. A
      // duration ease keeps animating long after the wheel stops, which on a
      // scrubbed film reads as the picture lagging behind the input.
      lerp: 0.12,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      syncTouch: true,
    });

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    lenis.on("scroll", ScrollTrigger.update);

    let lastP = 0;
    let lastT = performance.now();

    const read = () => {
      const el = filmRef.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const y = window.scrollY - el.offsetTop;
      const p = clamp01(total > 0 ? y / total : 0);

      const now = performance.now();
      const dt = Math.max(0.001, (now - lastT) / 1000);
      publishScroll(p, (p - lastP) / dt);
      lastP = p;
      lastT = now;
    };

    gsap.ticker.add(read);

    if (process.env.NODE_ENV !== "production") {
      const problems = validateHandoffs();
      for (const problem of problems) console.warn(`[continuity] ${problem}`);
    }

    return () => {
      gsap.ticker.remove(raf);
      gsap.ticker.remove(read);
      lenis.destroy();
    };
  }, []);

  return (
    <>
      <Chrome />
      <AccentSync />
      <PerfHUD />
      <div className="film" ref={filmRef} style={{ height: `${TOTAL_VH}vh` }}>
        <div className="stage">
          <CanvasLayer quality={quality} paused={covered} />
          <ScrubVideoLayer onCoverageChange={setCovered} />
          <Overlays />
        </div>
      </div>
    </>
  );
}
