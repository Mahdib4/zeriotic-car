"use client";

/**
 * Overlays.tsx — the content layer.
 *
 * Absolutely positioned DOM over the pinned stage, faded in sync with scroll
 * progress. Nothing here re-renders per frame: each beat subscribes to scroll
 * once and writes opacity and transform straight to its own element.
 *
 * Placement follows the brief's content integration map exactly. In
 * particular Acts 1 and 2 carry no voice or trust copy at all — the assembly
 * and first showcase stay purely mechanical, and every word of brand,
 * testimonial and contact content is held back until Act 3 and later.
 */

import { useEffect, useRef, type ReactNode } from "react";

import {
  dealership,
  flagship,
  formatPrice,
  getVehicle,
  type PartAnchor,
} from "@/lib/content";
import {
  configuredPrice,
  resolvePaint,
  resolveTrim,
  setPaint,
  setTrim,
  togglePackage,
  useConfig,
} from "@/lib/config";
import { subscribeScroll } from "@/lib/scroll";
import {
  ACTS,
  BEATS,
  CHAPTERS,
  CHAPTER_BEATS,
  LINEUP_REVEALS,
  actProgress,
  band,
  lerp,
} from "@/lib/timeline";

/* ------------------------------------------------------------------ */
/* Beat primitive                                                      */
/* ------------------------------------------------------------------ */

interface BeatProps {
  from: number;
  to: number;
  edge?: number;
  className?: string;
  /** Rise distance in px as the beat fades in. */
  rise?: number;
  children: ReactNode;
}

function Beat({ from, to, edge = 0.055, className = "", rise = 16, children }: BeatProps) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef({ a: -1, hidden: true });

  useEffect(() => {
    return subscribeScroll(({ p }) => {
      const el = ref.current;
      if (!el) return;
      const a = band(p, from, to, edge);
      const prev = last.current;

      // Only touch the DOM when the value actually moves.
      if (Math.abs(a - prev.a) > 0.003) {
        el.style.opacity = a.toFixed(3);
        el.style.transform = `translate3d(0, ${((1 - a) * rise).toFixed(2)}px, 0)`;
        prev.a = a;
      }
      const hidden = a < 0.008;
      if (hidden !== prev.hidden) {
        el.style.visibility = hidden ? "hidden" : "visible";
        // Promote only the beat actually on screen. Ten beats each carrying a
        // standing will-change is ten full-viewport compositor layers held in
        // GPU memory for the nine nobody is looking at.
        el.style.willChange = hidden ? "auto" : "opacity, transform";
        el.setAttribute("aria-hidden", hidden ? "true" : "false");
        prev.hidden = hidden;
      }
    });
  }, [from, to, edge, rise]);

  return (
    <div ref={ref} className={`beat ${className}`} aria-hidden="true">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Act 0 — wordmark resolves out of the light                          */
/* ------------------------------------------------------------------ */

function VoidBeat() {
  const a = ACTS.void;
  return (
    <Beat from={a.start} to={lerp(a.start, a.end, 0.94)} edge={0.03} className="beat-center" rise={10}>
      <div className="wordmark">
        <span className="wordmark-primary">{dealership.wordmark.primary}</span>
        <span className="wordmark-secondary">{dealership.wordmark.secondary}</span>
        <p className="lede" style={{ marginTop: "1.6rem", color: "var(--muted)" }}>
          {dealership.brandStatement}
        </p>
      </div>
    </Beat>
  );
}

/* ------------------------------------------------------------------ */
/* Act 1 — mechanical readout only. No copy.                           */
/* ------------------------------------------------------------------ */

function AssemblyReadout() {
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const lastBeat = useRef(-1);

  useEffect(() => {
    return subscribeScroll(({ p }) => {
      const el = ref.current;
      if (!el) return;
      const a = band(p, ACTS.assembly.start, ACTS.assembly.end, 0.03);
      el.style.opacity = a.toFixed(3);
      el.style.visibility = a < 0.008 ? "hidden" : "visible";
      if (a < 0.008) return;

      const local = actProgress(p, "assembly");
      const idx = Math.min(
        BEATS.length - 1,
        BEATS.findIndex((b) => local < b.end) === -1
          ? BEATS.length - 1
          : BEATS.findIndex((b) => local < b.end),
      );
      if (idx !== lastBeat.current) {
        lastBeat.current = idx;
        if (labelRef.current) labelRef.current.textContent = BEATS[idx].label;
        if (countRef.current) {
          countRef.current.textContent = `${String(idx + 1).padStart(2, "0")} / ${String(BEATS.length).padStart(2, "0")}`;
        }
      }
    });
  }, []);

  return (
    <div
      ref={ref}
      className="beat"
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-start",
        padding: "var(--pad)",
        paddingBottom: "clamp(3.5rem, 9vh, 7rem)",
        visibility: "hidden",
      }}
      aria-hidden="true"
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "1.1rem" }}>
        <span ref={countRef} className="eyebrow mono" style={{ color: "var(--accent)" }}>
          01 / 09
        </span>
        <span ref={labelRef} className="eyebrow">
          Chassis and subframe
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Act 2 — showcase. Name, statement, anchored callouts, price last.   */
/* ------------------------------------------------------------------ */

/** Where a callout sits on screen, chosen to sit near its part. */
const ANCHOR_POSITION: Record<PartAnchor, React.CSSProperties> = {
  hood: { top: "26%", left: "8%" },
  wheels: { bottom: "26%", left: "10%" },
  door: { top: "32%", right: "9%" },
  cabin: { top: "22%", right: "10%" },
  rear: { bottom: "30%", right: "10%" },
  underbody: { bottom: "22%", left: "12%" },
};

function ShowcaseBeats() {
  const a = ACTS.showcase;
  const v = flagship;

  // The camera settles on the 3/4 front angle early in the orbit; the name
  // lands there, the callouts follow the camera round, and the price waits
  // until the orbit has completed.
  const at = (t: number) => lerp(a.start, a.end, t);

  return (
    <>
      <Beat from={at(0.02)} to={at(0.34)} className="beat-lower-left" rise={22}>
        <div>
          <p className="eyebrow" style={{ marginBottom: "0.7rem" }}>
            {v.category}
          </p>
          <h2 className="model-name">{v.name}</h2>
          <p className="lede" style={{ marginTop: "1rem", color: "var(--muted)" }}>
            {v.designStatement}
          </p>
        </div>
      </Beat>

      {v.specs.map((spec, i) => {
        const slot = 0.2 + i * 0.16;
        return (
          <Beat
            key={spec.label}
            from={at(slot)}
            to={at(slot + 0.19)}
            edge={0.03}
            rise={12}
          >
            <div className="callout" style={ANCHOR_POSITION[spec.anchor]}>
              <span className="callout-label">{spec.label}</span>
              <span className="callout-value mono">{spec.value}</span>
            </div>
          </Beat>
        );
      })}

      <Beat from={at(0.86)} to={a.end} className="beat-lower-right" rise={20}>
        <div>
          <p className="eyebrow" style={{ marginBottom: "0.55rem" }}>
            From
          </p>
          <p className="model-name mono">{formatPrice(v.startingPrice)}</p>
        </div>
      </Beat>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Act 3 — the dealership speaks for the first time                    */
/* ------------------------------------------------------------------ */

function ShowroomBeat() {
  const a = ACTS.showroom;
  return (
    <Beat
      from={lerp(a.start, a.end, 0.32)}
      to={lerp(a.start, a.end, 0.99)}
      className="beat-lower-left"
      rise={20}
    >
      <div style={{ maxWidth: "40rem" }}>
        <p className="eyebrow" style={{ marginBottom: "0.9rem" }}>
          {dealership.about.heading}
        </p>
        <p className="lede" style={{ maxWidth: "38ch" }}>
          {dealership.about.body}
        </p>
      </div>
    </Beat>
  );
}

/* ------------------------------------------------------------------ */
/* Act 3b — category labels only. Motion carries the rest.             */
/* ------------------------------------------------------------------ */

function LineupBeats() {
  return (
    <>
      {LINEUP_REVEALS.map((c) => {
        const v = getVehicle(c.id);
        return (
          <Beat
            key={`reveal-${c.id}`}
            from={lerp(c.revealStart, c.revealEnd, 0.18)}
            to={lerp(c.revealStart, c.revealEnd, 0.96)}
            edge={0.02}
            className="beat-center"
            rise={14}
          >
            <p
              className="display"
              style={{ opacity: 0.9, letterSpacing: "0.06em", fontWeight: 500 }}
            >
              {v.category}
            </p>
          </Beat>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Acts 4 + 5 — spec sheet, then live configuration                    */
/* ------------------------------------------------------------------ */

function VehicleChapters() {
  const config = useConfig();

  return (
    <>
      {CHAPTERS.map((c) => {
        const v = getVehicle(c.id);
        const cfg = config[v.id];
        const paint = resolvePaint(v, cfg);
        const trim = resolveTrim(v, cfg);
        const price = configuredPrice(v, cfg);

        const at = (t: number) => lerp(c.start, c.end, t);
        const [sigA] = CHAPTER_BEATS.arrive;
        const [specA, specB] = CHAPTER_BEATS.specs;
        const [cfgA, cfgB] = CHAPTER_BEATS.configure;

        return (
          <div key={`chapter-${c.id}`}>
            {/* Act 4 — name and signature move */}
            <Beat from={at(sigA)} to={at(0.36)} className="beat-lower-left" rise={22}>
              <div>
                <p className="eyebrow" style={{ marginBottom: "0.7rem" }}>
                  {v.category}
                </p>
                <h2 className="model-name">{v.name}</h2>
                <p className="lede" style={{ marginTop: "0.9rem", color: "var(--muted)" }}>
                  {v.tagline}
                </p>
              </div>
            </Beat>

            {/* Act 4 — full spec sheet */}
            <Beat from={at(specA)} to={at(specB)} className="beat-lower-right" rise={20}>
              <div className="panel">
                <p className="eyebrow" style={{ marginBottom: "0.8rem" }}>
                  Specification
                </p>
                <dl className="spec-table">
                  {v.fullSpecs.map((row) => (
                    <div className="spec-row" key={row.label}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Beat>

            {/* Act 5 — configuration, wired to the real-time paint */}
            <Beat from={at(cfgA)} to={at(cfgB)} className="beat-lower-right" rise={20}>
              <div className="panel config">
                <div>
                  <p className="eyebrow" style={{ marginBottom: "0.7rem" }}>
                    Paint — {paint.name}
                  </p>
                  <div className="swatch-row">
                    {v.paints.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="swatch"
                        style={{ background: opt.hex }}
                        aria-pressed={opt.id === cfg.paintId}
                        aria-label={`${opt.name}${opt.price ? `, plus ${formatPrice(opt.price)}` : ""}`}
                        title={opt.name}
                        onClick={() => setPaint(v.id, opt.id)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="eyebrow" style={{ marginBottom: "0.7rem" }}>
                    Trim — {trim.name}
                  </p>
                  <div className="option-row">
                    {v.trims.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="option"
                        aria-pressed={opt.id === cfg.trimId}
                        onClick={() => setTrim(v.id, opt.id)}
                      >
                        {opt.name}
                      </button>
                    ))}
                  </div>
                  <p
                    className="body-muted"
                    style={{ fontSize: "var(--step--1)", marginTop: "0.6rem" }}
                  >
                    {trim.description}
                  </p>
                </div>

                <div>
                  <p className="eyebrow" style={{ marginBottom: "0.7rem" }}>
                    Packages
                  </p>
                  <div className="option-row">
                    {v.packages.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="option"
                        aria-pressed={cfg.packageIds.includes(opt.id)}
                        onClick={() => togglePackage(v.id, opt.id)}
                        title={opt.description}
                      >
                        {opt.name}
                        <span style={{ color: "var(--dim)", marginLeft: "0.5rem" }}>
                          +{formatPrice(opt.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="price-line">
                  <span className="eyebrow">As configured</span>
                  <span className="price-value">{formatPrice(price)}</span>
                </div>
              </div>
            </Beat>
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Act 6 — the film signs off; the page takes over below               */
/* ------------------------------------------------------------------ */

function EpilogueBeat() {
  const a = ACTS.epilogue;
  return (
    <Beat
      from={lerp(a.start, a.end, 0.42)}
      to={a.end}
      edge={0.04}
      className="beat-center"
      rise={18}
    >
      <div className="wordmark">
        <span className="wordmark-primary">{dealership.wordmark.primary}</span>
        <span className="wordmark-secondary">{dealership.wordmark.secondary}</span>
        <p className="lede" style={{ marginTop: "1.5rem", color: "var(--muted)" }}>
          {dealership.brandStatement}
        </p>
        <p className="build-credit">
          {dealership.credit.prefix}{" "}
          <a
            href={dealership.credit.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {dealership.credit.name}
          </a>
        </p>
      </div>
    </Beat>
  );
}

/* ------------------------------------------------------------------ */

export function Overlays() {
  return (
    <div className="overlays">
      <VoidBeat />
      <AssemblyReadout />
      <ShowcaseBeats />
      <ShowroomBeat />
      <LineupBeats />
      <VehicleChapters />
      <EpilogueBeat />
    </div>
  );
}
