"use client";

import { useEffect, useRef } from "react";
import { NAV_TAGLINES } from "@/lib/data";

const HOLD_MS = 1900; // pause once a line is fully typed
const PAUSE_MS = 450; // pause on the empty line before typing the next one
const TYPE_BASE_MS = 85;
const TYPE_JITTER_MS = 45; // per-keystroke jitter, so typing reads as human, not metronomic
const DELETE_MS = 40; // backspacing is faster than typing, like a real editor

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function TaglineCycler() {
  const textRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const textEl = textRef.current;
    const cursorEl = cursorRef.current;
    if (!textEl || NAV_TAGLINES.length < 2) return;
    if (prefersReducedMotion()) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function setTyping(active: boolean) {
      cursorEl?.classList.toggle("is-typing", active);
    }

    function typeChar(line: string, charIndex: number) {
      if (cancelled || !textEl) return;
      setTyping(true);
      textEl.textContent = line.slice(0, charIndex);
      if (charIndex < line.length) {
        const delay = TYPE_BASE_MS + Math.random() * TYPE_JITTER_MS;
        timeoutId = setTimeout(() => typeChar(line, charIndex + 1), delay);
      } else {
        setTyping(false);
        timeoutId = setTimeout(() => deleteChar(line, line.length), HOLD_MS);
      }
    }

    function deleteChar(line: string, charIndex: number) {
      if (cancelled || !textEl) return;
      setTyping(true);
      textEl.textContent = line.slice(0, charIndex);
      if (charIndex > 0) {
        timeoutId = setTimeout(() => deleteChar(line, charIndex - 1), DELETE_MS);
      } else {
        setTyping(false);
        timeoutId = setTimeout(nextLine, PAUSE_MS);
      }
    }

    let index = 0;
    function nextLine() {
      index = (index + 1) % NAV_TAGLINES.length;
      typeChar(NAV_TAGLINES[index], 0);
    }

    // The first line is already fully rendered (server-rendered, no flash
    // of an empty box) — just hold on it, then start the type/delete loop.
    timeoutId = setTimeout(() => deleteChar(NAV_TAGLINES[0], NAV_TAGLINES[0].length), HOLD_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <p className="nav-tagline">
      <span ref={textRef}>{NAV_TAGLINES[0]}</span>
      <span ref={cursorRef} className="typewriter-cursor" aria-hidden="true" />
    </p>
  );
}
