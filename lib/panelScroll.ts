// The home page's single Lenis scroller (see components/HomeShell.tsx) plus
// the one function anything else needs: scrollToSection(). Both side panels
// are fixed, non-scrolling shells (docs/redesign-spec.md phase 2) — every
// section lives in this one scrolling column, so the nav links, the hero's
// "View work" button and the ⌘K palette can all go through here without
// having to pick between scrollers.

import type Lenis from "lenis";

let pageScroller: Lenis | null = null;

export function registerScroller(lenis: Lenis) {
  pageScroller = lenis;
}

export function unregisterScroller(lenis: Lenis) {
  if (pageScroller === lenis) pageScroller = null;
}

/**
 * Smooth-scrolls to the element with this id. Returns false when the page
 * scroller isn't mounted (i.e. we're not on the home page) or the element
 * doesn't exist, so callers can fall back to a normal navigation.
 */
export function scrollToSection(id: string, immediate = false): boolean {
  if (typeof document === "undefined" || !pageScroller) return false;

  if (id === "top") {
    pageScroller.scrollTo(0, { immediate });
    return true;
  }

  const el = document.getElementById(id);
  if (!el) return false;

  const navH = document.querySelector<HTMLElement>("header.site-nav")?.offsetHeight ?? 0;
  const top = el.getBoundingClientRect().top + pageScroller.scroll - navH;
  pageScroller.scrollTo(Math.max(0, top), { immediate });
  return true;
}
