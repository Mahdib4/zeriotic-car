"use client";

/**
 * ScrubVideoLayer.tsx — the Higgsfield layer.
 *
 * Clips are never autoplayed. `video.currentTime` is bound directly to scroll
 * position, so the visitor scrubs the film rather than watching it.
 *
 * Seven rules keep this smooth, and all seven matter. Rules 4, 6 and 7 in
 * particular are invisible locally and decisive in production — one only shows
 * on a high-refresh display, one only once the clips are served over a network
 * rather than off local disk, and one only on a phone.
 *
 *  1. A FOUR-SHOT WINDOW. The previous clip stays mounted after the boundary.
 *     If the outgoing element is torn down before the incoming one has decoded
 *     a frame, the canvas shows through for a frame or two — that is the
 *     blink. The outgoing clip holds its last frame until the incoming clip is
 *     provably ready to replace it.
 *
 *  2. NO CROSSFADE. Consecutive clips are frame-chained: the last frame of
 *     clip N is the first frame of clip N+1. So a hard switch at the boundary
 *     is invisible, and a fade is actively wrong — mid-fade you see two
 *     near-identical frames blended at partial opacity over a dark canvas,
 *     which reads as a dip in brightness.
 *
 *  3. CHASE, NEVER QUEUE. Assigning `currentTime` while a seek is in flight
 *     cancels and restarts it, so a scroll that outruns the decoder can starve
 *     it indefinitely. Instead the newest target is parked in `want`, and the
 *     element's own `seeked` event drives the next seek. The loop therefore
 *     self-clocks at the rate the decoder can sustain even if the main thread
 *     is running slower than the display.
 *
 *  4. SEEK AT 60Hz, NOT AT DISPLAY RATE. This is the part that was wrong on
 *     high-refresh monitors. The scroll ticker runs at the display's rate, so
 *     on a 120Hz screen the layer was asking for 120 seeks a second — on
 *     24fps source material, with a frame budget of 8.3ms per seek. It could
 *     not keep up, and the result was a stutter that only showed on 120Hz
 *     displays. A 14ms floor makes no difference at 60Hz (the tick is already
 *     16.7ms apart) and halves the rate at 120Hz, which is still five times
 *     the film's own frame rate.
 *
 *     Note this is NOT the old 90ms throttle, which capped fast scrolling at
 *     11fps and made things worse. This caps at 60/sec, and it applies
 *     uniformly rather than only during flings.
 *
 *  5. NOTHING ALLOCATES ON THE HOT PATH. The scroll callback runs at display
 *     rate; it must not build arrays, call `setState`, or poll media-element
 *     properties. Window changes are detected from an integer index, and
 *     parking upcoming clips happens once per window change, not per frame.
 *
 *  6. BUFFERED WHERE IT MATTERS. A clip is not shown until the bytes it is
 *     about to be scrubbed into are present. readyState only promises a frame
 *     at the current position, which off local disk is as good as ready and
 *     over a network is not: seeking into unfetched bytes costs a round trip.
 *     Requiring the WHOLE file, as this first did, turns every shot boundary
 *     into a ~1.8s download wall. See the constants below.
 *
 *  7. A PHONE IS NOT A SMALL DESKTOP. It fetches a 720p rendition rather than
 *     1080p, and keeps three decoders alive rather than five, because on
 *     mobile the scarce resource is hardware decoders rather than bandwidth —
 *     which inverts the reasoning behind rule 1's wide window. See `AHEAD`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { scrollState, subscribeScroll } from "@/lib/scroll";
import {
  RESOLVED_SHOTS,
  clipSrc,
  shotAt,
  shotClipTime,
  shotStartTime,
  type ClipProfile,
  type ResolvedShot,
} from "@/lib/shots";

/** HTMLMediaElement.readyState at which a frame is guaranteed decodable. */
const HAVE_CURRENT_DATA = 2;

/**
 * Half a frame at 24fps. Below this the seek would land on the frame already
 * on screen, so it is pure decoder load for no visible change.
 */
const HALF_FRAME = 1 / 48;

/** Rule 4. Just under one 60Hz frame, so it is a no-op on a 60Hz display. */
const MIN_SEEK_GAP_MS = 14;

/**
 * Rule 6. How much of a clip must be downloaded before it is allowed on
 * screen, and how long to wait for that before showing it anyway.
 *
 * `readyState >= HAVE_CURRENT_DATA` only promises a frame at the current
 * position. Served from local disk that is the same as "ready", because a seek
 * anywhere is free. Served from object storage it is not: a seek into a byte
 * range the browser has not fetched costs a network round trip. Measured
 * against R2, seeking a clip that had merely reached `canplaythrough` cost
 * 148ms on average and 280ms at p95, against 5.9ms once it was buffered.
 *
 * The first version of this gate demanded the WHOLE file, which is what made
 * the deployed site stutter. A 14MB clip takes ~1.8s to download in full, so
 * every shot boundary became a wall the film could not cross until it had
 * finished — scroll faster than that and the picture simply froze.
 *
 * What actually has to be true is narrower: the bytes we are about to scrub
 * INTO must be present. Scrubbing tracks scroll, so it advances through a clip
 * roughly monotonically, and a few seconds of runway ahead of the playhead is
 * enough. That is reached in a fraction of the time a whole file takes, and it
 * keeps arriving as the visitor scrolls.
 */
const READY_LOOKAHEAD_SEC = 3.5;
const MAX_BUFFER_WAIT_MS = 700;

/**
 * How often to prod clips the browser has refused to preload, and how many
 * times to prod any one of them before accepting it is not going to load.
 * See the effect that uses these.
 */
const KICK_INTERVAL_MS = 700;
const MAX_KICKS = 4;

/**
 * Seconds of continuously buffered video sitting ahead of `t`.
 *
 * Deliberately measures the range CONTAINING `t` rather than a total: a clip
 * with two disjoint buffered islands adding up to most of its length is still
 * one seek away from a network round trip, and summing them would call that
 * ready when it is not.
 */
function bufferedAhead(el: HTMLVideoElement, t: number): number {
  for (let i = 0; i < el.buffered.length; i++) {
    if (t >= el.buffered.start(i) - 0.05 && t <= el.buffered.end(i)) {
      return el.buffered.end(i) - t;
    }
  }
  return 0;
}

/** True when the clip has runway ahead of `t`, or simply ends soon after it. */
function readyAt(el: HTMLVideoElement, t: number): boolean {
  const d = Number.isFinite(el.duration) ? el.duration : 0;
  const ahead = bufferedAhead(el, t);
  return ahead >= READY_LOOKAHEAD_SEC || (d > 0 && t + ahead >= d - 0.1);
}

const ordered = [...RESOLVED_SHOTS].sort((a, b) => a.globalFrom - b.globalFrom);

/** Index of the shot containing `p`, or the nearest upcoming one. */
function indexAt(p: number): number {
  let i = ordered.findIndex((s) => p >= s.globalFrom && p < s.globalTo);
  if (i === -1) {
    i = ordered.findIndex((s) => s.globalFrom > p);
    if (i === -1) i = ordered.length - 1;
  }
  return i;
}

/**
 * How many clips to keep mounted ahead of the current one. One behind is
 * always kept — rule 1 depends on it.
 *
 * Every mount creates a fresh video decoder, which is expensive, so on desktop
 * the window is deliberately wider than strictly needed: during a fast scroll
 * a tight window churns decoders at the exact moment the machine is busiest.
 * The far clips are there for the network rather than the decoder — each needs
 * downloading before it can be shown, so the lookahead is what decides how
 * fast the visitor may scroll before they outrun it.
 *
 * Rule 7. On a phone that reasoning inverts, because the scarce resource is no
 * longer bandwidth but decoders. A mobile SoC has a small fixed number of
 * hardware video decoders; ask for more concurrent ones than it has and the
 * browser starts evicting and re-initialising them, which is far more
 * expensive than the mount it was meant to avoid — and it happens under
 * exactly the load that provoked it. Five 1080p decoders is over budget on
 * most phones. Three is not, and because the mobile rendition is 70% smaller
 * the shorter lookahead still buys a comparable number of seconds of runway.
 */
const AHEAD: Record<ClipProfile, number> = { hd: 3, sd: 1 };

/** The clips kept mounted around shot `i`: one behind, and `ahead` ahead. */
function windowFrom(i: number, ahead: number): ResolvedShot[] {
  const out: ResolvedShot[] = [];
  for (let k = i - 1; k <= i + ahead; k++) {
    if (k >= 0 && k < ordered.length) out.push(ordered[k]);
  }
  return out;
}

/**
 * Which rendition this device should fetch.
 *
 * Deliberately not a width test alone. A coarse pointer is the reliable signal
 * for "phone or tablet", and `hardwareConcurrency` catches the low-powered
 * laptops that would struggle for the same reason. A narrow window on a
 * desktop is just a narrow window and keeps the full-resolution film.
 *
 * This can only run in the browser, so the layer renders no video elements at
 * all until it has. That is a deliberate trade: the alternative — guessing on
 * the server — would put a `src` in the HTML that the client disagrees with,
 * and React treats a mismatched attribute as a hydration error. The cost is
 * one tick, which happens behind the title card.
 */
function detectProfile(): ClipProfile {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  // `> 0` is not redundant. A viewport can report zero width — a hidden or
  // not-yet-laid-out embedding context will — and that is "unknown", not
  // "narrow". Without the guard it reads as the narrowest possible window and
  // pins a desktop visitor to the mobile cut for the whole session, with
  // nothing to recover from it, because this runs once.
  const w = window.innerWidth;
  const narrow = w > 0 && w < 900;
  const cores = navigator.hardwareConcurrency ?? 8;
  return coarse || narrow || cores <= 4 ? "sd" : "hd";
}

export function ScrubVideoLayer({
  onCoverageChange,
}: {
  onCoverageChange?: (covered: boolean) => void;
}) {
  /** Null until the browser has told us what kind of device this is. */
  const [profile, setProfile] = useState<ClipProfile | null>(null);
  const [mounted, setMounted] = useState<ResolvedShot[]>(() =>
    windowFrom(indexAt(0), AHEAD.hd),
  );
  /** Rule 5: read on the hot path, so it lives in a ref, not in state. */
  const ahead = useRef(AHEAD.hd);
  const videos = useRef<Map<string, HTMLVideoElement>>(new Map());
  const failed = useRef<Set<string>>(new Set());
  /** The shot currently painted on screen — not necessarily the active one. */
  const shown = useRef<string | null>(null);
  const covered = useRef(false);
  /**
   * Newest requested time per clip. Rule 3: this is a single slot, not a
   * queue. A scroll that arrives while a seek is in flight overwrites it, so
   * the decoder always resumes toward where the visitor is *now*, never toward
   * a stale position it has already scrolled past.
   */
  const want = useRef<Map<string, number>>(new Map());
  const lastSeekAt = useRef(0);
  /** Rule 5: window changes are detected from this, not by rebuilding a list. */
  const windowIndex = useRef(-2);
  /** Rule 6: when the current shot became active, for the buffer timeout. */
  const activeSince = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  /** Failed load attempts per clip, for the retry in `handleError`. */
  const retries = useRef<Map<string, number>>(new Map());

  /**
   * A clip that fails to load is retried, not written off.
   *
   * This used to add straight to `failed`, which is permanent — and `failed`
   * means "fall back to the real-time scene for this shot", i.e. show the
   * placeholder geometry instead of the film. Off local disk a load error
   * essentially never happened. Served from object storage a single dropped
   * request is ordinary, and it stranded that shot on the placeholder for the
   * rest of the session.
   */
  const handleError = useCallback((id: string) => {
    const n = (retries.current.get(id) ?? 0) + 1;
    retries.current.set(id, n);
    if (n > 3) {
      failed.current.add(id);
      return;
    }
    window.setTimeout(() => {
      const el = videos.current.get(id);
      if (el) el.load();
    }, 400 * n);
  }, []);

  /** A clip that loads is no longer failed, however it got there. */
  const handleLoaded = useCallback((id: string) => {
    retries.current.delete(id);
    failed.current.delete(id);
  }, []);

  /** Set the target and, if the decoder is idle and off cooldown, move it. */
  const seekTo = useCallback((el: HTMLVideoElement, id: string, t: number) => {
    want.current.set(id, t);
    // A scrubbed clip must never be playing. `kick` starts playback on purpose
    // to force a fetch and pauses as soon as the promise resolves, but that
    // resolution is not instant — this makes "paused" an invariant of being
    // scrubbed rather than something the kick is trusted to restore.
    if (!el.paused) el.pause();
    if (el.seeking) return;
    if (Math.abs(el.currentTime - t) <= HALF_FRAME) return;
    const now = performance.now();
    if (now - lastSeekAt.current < MIN_SEEK_GAP_MS) return;
    lastSeekAt.current = now;
    el.currentTime = t;
  }, []);

  /**
   * Attach, and install the chase. The `seeked` listener is what keeps the
   * loop moving when the main thread is running slower than the decoder: the
   * moment a seek lands, if scroll has moved on, the next one starts without
   * waiting for another animation frame.
   */
  const attach = useCallback(
    (id: string, el: HTMLVideoElement | null) => {
      if (!el) {
        videos.current.delete(id);
        want.current.delete(id);
        return;
      }
      if (videos.current.get(id) === el) return;
      videos.current.set(id, el);
      el.addEventListener("seeked", () => {
        const target = want.current.get(id);
        if (target !== undefined) seekTo(el, id, target);
      });
    },
    [seekTo],
  );

  /* -- pick the rendition ------------------------------------------ */
  useEffect(() => {
    const next = detectProfile();
    ahead.current = AHEAD[next];
    setProfile(next);
    // Rebuild the window at the new width. -2 can never equal a real index,
    // so this also guarantees the next scroll tick rebuilds regardless.
    windowIndex.current = -2;
    setMounted(windowFrom(indexAt(scrollState.p), AHEAD[next]));
  }, []);

  /* -- slide the mount window ------------------------------------- */
  useEffect(() => {
    return subscribeScroll(({ p }) => {
      // Rule 5: an integer compare per frame, and a state update only on the
      // ~29 frames of the whole film where the window actually moves.
      const i = indexAt(p);
      if (i === windowIndex.current) return;
      windowIndex.current = i;
      setMounted(windowFrom(i, ahead.current));
    });
  }, []);

  /**
   * Mobile browsers will not fetch video data on their own.
   *
   * `preload="auto"` is a hint, and phones ignore it — Safari on iOS as
   * policy, Chrome on Android whenever it decides the connection is metered.
   * An element that has never been played then sits at readyState 0 with
   * nothing buffered, and because rule 1 will not show a clip that cannot
   * paint a frame, the film has nothing to display. That is a black screen,
   * for the whole film, on every phone.
   *
   * Starting playback is what actually triggers a fetch, so each stalled clip
   * is played and immediately paused. The videos are muted and inline, which
   * is the condition under which autoplay is permitted without a gesture; the
   * touch listeners are a backstop for the browsers that want one anyway.
   *
   * Only elements that have genuinely fetched nothing are touched, so on every
   * platform where preload works this does nothing at all, and it can never
   * disturb the clip on screen. A clip at readyState 0 has no decoded frame,
   * so the play/pause pair cannot produce a visible jump.
   */
  useEffect(() => {
    /** Kicks already spent per clip, so a genuinely broken one cannot loop. */
    const kicks = new Map<string, number>();

    const kick = () => {
      for (const [id, el] of videos.current) {
        // readyState 0 means the browser has fetched nothing at all. Anything
        // that has started loading is left alone, so this never disturbs a
        // clip that is working — including the one currently on screen, which
        // by definition has decoded a frame.
        if (el.readyState !== 0) continue;
        const n = kicks.get(id) ?? 0;
        if (n >= MAX_KICKS) continue;
        kicks.set(id, n + 1);
        const p = el.play();
        if (p && typeof p.then === "function") {
          p.then(() => el.pause()).catch(() => {
            /* Refused. The next kick will try again, up to MAX_KICKS. */
          });
        }
      }
    };

    // Every mounted clip, repeatedly — not once on the first gesture, which
    // is what this did at first and why it did not work. `once` unlocked
    // whatever happened to be mounted at the time and nothing afterwards, so
    // the film went black at the first shot boundary and stayed there.
    const timer = window.setInterval(kick, KICK_INTERVAL_MS);
    const opts = { passive: true } as const;
    window.addEventListener("touchstart", kick, opts);
    window.addEventListener("pointerdown", kick, opts);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("touchstart", kick);
      window.removeEventListener("pointerdown", kick);
    };
  }, []);

  /* -- park upcoming clips on their first frame -------------------- */
  // Once per window change rather than every frame. Clips already behind us
  // are deliberately left on their last frame — rule 1 depends on it.
  useEffect(() => {
    for (const shot of mounted) {
      if (failed.current.has(shot.id)) continue;
      if (shot.globalFrom <= scrollState.p) continue;
      const el = videos.current.get(shot.id);
      if (!el) continue;
      const park = () => {
        // The first playable frame, which is not frame zero on a trimmed shot.
        const d =
          Number.isFinite(el.duration) && el.duration > 0
            ? el.duration
            : shot.durationSec;
        const start = shotStartTime(shot, d);
        if (!el.seeking && Math.abs(el.currentTime - start) > 0.05) {
          want.current.set(shot.id, start);
          el.currentTime = start;
        }
      };
      if (el.readyState >= HAVE_CURRENT_DATA) park();
      else el.addEventListener("loadeddata", park, { once: true });
    }
    // `profile` matters as well as `mounted`: the elements do not exist until
    // it resolves, so a run before that finds no refs and parks nothing.
  }, [mounted, profile]);

  /* -- bind currentTime to scroll --------------------------------- */
  useEffect(() => {
    return subscribeScroll(({ p }) => {
      const active = shotAt(p);

      if (!active || failed.current.has(active.id)) {
        // No clip owns this range — reveal the real-time scene, but only
        // once, to avoid churning styles every frame.
        if (shown.current !== null) {
          for (const [, el] of videos.current) el.style.opacity = "0";
          shown.current = null;
        }
        if (covered.current) {
          covered.current = false;
          onCoverageChange?.(false);
        }
        return;
      }

      const el = videos.current.get(active.id);
      if (!el) return;

      const duration =
        Number.isFinite(el.duration) && el.duration > 0
          ? el.duration
          : active.durationSec;

      seekTo(el, active.id, shotClipTime(p, active, duration));

      // Rule 1: only hand over once the incoming clip can actually paint.
      // Until then the outgoing clip keeps its last frame on screen.
      if (el.readyState < HAVE_CURRENT_DATA) return;

      // Rule 6: and not until it is downloaded, or we have waited long enough
      // that a frozen frame is the worse of the two evils.
      if (activeSince.current.id !== active.id) {
        activeSince.current = { id: active.id, at: performance.now() };
      }
      if (
        shown.current !== active.id &&
        !readyAt(el, shotClipTime(p, active, duration)) &&
        performance.now() - activeSince.current.at < MAX_BUFFER_WAIT_MS
      ) {
        return;
      }

      if (shown.current !== active.id) {
        // Rule 2: hard switch, no fade. Raise the incoming clip, then drop
        // the rest in the same pass so there is never an uncovered frame.
        el.style.opacity = "1";
        el.style.zIndex = "2";
        for (const [id, other] of videos.current) {
          if (id === active.id) continue;
          other.style.opacity = "0";
          other.style.zIndex = "1";
        }
        shown.current = active.id;
      }

      if (!covered.current) {
        covered.current = true;
        onCoverageChange?.(true);
      }
    });
  }, [onCoverageChange, seekTo]);

  return (
    <div className="scrub-video-layer" aria-hidden="true">
      {/* Nothing renders until the rendition is known — see `detectProfile`. */}
      {profile !== null &&
        mounted.map((shot) => (
          <video
            key={shot.id}
            ref={(el) => attach(shot.id, el)}
            src={clipSrc(shot, profile)}
            preload="auto"
            muted
            playsInline
            autoPlay={false}
            controls={false}
            disablePictureInPicture
            disableRemotePlayback
            onError={() => handleError(shot.id)}
            onLoadedData={() => handleLoaded(shot.id)}
            style={{ opacity: 0, zIndex: 1 }}
          />
        ))}
    </div>
  );
}
