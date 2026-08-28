"use client";

/**
 * Chrome.tsx — the floating navigation and progress indicator.
 *
 * Deliberately not a nav bar: a mark, the name of the act you are inside, and
 * a rail of ticks that fill as the film runs. Nothing here is clickable
 * chrome competing with the film for attention.
 */

import { useEffect, useRef } from "react";

import { dealership, getVehicle } from "@/lib/content";
import { subscribeScroll } from "@/lib/scroll";
import { ACT_LIST, focusedVehicle, invLerp } from "@/lib/timeline";

export function Chrome() {
  const actRef = useRef<HTMLSpanElement>(null);
  const tickRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const hintRef = useRef<HTMLDivElement>(null);
  const lastAct = useRef(-1);

  useEffect(() => {
    return subscribeScroll(({ p }) => {
      // Act label
      let idx = 0;
      for (let i = 0; i < ACT_LIST.length; i++) {
        if (p >= ACT_LIST[i].start) idx = i;
      }
      if (idx !== lastAct.current) {
        lastAct.current = idx;
        if (actRef.current) {
          actRef.current.textContent = `${String(idx + 1).padStart(2, "0")} — ${ACT_LIST[idx].label}`;
        }
      }

      // Progress rail
      for (let i = 0; i < ACT_LIST.length; i++) {
        const el = tickRefs.current[i];
        if (!el) continue;
        const a = ACT_LIST[i];
        const fill = p <= a.start ? 0 : p >= a.end ? 1 : invLerp(a.start, a.end, p);
        el.style.transform = `scaleY(${fill.toFixed(3)})`;
      }

      // The hint retires as soon as the visitor starts scrolling.
      if (hintRef.current) {
        const o = Math.max(0, 1 - p * 90);
        hintRef.current.style.opacity = o.toFixed(3);
      }
    });
  }, []);

  return (
    <>
      <header className="floating-nav">
        <span className="nav-mark">{dealership.wordmark.primary}</span>
        <span ref={actRef} className="nav-act">
          01 — The Void
        </span>
      </header>

      <nav className="progress-rail" aria-label="Film progress">
        {ACT_LIST.map((a, i) => (
          <span key={a.id} className="progress-tick" title={a.label}>
            <span
              ref={(el) => {
                tickRefs.current[i] = el;
              }}
            />
          </span>
        ))}
      </nav>

      <div ref={hintRef} className="scroll-hint">
        Scroll to build
      </div>
    </>
  );
}

/**
 * Writes the focused vehicle's accent tone into the CSS custom property, so
 * the DOM and the lighting rig are always describing the same car.
 */
export function AccentSync() {
  useEffect(() => {
    let current = "";
    return subscribeScroll(({ p }) => {
      const focus = focusedVehicle(p);
      const hex = focus.id ? getVehicle(focus.id).accentHex : "#ff6b35";
      if (hex !== current) {
        current = hex;
        document.documentElement.style.setProperty("--accent", hex);
      }
    });
  }, []);
  return null;
}
