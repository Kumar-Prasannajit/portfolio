"use client";

import { useEffect, useRef } from "react";

// Interactive elements the cursor "notices" (site-wide) — grows a little
// over them.
const HOVER_SELECTOR = 'a, button, [role="button"], input, textarea, summary';

// Inside the nav specifically, hovering a section morphs the cursor to
// that section's own shape and clip-reveals it via mix-blend-mode,
// instead of just growing — see the CSS for .custom-cursor.is-morphed.
const MORPH_SELECTOR = ".nav-grid a, .nav-grid button";
const MORPH_CIRCLE_SELECTOR = ".theme-toggle-btn";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;

    const finePointer =
      window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    const reducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Touch devices and reduced-motion users keep the normal system
    // cursor — this is a decorative replacement, not the only way to
    // see where you are.
    if (!finePointer || reducedMotion) return;

    document.documentElement.classList.add("custom-cursor-active");

    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;
    let morphed = false;
    let morphedEl: Element | null = null;

    function onMove(event: MouseEvent) {
      pendingX = event.clientX;
      pendingY = event.clientY;
      // While morphed onto a nav section, position is pinned to that
      // section's own rect, not the mouse — a magnetic snap, not a follow.
      if (morphed) return;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          if (!dot) return;
          dot.style.left = pendingX + "px";
          dot.style.top = pendingY + "px";
        });
      }
    }

    function enterMorph(el: Element) {
      if (!dot) return;
      const rect = el.getBoundingClientRect();
      morphed = true;
      morphedEl = el;
      // Difference-blending white against this design's red accents lands
      // on an off-palette cyan (255-224≈31, 255-48≈207, 255-58≈197) — so
      // while the cursor is over them, neutralize red to ink first, which
      // keeps the invert strictly within black/white/red.
      el.classList.add("cursor-invert-target");
      dot.classList.add("is-morphed", "is-hovering");
      dot.classList.toggle("is-circle", el.matches(MORPH_CIRCLE_SELECTOR));
      dot.style.left = rect.left + "px";
      dot.style.top = rect.top + "px";
      dot.style.width = rect.width + "px";
      dot.style.height = rect.height + "px";
    }

    function exitMorph() {
      if (!dot) return;
      morphed = false;
      morphedEl?.classList.remove("cursor-invert-target");
      morphedEl = null;
      dot.classList.remove("is-morphed", "is-hovering", "is-circle");
      dot.style.width = "";
      dot.style.height = "";
      dot.style.left = pendingX + "px";
      dot.style.top = pendingY + "px";
    }

    function onOver(event: MouseEvent) {
      const target = event.target as Element | null;
      const morphTarget = target?.closest(MORPH_SELECTOR);
      if (morphTarget) {
        enterMorph(morphTarget);
        return;
      }
      if (target?.closest(HOVER_SELECTOR)) {
        dot?.classList.add("is-hovering");
      }
    }

    function onOut(event: MouseEvent) {
      const target = event.target as Element | null;
      const related = event.relatedTarget as Element | null;
      const leavingMorph = target?.closest(MORPH_SELECTOR);
      if (leavingMorph && !related?.closest(MORPH_SELECTOR)) {
        exitMorph();
        return;
      }
      if (
        target?.closest(HOVER_SELECTOR) &&
        !related?.closest(HOVER_SELECTOR) &&
        !related?.closest(MORPH_SELECTOR)
      ) {
        dot?.classList.remove("is-hovering");
      }
    }

    function onLeaveWindow() {
      dot?.classList.add("is-hidden");
    }
    function onEnterWindow() {
      dot?.classList.remove("is-hidden");
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("mouseleave", onLeaveWindow);
    document.addEventListener("mouseenter", onEnterWindow);

    return () => {
      document.documentElement.classList.remove("custom-cursor-active");
      morphedEl?.classList.remove("cursor-invert-target");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("mouseleave", onLeaveWindow);
      document.removeEventListener("mouseenter", onEnterWindow);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return <div ref={dotRef} className="custom-cursor is-hidden" aria-hidden="true" />;
}
