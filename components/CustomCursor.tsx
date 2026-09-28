"use client";

import { useEffect, useRef } from "react";

// Elements that give the cursor a text label (data-cursor="View"): over them
// the block becomes a small red tag reading that word — the project cards use
// it, so a card reads as clickable even though it has no visible button.
const LABEL_SELECTOR = "[data-cursor]";

// Interactive elements the cursor "notices" (site-wide) — grows a little
// over them. `label` covers the theme accordion's panels (each is a
// <label> wrapping a visually-hidden radio, not a button/input itself —
// see RailThree.tsx) and is otherwise unused anywhere else in the codebase.
const HOVER_SELECTOR = 'a, button, [role="button"], input, textarea, summary, label';

// Text-entry elements: the real system caret comes back here and the fake
// block hides, so editing text keeps its native precision instead of a
// monospace-grid-snapped block standing in for it. The accordion's own
// radio input is excluded deliberately — it's a control, not something
// you type into.
const TEXT_SELECTOR =
  'input:not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]';

// Theme accordion panels (docs/redesign-spec.md phase 3/4): hovering one
// tints the cursor to that panel's own swatch colour, so the block itself
// previews the palette before you commit to it.
const ACCORDION_SELECTOR = ".rail3-accordion-panel[data-swatch]";

// Inside the nav specifically, hovering a section morphs the cursor to
// that section's own shape and clip-reveals it via mix-blend-mode,
// instead of just growing — see the CSS for .custom-cursor-shape.is-morphed.
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
//
// :not(.nav-command-menu *) excludes the ⌘K dropdown's own menu items.
// They're technically inside .nav-grid too (the dropdown mounts inside
// the command nav-cell), so without this they'd match here by accident —
// but .cursor-invert-target has no `position: relative` entry for them
// (see globals.css), so the ::before reveal layer's `inset: 0` has
// nothing to anchor to on the row itself and bubbles up to
// .nav-command-menu's own positioned box instead, stretching the
// row-sized circle across the whole dropdown panel. The dropdown already
// has its own plain hover (.nav-command-menu a:hover/button:hover) that
// this would otherwise fight with.
const MORPH_SELECTOR =
  ".nav-grid a:not(.nav-command-menu *), .nav-grid button:not(.nav-command-menu *)";

// Phase 4 (docs/redesign-spec.md): "move in discrete steps aligned to the
// monospace grid (one `ch`, or 8px)". A caret steps; it does not glide —
// this only quantizes where the fake block is *drawn*, never the real
// pointer position browsers hit-test against, so it has no effect on
// click precision, only on how the follow motion reads.
const GRID_STEP = 8;
function snap(value: number) {
  return Math.round(value / GRID_STEP) * GRID_STEP;
}

// "Starts blinking after ~2s stationary, exactly like a real caret."
const IDLE_DELAY = 2000;

export default function CustomCursor() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const shapeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const shape = shapeRef.current;
    if (!wrap || !shape) return;

    // Same test the magnetic buttons use: a hover-capable fine pointer.
    const finePointer =
      window.matchMedia &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
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
    let overTextInput = false;
    let idleTimerId = 0;

    function scheduleIdle() {
      window.clearTimeout(idleTimerId);
      shape?.classList.remove("is-idle");
      idleTimerId = window.setTimeout(() => {
        // Never blink mid-morph — the block is a clip-revealed overlay on
        // the nav section there, not a caret, and an opacity flash would
        // fight that reveal instead of reading as "idle".
        if (!morphed) shape?.classList.add("is-idle");
      }, IDLE_DELAY);
    }

    function positionAt(x: number, y: number) {
      if (!wrap) return;
      wrap.style.transform = `translate(${snap(x)}px, ${snap(y)}px)`;
    }

    function onMove(event: MouseEvent) {
      pendingX = event.clientX;
      pendingY = event.clientY;
      // Belt-and-suspenders alongside onEnterWindow: Chromium synthesizes a
      // mousemove/hover-sync event right after load when the pointer is
      // already over the page, which incidentally fires `mouseenter` too —
      // Firefox-family browsers (Zen included) don't, and stay silent
      // until the pointer actually moves. Since `mouseenter` on `document`
      // only fires crossing the viewport boundary from outside (rare once
      // a tab has already loaded), relying on it alone left the dot stuck
      // at opacity 0 indefinitely in Firefox/Zen. Any real mousemove means
      // the pointer is inside the document, so it's always safe to reveal
      // here too — unless it's currently sitting over a text field, where
      // the real system caret is doing the job instead.
      if (!overTextInput) wrap?.classList.remove("is-hidden");
      scheduleIdle();
      // While morphed onto a nav section, position is pinned to that
      // section's own rect, not the mouse — a magnetic snap, not a follow.
      if (morphed) return;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          if (morphed) return;
          positionAt(pendingX, pendingY);
        });
      }
    }

    function enterMorph(el: HTMLElement, originX: number, originY: number) {
      if (!wrap || !shape) return;
      // mouseover bubbles for every element boundary crossed, including
      // ones entirely inside the same target (e.g. from its <svg> onto
      // its <path>) — each of those re-fires onOver with the same
      // closest(MORPH_SELECTOR) match. Without this guard, every such
      // micro-move inside an already-morphed element replayed the whole
      // reset-to-0-then-grow animation, flickering the reveal for any
      // hover longer than an instant.
      if (morphed && morphedEl === el) return;
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
      shape.classList.remove("is-idle");
      // Difference-blending white against this design's red accents lands
      // on an off-palette cyan (255-224≈31, 255-48≈207, 255-58≈197) — so
      // while the cursor is over them, neutralize red to ink first, which
      // keeps the invert strictly within black/white/red.
      el.classList.add("cursor-invert-target");
      shape.classList.add("is-morphed", "is-hovering");

      // Snap the wrapper straight to the target rect's origin — instant,
      // no transition (position is never eased, morphed or not) — and the
      // shape to its exact size, also instant: the fluid part is the
      // clip-path circle below, not a box resize/slide.
      wrap.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      shape.style.transition = "none";
      shape.style.width = rect.width + "px";
      shape.style.height = rect.height + "px";

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
      shape.style.setProperty("--morph-x", x);
      shape.style.setProperty("--morph-y", y);
      shape.style.setProperty("--morph-r", "0px");
      el.style.setProperty("--morph-x", x);
      el.style.setProperty("--morph-y", y);
      el.style.setProperty("--morph-r", "0px");

      // Force a reflow so the 0px starting radius above actually commits
      // before re-enabling the transition — otherwise the browser
      // coalesces both style changes into one and there's nothing to
      // animate from.
      void shape.offsetWidth;
      shape.style.transition = "";
      shape.style.setProperty("--morph-r", radius + "px");
      el.style.setProperty("--morph-r", radius + "px");
    }

    function exitMorph() {
      if (!wrap || !shape) return;
      morphed = false;
      morphedEl?.classList.remove("cursor-invert-target");
      morphedEl = null;
      shape.classList.remove("is-morphed", "is-hovering");
      shape.style.width = "";
      shape.style.height = "";
      positionAt(pendingX, pendingY);
    }

    function onOver(event: MouseEvent) {
      const target = event.target as Element | null;
      if (target?.closest(TEXT_SELECTOR)) {
        overTextInput = true;
        wrap?.classList.add("is-hidden");
        return;
      }
      const morphTarget = target?.closest(MORPH_SELECTOR);
      if (morphTarget) {
        // MORPH_SELECTOR only matches a/button, always HTMLElements.
        enterMorph(morphTarget as HTMLElement, event.clientX, event.clientY);
        return;
      }
      const accordionTarget = target?.closest<HTMLElement>(ACCORDION_SELECTOR);
      if (accordionTarget) {
        const theme = accordionTarget.dataset.swatch;
        shape?.style.setProperty("--cursor-tint", `var(--swatch-${theme})`);
        shape?.classList.add("is-tinted", "is-hovering");
        return;
      }
      shape?.classList.remove("is-tinted");
      // Cleared here as well as in onOut: a labelled element that is removed
      // under the pointer (route change) never fires its own mouseout.
      const labelTarget = target?.closest<HTMLElement>(LABEL_SELECTOR);
      if (labelTarget && shape) {
        shape.dataset.label = labelTarget.dataset.cursor ?? "";
        shape.classList.add("is-labelled");
        shape.classList.remove("is-hovering");
        return;
      }
      shape?.classList.remove("is-labelled");
      if (target?.closest(HOVER_SELECTOR)) {
        shape?.classList.add("is-hovering");
      }
    }

    function onOut(event: MouseEvent) {
      const target = event.target as Element | null;
      const related = event.relatedTarget as Element | null;
      const leavingText = target?.closest(TEXT_SELECTOR);
      if (leavingText && !related?.closest(TEXT_SELECTOR)) {
        overTextInput = false;
        positionAt(pendingX, pendingY);
        wrap?.classList.remove("is-hidden");
      }
      if (target?.closest(LABEL_SELECTOR) && !related?.closest(LABEL_SELECTOR)) {
        shape?.classList.remove("is-labelled");
      }
      const leavingAccordion = target?.closest(ACCORDION_SELECTOR);
      if (leavingAccordion && !related?.closest(ACCORDION_SELECTOR)) {
        shape?.classList.remove("is-tinted");
      }
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
        shape?.classList.remove("is-hovering");
      }
    }

    function onDown() {
      shape?.classList.add("is-pressed");
    }
    function onUp() {
      shape?.classList.remove("is-pressed");
    }

    function onLeaveWindow() {
      wrap?.classList.add("is-hidden");
    }
    function onEnterWindow() {
      if (!overTextInput) wrap?.classList.remove("is-hidden");
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("mouseleave", onLeaveWindow);
    document.addEventListener("mouseenter", onEnterWindow);

    return () => {
      document.documentElement.classList.remove("custom-cursor-active");
      morphedEl?.classList.remove("cursor-invert-target");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseleave", onLeaveWindow);
      document.removeEventListener("mouseenter", onEnterWindow);
      if (rafId) cancelAnimationFrame(rafId);
      window.clearTimeout(idleTimerId);
    };
  }, []);

  return (
    <div ref={wrapRef} className="custom-cursor is-hidden" aria-hidden="true">
      <div ref={shapeRef} className="custom-cursor-shape" />
    </div>
  );
}
