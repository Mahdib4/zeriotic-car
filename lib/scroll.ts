/**
 * scroll.ts — one source of truth for scroll position.
 *
 * The canvas and the DOM overlays must never disagree about where in the film
 * we are, so both read from this module rather than measuring scroll
 * themselves. Lenis smooths the input; GSAP's ticker drives the read loop; the
 * 3D scene samples `scrollState` directly inside useFrame without triggering a
 * single React render.
 */

export interface ScrollState {
  /** Global progress through the whole film, 0–1. */
  p: number;
  /** Signed progress delta per second. Used to slow the camera when the
   *  visitor lingers, which is what turns Act 4 into a scroll-triggered
   *  focus rather than a click-triggered one. */
  velocity: number;
  /** Smoothed absolute velocity, 0–1ish. */
  energy: number;
}

export const scrollState: ScrollState = { p: 0, velocity: 0, energy: 0 };

type Subscriber = (s: ScrollState) => void;

const subscribers = new Set<Subscriber>();

/** Subscribe to every frame of scroll. Returns an unsubscribe function. */
export function subscribeScroll(fn: Subscriber): () => void {
  subscribers.add(fn);
  fn(scrollState);
  return () => {
    subscribers.delete(fn);
  };
}

export function publishScroll(p: number, velocity: number): void {
  scrollState.p = p;
  scrollState.velocity = velocity;
  // Smooth the energy so overlays do not flicker on scroll direction changes.
  const target = Math.min(1, Math.abs(velocity) * 6);
  scrollState.energy += (target - scrollState.energy) * 0.12;
  for (const fn of subscribers) fn(scrollState);
}

/**
 * Coarse subscription for values that should drive React state — the focused
 * vehicle, the active act label. Fires only when the derived value changes,
 * so a component can hold React state without re-rendering every frame.
 */
export function subscribeDerived<T>(
  select: (s: ScrollState) => T,
  onChange: (value: T) => void,
): () => void {
  let last: T | undefined;
  let primed = false;
  return subscribeScroll((s) => {
    const next = select(s);
    if (!primed || next !== last) {
      primed = true;
      last = next;
      onChange(next);
    }
  });
}
