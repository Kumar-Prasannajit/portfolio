"use client";

import { useEffect, useRef } from "react";

// Interactive elements the cursor "notices" (site-wide) — grows a little
// over them.
const HOVER_SELECTOR = 'a, button, [role="button"], input, textarea, summary';

// Inside the nav specifically, hovering a section morphs the cursor to
// that section's own shape and clip-reveals it via mix-blend-mode,
// instead of just growing — see the CSS for .custom-cursor.is-morphed.
// The logo cell's favicon-on-hover mark is meant to stay red under that
// white diff-blend (unlike other red content, which gets neutralized to
// ink — see .cursor-invert-target below); it's pre-inverted in CSS
// (.cursor-invert-target .nav-logo-img-hover) so the blend cancels back
// to its true red instead of drifting off-palette.
//
// Light mode can't get a clean white out of that same diff-blend math
// (see the "Light mode: red-on-hover nav sections" block in globals.css),
// so it uses a different, non-blended reveal there — but driven by the
// exact same --morph-x/-y/-r geometry computed once in enterMorph below.
const MORPH_SELECTOR = ".nav-grid a, .nav-grid button";

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
    let morphedEl: HTMLElement | null = null;

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

    function enterMorph(el: HTMLElement, originX: number, originY: number) {
      if (!dot) return;
      // Moving straight from one morph target to an adjacent one (still
      // inside .nav-grid) never fires exitMorph — onOut deliberately skips
      // it so the handoff doesn't blip — so the previous target's class
      // has to be cleared here instead, or it stays stuck "activated"
      // until it's hovered again.
      if (morphedEl && morphedEl !== el) {
        morphedEl.classList.remove("cursor-invert-target");
      }
      const rect = el.getBoundingClientRect();
      morphed = true;
      morphedEl = el;
      // Difference-blending white against this design's red accents lands
      // on an off-palette cyan (255-224≈31, 255-48≈207, 255-58≈197) — so
      // while the cursor is over them, neutralize red to ink first, which
      // keeps the invert strictly within black/white/red.
      el.classList.add("cursor-invert-target");
      dot.classList.add("is-morphed", "is-hovering");

      // Snap the box itself to the target rect instantly — the fluid part
      // is the clip-path circle below, not a box resize/slide.
      dot.style.transition = "none";
      dot.style.left = rect.left + "px";
      dot.style.top = rect.top + "px";
      dot.style.width = rect.width + "px";
      dot.style.height = rect.height + "px";

      // The circle grows from wherever the pointer actually entered the
      // section out to its farthest corner, so it always ends up fully
      // covering the rect regardless of where the hover started.
      const localX = Math.min(Math.max(originX - rect.left, 0), rect.width);
      const localY = Math.min(Math.max(originY - rect.top, 0), rect.height);
      const radius = Math.max(
        Math.hypot(localX, localY),
        Math.hypot(rect.width - localX, localY),
        Math.hypot(localX, rect.height - localY),
        Math.hypot(rect.width - localX, rect.height - localY)
      );
      // Same geometry drives two different reveals: the global cursor's
      // own diff-blend circle (dark mode), and — since custom properties
      // inherit into pseudo-elements — the hovered element's own
      // ::before wipe (light mode; see the .cursor-invert-target::before
      // rules in globals.css). Both get set here so either can pick it
      // up depending on theme.
      const x = localX + "px";
      const y = localY + "px";
      dot.style.setProperty("--morph-x", x);
      dot.style.setProperty("--morph-y", y);
      dot.style.setProperty("--morph-r", "0px");
      el.style.setProperty("--morph-x", x);
      el.style.setProperty("--morph-y", y);
      el.style.setProperty("--morph-r", "0px");

      // Force a reflow so the 0px starting radius above actually commits
      // before re-enabling the transition — otherwise the browser
      // coalesces both style changes into one and there's nothing to
      // animate from.
      void dot.offsetWidth;
      dot.style.transition = "";
      dot.style.setProperty("--morph-r", radius + "px");
      el.style.setProperty("--morph-r", radius + "px");
    }

    function exitMorph() {
      if (!dot) return;
      morphed = false;
      morphedEl?.classList.remove("cursor-invert-target");
      morphedEl = null;
      dot.classList.remove("is-morphed", "is-hovering");
      dot.style.width = "";
      dot.style.height = "";
      dot.style.left = pendingX + "px";
      dot.style.top = pendingY + "px";
    }

    function onOver(event: MouseEvent) {
      const target = event.target as Element | null;
      const morphTarget = target?.closest(MORPH_SELECTOR);
      if (morphTarget) {
        // MORPH_SELECTOR only matches a/button, always HTMLElements.
        enterMorph(morphTarget as HTMLElement, event.clientX, event.clientY);
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
