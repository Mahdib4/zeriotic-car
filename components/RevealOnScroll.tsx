"use client";

/**
 * RevealOnScroll.tsx — slides a block up into place as it enters the viewport.
 *
 * Used for the epilogue, which sits below the pinned film: the moment the film
 * releases the scroll, this is the first thing that behaves like an ordinary
 * page, and arriving at it with a lift makes the hand-off deliberate rather
 * than abrupt.
 *
 * Two things here are less obvious than they look.
 *
 * **The hidden state is applied by `is-armed`, which only JavaScript adds.**
 * The content is therefore visible unless something is actively present to
 * animate it. The obvious arrangement — hide in CSS, reveal with JS — means
 * any failure in this file deletes the showroom's address and phone number
 * from the page.
 *
 * **Being in view is not enough to trigger it.** The film mounts after
 * hydration and only then claims its ~2400vh, so for the first moments of the
 * page this block really does sit near the top of a short document. An
 * IntersectionObserver reports intersection as soon as you observe rather than
 * waiting for a change, so observing during that window fires immediately and
 * the footer is already up before anyone scrolls — losing exactly the
 * animation this component exists to produce. Waiting for layout to "settle"
 * is a race; requiring evidence that the visitor actually travelled here is
 * not. So the reveal also needs either a scroll to have happened, or the
 * document to be too short to contain a film in the first place.
 *
 * A CSS transition rather than a per-frame transform — the film already owns
 * the animation frame and this must not compete with it.
 *
 * Kept separate from Epilogue so that stays a server component.
 */

import { useEffect, useRef, type ReactNode } from "react";

/** Below this many viewports there is no film above us, so nothing to wait for. */
const SHORT_DOC_VIEWPORTS = 3;
/**
 * Backstop poll.
 *
 * Deliberately a poll and not a deadline. A timed "reveal no matter what"
 * sounds safer but is wrong here: there is ~2400vh of film above this block,
 * so any reader moving at a human pace takes far longer than such a timer, and
 * it would fire while the footer is still far off screen — losing the
 * animation for exactly the visitors who were watching properly. Polling
 * re-runs the same in-view test instead, so it can only ever reveal at the
 * right moment; it just no longer depends on scroll events or the observer
 * firing.
 */
const POLL_MS = 1000;

export function RevealOnScroll({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion gets the content, already in place. Never armed.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    el.classList.add("is-armed");

    let done = false;
    let hasScrolled = false;
    let settled = false;
    let io: IntersectionObserver | undefined;

    const cleanup = () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", check);
      window.clearInterval(poll);
      window.clearTimeout(settleTimer);
    };

    const reveal = () => {
      if (done) return;
      done = true;
      el.classList.add("is-revealed");
      cleanup();
    };

    const check = () => {
      if (done) return;
      // Measured, not just event-driven. Lenis can drive the page without a
      // window `scroll` event reaching us, and the poll below has no event at
      // all — reading the position directly means neither can strand this.
      const moved = hasScrolled || window.scrollY > 8;
      // Before the film mounts the document genuinely IS short, so the
      // short-document escape hatch cannot be trusted yet. Until it settles,
      // only real movement counts as evidence the visitor is here.
      if (!moved && !settled) return;
      const shortDoc =
        document.documentElement.scrollHeight <
        window.innerHeight * SHORT_DOC_VIEWPORTS;
      if (!moved && !shortDoc) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92 && r.bottom > 0) reveal();
    };

    const onScroll = () => {
      hasScrolled = true;
      check();
    };

    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) check();
        },
        { threshold: 0.08, rootMargin: "0px 0px -10% 0px" },
      );
      io.observe(el);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", check);
    const poll = window.setInterval(check, POLL_MS);
    // Give the film time to mount and claim its height before trusting the
    // document's measured length.
    const settleTimer = window.setTimeout(() => {
      settled = true;
      check();
    }, 1500);

    return cleanup;
  }, []);

  return (
    <div ref={ref} className={`reveal-up ${className}`.trim()}>
      {children}
    </div>
  );
}
