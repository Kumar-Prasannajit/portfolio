// Registry of the home page's Lenis scrollers (see components/HomeShell.tsx)
// plus the one function anything else needs: scrollToSection(). On the home
// page the sections live in different scroll containers (the page itself and
// the looping right panel), so a plain `#about` anchor can't be
// trusted to scroll the right one — the nav links, the hero's "View work"
// button and the ⌘K palette all go through here instead.

import type Lenis from "lenis";

// Below this width the panels collapse into one ordinary stacked page.
export const PANEL_MEDIA = "(min-width: 1024px)";

// Fired when a target lives in a panel that's currently hidden (the
// tabbed 1024–1279px layout only shows one side panel at a time).
export const PANEL_TAB_EVENT = "home-panel-tab";

export type ScrollerName = "page" | "right";

const scrollers = new Map<ScrollerName, Lenis>();

export function registerScroller(name: ScrollerName, lenis: Lenis) {
  scrollers.set(name, lenis);
}

export function unregisterScroller(name: ScrollerName, lenis: Lenis) {
  if (scrollers.get(name) === lenis) scrollers.delete(name);
}

/**
 * Smooth-scrolls to the element with this id, in whichever scroller owns it.
 * Returns false when the home scrollers aren't mounted (i.e. we're not on the
 * home page) or the element doesn't exist, so callers can fall back to a
 * normal navigation.
 */
export function scrollToSection(id: string, immediate = false, attempt = 0): boolean {
  if (typeof document === "undefined") return false;
  const page = scrollers.get("page");
  if (!page) return false;

  if (id === "top") {
    page.scrollTo(0, { immediate });
    return true;
  }

  const el = document.getElementById(id);
  if (!el) return false;

  const panelEl = el.closest<HTMLElement>(".panel-scroll");
  if (panelEl && window.matchMedia(PANEL_MEDIA).matches) {
    const name = panelEl.dataset.scroller as ScrollerName;
    const lenis = scrollers.get(name);
    if (!lenis) return false;

    // Hidden panel (tabbed layout): ask the shell to switch tabs, then retry
    // once it has rendered. `attempt` stops a failed switch looping forever.
    if (panelEl.getClientRects().length === 0) {
      if (attempt > 2) return false;
      window.dispatchEvent(new CustomEvent(PANEL_TAB_EVENT, { detail: name }));
      requestAnimationFrame(() =>
        requestAnimationFrame(() => scrollToSection(id, immediate, attempt + 1))
      );
      return true;
    }

    // The looping right panel renders several copies of its content; land on
    // the middle copy so there's room to drift and scroll both ways.
    const target =
      name === "right"
        ? (panelEl.querySelectorAll<HTMLElement>(".loop-set")[2] ?? el)
        : el;
    // Lenis's own element scrolling assumes the container starts at the top
    // of the viewport; these panels sit below a header, so measure against
    // the panel instead.
    const top =
      target.getBoundingClientRect().top -
      panelEl.getBoundingClientRect().top +
      lenis.scroll;
    lenis.scrollTo(Math.max(0, top - 8), { immediate });
    return true;
  }

  // Middle column / stacked layout: the page scrolls, under a sticky nav.
  const navH = document.querySelector<HTMLElement>("header.site-nav")?.offsetHeight ?? 0;
  const top = el.getBoundingClientRect().top + page.scroll - navH;
  page.scrollTo(Math.max(0, top), { immediate });
  return true;
}
