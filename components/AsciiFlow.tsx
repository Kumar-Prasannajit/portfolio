"use client";

// Rail 3's ambient ASCII block (docs/redesign-spec.md phase 3). Frames are
// pre-generated at authoring time (scripts/generate-ascii-frames.mjs) —
// this component only swaps textContent between them on an interval, never
// computes a frame itself. Single colour, from --accent via CSS (see
// .rail3-ascii-frame), so it re-colours with the active theme for free.
//
// Pauses under prefers-reduced-motion (freezes on the first frame) and
// while the tab is hidden — a 60-frame loop cycling in a background tab
// does nothing for anyone and just burns a timer.

import { useEffect, useRef, useState } from "react";
import { ASCII_FRAMES } from "@/lib/asciiFrames";

const FRAME_INTERVAL_MS = 130;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function AsciiFlow() {
  const [frameIndex, setFrameIndex] = useState(0);
  const indexRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion() || ASCII_FRAMES.length < 2) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;

    function start() {
      intervalId = setInterval(() => {
        indexRef.current = (indexRef.current + 1) % ASCII_FRAMES.length;
        setFrameIndex(indexRef.current);
      }, FRAME_INTERVAL_MS);
    }
    function stop() {
      clearInterval(intervalId);
      intervalId = undefined;
    }
    function onVisibilityChange() {
      if (document.hidden) stop();
      else start();
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <pre className="rail3-ascii-frame mono" aria-hidden="true">
      {ASCII_FRAMES[frameIndex]}
    </pre>
  );
}
