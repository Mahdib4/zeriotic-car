"use client";

/**
 * Preloader.tsx — the title card.
 *
 * The wordmark resolves letter by letter out of a wide tracking, settles, and
 * lifts away to reveal the film.
 *
 * It is not only decoration. `ScrubVideoLayer` will not show a clip until the
 * stretch it is about to be scrubbed into has arrived, and off object storage
 * that takes the better part of a second — so
 * without this the visitor's first moment on the site was the empty fallback
 * room while the opening shot downloaded. The title card covers exactly that
 * gap, and it holds until the first clip is genuinely ready rather than for a
 * fixed guess, so the film always opens on frame one of the footage.
 *
 * Two bounds keep it honest: it never leaves before the animation has played
 * (otherwise a warm cache makes it flash), and never stays past the cap
 * (otherwise a failed clip would trap the visitor on a splash screen).
 */

import { useEffect, useRef, useState } from "react";

import { dealership } from "@/lib/content";

/** Long enough for the letters to land and settle. */
const MIN_MS = 2200;
/** Hard cap. A clip that never buffers must not trap anyone here. */
const MAX_MS = 7000;
/** Matches the fade-out in globals.css. */
const EXIT_MS = 900;

/**
 * Seconds buffered contiguously from the very start of the clip.
 *
 * This used to ask for 98% of the whole file, which is the same mistake rule 6
 * in ScrubVideoLayer was written to undo: it is far more than opening the film
 * requires, and on a phone it meant the title card almost always sat out its
 * full seven-second cap before giving up. What the opening actually needs is
 * that the first stretch the visitor can scrub into has arrived — the rest
 * keeps downloading behind them while they watch.
 */
function bufferedFromStart(el: HTMLVideoElement): number {
  for (let i = 0; i < el.buffered.length; i++) {
    if (el.buffered.start(i) <= 0.05) return el.buffered.end(i);
  }
  return 0;
}

export function Preloader() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const started = useRef(0);

  useEffect(() => {
    started.current = performance.now();

    // Always open at the top. A refresh mid-film would otherwise restore the
    // old scroll position behind the card and the film would start mid-shot.
    window.scrollTo(0, 0);
    document.documentElement.classList.add("loading");

    let raf = 0;
    let exitTimer = 0;
    let done = false;

    const dismiss = () => {
      if (done) return;
      done = true;
      setLeaving(true);
      document.documentElement.classList.remove("loading");
      exitTimer = window.setTimeout(() => setGone(true), EXIT_MS);
    };

    const poll = () => {
      const waited = performance.now() - started.current;
      const first = document.querySelector<HTMLVideoElement>(
        ".scrub-video-layer video",
      );
      // Matches READY_LOOKAHEAD_SEC in ScrubVideoLayer: the same runway the
      // film itself requires before it will show a clip. Asking for less would
      // dismiss the card onto a shot the film then refuses to display.
      const ready = first
        ? bufferedFromStart(first) >= Math.min(3.5, first.duration || 3.5)
        : false;

      if (waited > MIN_MS && ready) {
        dismiss();
        return;
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);

    // The cap runs on a timer rather than out of the rAF loop, because rAF is
    // paused in a background tab. Opening the site in one and coming back
    // later must not find the title card still sitting there.
    const cap = window.setTimeout(dismiss, MAX_MS);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(cap);
      window.clearTimeout(exitTimer);
      document.documentElement.classList.remove("loading");
    };
  }, []);

  if (gone) return null;

  const primary = [...dealership.wordmark.primary];
  const secondary = [...dealership.wordmark.secondary];

  return (
    <div
      className={`preloader${leaving ? " is-leaving" : ""}`}
      role="status"
      aria-label={`Loading ${dealership.name}`}
    >
      <div className="preloader-mark">
        <div className="preloader-primary" aria-hidden="true">
          {primary.map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              style={{ animationDelay: `${140 + i * 75}ms` }}
            >
              {ch}
            </span>
          ))}
        </div>
        <div className="preloader-rule" aria-hidden="true" />
        <div className="preloader-secondary" aria-hidden="true">
          {secondary.map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              style={{ animationDelay: `${900 + i * 34}ms` }}
            >
              {ch}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
