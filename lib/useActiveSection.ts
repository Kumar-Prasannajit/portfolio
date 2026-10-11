"use client";

// Which home-page section is under the sticky nav right now. Drives the nav's
// active link and the contextual pane title (docs/redesign-spec.md phase 8).
// One shared store with a single ref-counted scroll listener, like
// lib/useRailStats.ts. The page scrolls the window (Lenis without a wrapper
// still moves the native scroll position), so a plain scroll event is enough.
//
// "top" means above the first tracked section (hero, ticker) — and it is also
// what every non-home route reports, since none of these ids exist there.

import { useSyncExternalStore } from "react";

// DOM order. Only ids that exist on the current page are considered.
export const SECTION_IDS = ["activity", "about", "stack", "experience", "work", "contact"] as const;
export type SectionId = (typeof SECTION_IDS)[number] | "top";

// A section becomes current once its top edge is this far below the nav.
const ACTIVATE_OFFSET = 120;

let current: SectionId = "top";
let frame = 0;
const listeners = new Set<() => void>();

function compute(): SectionId {
  const navH = document.querySelector<HTMLElement>("header.site-nav")?.offsetHeight ?? 0;
  const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  let next: SectionId = "top";
  for (const id of SECTION_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    // The last section is short and can never scroll up to the offset line.
    if (el.getBoundingClientRect().top <= navH + ACTIVATE_OFFSET || (atBottom && id === "contact")) {
      next = id;
    }
  }
  return next;
}

function update() {
  frame = 0;
  const next = compute();
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(update);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
  }
  // Route changes mount a different set of sections; re-measure on subscribe.
  schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

/** Re-measure now — call after the route (and so the section set) changes. */
export function refreshActiveSection() {
  if (typeof window !== "undefined") schedule();
}

export function useActiveSection(): SectionId {
  return useSyncExternalStore(subscribe, () => current, () => "top");
}
