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

interface Device {
  quality: "high" | "low";
  /**
   * Whether to run the real-time scene at all.
   *
   * It is the fallback for any moment no clip is covering the frame, and it is
   * always on. It was briefly switched off for touch devices, on the argument
   * that every act is covered by footage so the scene is only ever seen in the
   * instant before the opening shot decodes — while costing a live GL context
   * and a second pass for the reflective floor against the same GPU that is
   * decoding the film.
   *
   * The argument was fine and the conclusion was wrong. It assumed the footage
   * always arrives, and the first thing that went wrong on a real phone was
   * that it did not: with no scene behind it, "the clip has not loaded" became
   * a black screen rather than a dim room, and nothing on the page said so.
   * The saving was only ever paid while the film is uncovered, which is
   * exactly when the fallback is the thing being asked for.
   */
  webgl: boolean;
}

function detectDevice(): Device {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  // See detectProfile in ScrubVideoLayer: a zero width means "unknown", not
  // "narrow", and this runs once so a wrong answer sticks for the session.
  const w = window.innerWidth;
  const narrow = w > 0 && w < 900;
  const cores = navigator.hardwareConcurrency ?? 8;
  return {
    quality: coarse || narrow || cores <= 4 ? "low" : "high",
    webgl: true,
  };
}

export function Stage() {
  const filmRef = useRef<HTMLDivElement>(null);
  /** Null until the browser has been asked what it is. */
  const [device, setDevice] = useState<Device | null>(null);
  /**
   * Whether a Higgsfield clip is currently painting over the whole frame.
   * When it is, the WebGL scene is invisible, and rendering it anyway costs a
   * full scene pass, a second pass for the reflective floor, and six cube
   * faces for the environment map — every frame, for nothing. That was the
   * scroll stutter. Coverage now parks the canvas instead.
   */
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    setDevice(detectDevice());
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
      /**
       * Off on touch, and this matters more than it looks.
       *
       * `syncTouch` takes touch scrolling away from the browser and drives it
       * from JavaScript instead: every touchmove is preventDefault-ed and the
       * page is moved by hand on the next frame. On a desktop that is a
       * refinement. On a phone it moves scrolling off the compositor thread —
       * where it is handled by the OS and cannot stutter — and onto the main
       * thread, which on this site is already busy seeking a video decoder.
       * The finger then leads the page by however long the current frame
       * takes, which does not read as a smoothing effect. It reads as the
       * page ignoring you.
       *
       * Native momentum scrolling is the thing phones are best at. Wheel
       * smoothing is untouched, so nothing changes on desktop.
       */
      syncTouch: false,
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
          {device?.webgl && (
            <CanvasLayer quality={device.quality} paused={covered} />
          )}
          <ScrubVideoLayer onCoverageChange={setCovered} />
          <Overlays />
        </div>
      </div>
    </>
  );
}
