"use client";

// One of the site's two reusable motion effects (docs/redesign-spec.md
// section 2, "motion budget"): "any live or computed value cycles random
// characters briefly, then lands on its real value." Built once here so
// rail 3's Stats rows (phase 3) and later the About/Stack sections' live
// variables (phases 5, 6) all share one implementation instead of drifting.
//
// Structural characters (space, ·, /) are never scrambled — only glyph
// positions cycle — so separators stay put and the string reads as
// "settling into place" rather than fully dissolving.

import { useEffect, useRef, useState } from "react";

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const STRUCTURAL = new Set([" ", "·", "/", ":", "-"]);
const FRAME_MS = 35;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function randomChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

export default function ScrambleText({
  value,
  duration = 500,
  className,
}: {
  value: string;
  /** Total scramble time in ms before every character has settled. */
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    // Reduced motion: the render below shows `value` directly in this case
    // (see the JSX), so there's nothing for this effect to animate.
    if (prefersReducedMotion()) return;

    const target = value;
    const totalFrames = Math.max(1, Math.round(duration / FRAME_MS));
    let frame = 0;

    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      frame++;
      const revealCount = Math.floor((frame / totalFrames) * target.length);
      let next = "";
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        next += i < revealCount || STRUCTURAL.has(ch) ? ch : randomChar();
      }
      setDisplay(next);
      if (frame >= totalFrames) {
        clearInterval(intervalRef.current);
        setDisplay(target);
      }
    }, FRAME_MS);

    return () => clearInterval(intervalRef.current);
  }, [value, duration]);

  return (
    <span className={className} aria-hidden="true">
      {prefersReducedMotion() ? value : display}
    </span>
  );
}
