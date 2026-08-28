"use client";

/**
 * Experience.tsx — decides whether the visitor gets the film at all.
 *
 * The full `prefers-reduced-motion` fallback is not a stripped-down version of
 * this page: it is the catalogue below, which is always in the DOM and always
 * server-rendered. This component simply declines to mount the film — no
 * WebGL context, no scroll hijack, no video — and the catalogue becomes the
 * site. The same path serves visitors with JavaScript disabled.
 */

import { useEffect, useState } from "react";

import { Stage } from "./Stage";

export function Experience() {
  const [allowMotion, setAllowMotion] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAllowMotion(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!allowMotion) return null;
  return <Stage />;
}
