"use client";

/**
 * PerfHUD.tsx — diagnostics, on demand.
 *
 * Add `?debug` to the URL to show it. Off by default and never mounted
 * otherwise, so it costs nothing in normal use.
 *
 * It reports the numbers that actually explain a stutter on this site:
 *
 *   fps      frame rate, and the worst half-second since load
 *   canvas   whether the WebGL scene is parked behind the video, or drawing
 *            seven cars nobody can see
 *   seek     how long the decoder takes to land a scrubbed frame, how many
 *            overran the frame budget, and what that budget is. The budget is
 *            the display's own refresh period — 8.3ms on a 120Hz monitor, not
 *            16.7ms — so the readout means the same thing on every screen.
 *            Healthy is a p95 under budget with 0 blown.
 *   clip     which shot is live, and where in the film we are
 */

import { useEffect, useRef, useState } from "react";

import { scrollState, subscribeScroll } from "@/lib/scroll";
import { shotAt } from "@/lib/shots";
import { ACT_LIST } from "@/lib/timeline";

/**
 * The frame budget is the display's refresh period, not a hardcoded 60Hz.
 * On a 120Hz monitor a seek has 8.3ms to land, not 16.7ms — which is why a
 * build that measured fine at 60Hz could still stutter badly at 120Hz.
 * Measured as the fastest frame interval observed, which converges on the
 * true period regardless of how loaded the machine gets afterwards.
 */
const FALLBACK_FRAME_MS = 16.7;

export function PerfHUD() {
  const [on, setOn] = useState(false);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const minRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLSpanElement>(null);
  const seekRef = useRef<HTMLSpanElement>(null);
  const bufRef = useRef<HTMLSpanElement>(null);
  const shotRef = useRef<HTMLSpanElement>(null);
  const posRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setOn(new URLSearchParams(window.location.search).has("debug"));
  }, []);

  useEffect(() => {
    if (!on) return;

    let frames = 0;
    let last = performance.now();
    let prevFrame = performance.now();
    let framePeriod = FALLBACK_FRAME_MS;
    let worst = 999;
    let raf = 0;

    /* -- seek instrumentation ------------------------------------- */
    // Clips mount and unmount as the window slides, so elements are
    // instrumented lazily and tracked in a WeakSet — nothing to clean up.
    const wired = new WeakSet<HTMLVideoElement>();
    const started = new WeakMap<HTMLVideoElement, number>();
    const samples: number[] = [];
    let blown = 0;

    const wire = (el: HTMLVideoElement) => {
      if (wired.has(el)) return;
      wired.add(el);
      el.addEventListener("seeking", () => started.set(el, performance.now()));
      el.addEventListener("seeked", () => {
        const t0 = started.get(el);
        if (t0 === undefined) return;
        const ms = performance.now() - t0;
        started.delete(el);
        samples.push(ms);
        if (ms > framePeriod) blown++;
        // Rolling window, so the readout reflects the last few seconds
        // rather than averaging away a problem that just started.
        if (samples.length > 150) {
          const dropped = samples.shift();
          if (dropped !== undefined && dropped > framePeriod) blown--;
        }
      });
    };

    const tick = () => {
      frames++;
      const now = performance.now();

      // Converge on the real refresh period. 5ms floors it against the
      // occasional bogus sub-frame delta; 2s lets it settle before it counts.
      const delta = now - prevFrame;
      prevFrame = now;
      if (delta > 5 && delta < framePeriod) framePeriod = delta;

      for (const el of document.querySelectorAll<HTMLVideoElement>(
        ".scrub-video-layer video",
      )) {
        wire(el);
      }

      if (now - last >= 500) {
        const fps = Math.round((frames * 1000) / (now - last));
        // Ignore the first second while things warm up.
        if (now > 2000) worst = Math.min(worst, fps);
        if (fpsRef.current) {
          fpsRef.current.textContent = String(fps);
          // Judged against the display, not against 60. Sixty frames a second
          // is healthy on a 60Hz panel and half rate on a 120Hz one.
          const target = 1000 / framePeriod;
          fpsRef.current.style.color =
            fps >= target * 0.9
              ? "#4ade80"
              : fps >= target * 0.65
                ? "#facc15"
                : "#f87171";
        }
        if (minRef.current) {
          minRef.current.textContent = worst === 999 ? "—" : String(worst);
        }

        if (seekRef.current) {
          if (samples.length < 4) {
            seekRef.current.textContent = "—";
            seekRef.current.style.color = "#61666e";
          } else {
            const sorted = [...samples].sort((a, b) => a - b);
            const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
            const p95 = sorted[Math.floor(sorted.length * 0.95)];
            seekRef.current.textContent =
              `${mean.toFixed(1)} / ${p95.toFixed(1)}ms  ${blown} blown  (budget ${framePeriod.toFixed(1)}ms)`;
            seekRef.current.style.color =
              blown === 0 && p95 < framePeriod
                ? "#4ade80"
                : blown < 5
                  ? "#facc15"
                  : "#f87171";
          }
        }

        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const off = subscribeScroll(({ p }) => {
      const shot = shotAt(p);
      const act = ACT_LIST.find((a) => p >= a.start && p < a.end);

      if (shotRef.current) {
        shotRef.current.textContent = shot ? shot.id : "— (real-time)";
      }
      if (posRef.current) {
        posRef.current.textContent = `${(p * 100).toFixed(1)}%  ${act?.label ?? ""}  v=${scrollState.energy.toFixed(2)}`;
      }
      if (bufRef.current) {
        // Rule 6 in ScrubVideoLayer: over a network a clip is only really
        // ready once it is downloaded, not once it is decodable.
        const vids = [...document.querySelectorAll("video")];
        const vis = vids.find((v) => v.style.opacity === "1") ?? vids[0];
        let pct = 0;
        if (vis && Number.isFinite(vis.duration) && vis.duration > 0) {
          let c = 0;
          for (let i = 0; i < vis.buffered.length; i++) {
            c += vis.buffered.end(i) - vis.buffered.start(i);
          }
          pct = Math.round((c / vis.duration) * 100);
        }
        bufRef.current.textContent = pct + "%";
        bufRef.current.style.color = pct >= 98 ? "#4ade80" : pct >= 60 ? "#facc15" : "#f87171";
      }
      if (canvasRef.current) {
        const c = document.querySelector<HTMLElement>(".stage-canvas");
        const parked = c?.style.visibility === "hidden";
        canvasRef.current.textContent = parked ? "parked" : "RENDERING";
        canvasRef.current.style.color = parked ? "#4ade80" : "#f87171";
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  }, [on]);

  if (!on) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 100,
        background: "rgba(4,5,7,0.86)",
        border: "1px solid rgba(255,255,255,0.16)",
        borderRadius: 4,
        padding: "10px 12px",
        font: "500 11px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace",
        color: "#e9ebef",
        letterSpacing: "0.02em",
        pointerEvents: "none",
        minWidth: 230,
      }}
    >
      <div>
        fps <span ref={fpsRef}>—</span>
        <span style={{ color: "#61666e" }}> / min </span>
        <span ref={minRef}>—</span>
      </div>
      <div>
        canvas <span ref={canvasRef}>—</span>
      </div>
      <div>
        seek <span ref={seekRef}>—</span>
      </div>
      <div>
        buffer <span ref={bufRef}>—</span>
      </div>
      <div>
        clip <span ref={shotRef}>—</span>
      </div>
      <div style={{ color: "#8f959e" }}>
        <span ref={posRef}>—</span>
      </div>
    </div>
  );
}
