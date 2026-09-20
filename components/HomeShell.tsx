"use client";

// The home page's three-zone layout. On wide screens the middle column is the
// normal page (Hero, heatmap, contact, footer under the sticky nav) and the
// two hatched gutters become fixed side panels that each scroll on their own:
//
//   left  — profile: About, Stack, Experience. Ordinary scroll, stops at its
//           ends.
//   right — projects. Loops forever, drifting slowly; hovering pauses it so
//           a project can be read and clicked, and the wheel scrolls it by
//           hand in either direction.
//
// Every scroller is a Lenis instance (smooth wheel scrolling). Below 1024px
// there are no panels: CSS collapses everything into one stacked page (see
// the "HOME PANELS" block in globals.css) and only the page-level Lenis runs.
// The 1024–1279px range shows a single side panel with PROFILE / PROJECTS tabs.

import { useEffect, useRef, useState, type ReactNode } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import {
  PANEL_MEDIA,
  PANEL_TAB_EVENT,
  registerScroller,
  scrollToSection,
  unregisterScroller,
} from "@/lib/panelScroll";

// The right panel renders its content this many times back to back and keeps
// the scroll position inside the middle band, so the loop has no visible seam.
// Position is kept in [1, 3) set-heights, starting at set 2 — which needs a
// visible height of at most two sets.
const LOOP_SETS = 5;
const LOOP_START_SET = 2;
const DRIFT_PX_PER_SEC = 28;
// After a finger lifts off the panel, wait this long before drifting again.
const TOUCH_RESUME_MS = 2500;

type Tab = "profile" | "projects";

// Lenis asks this for every element under a wheel/touch event; true means
// "leave this one alone". Keeps the page-level scroller from also scrolling
// while the wheel is over a side panel (which has its own scroller), and out
// of dialogs, the palette backdrop and the mobile drawer.
function shouldIgnore(node: HTMLElement, panelMode: boolean) {
  return (
    node.getAttribute("role") === "dialog" ||
    node.hasAttribute("cmdk-overlay") ||
    node.classList.contains("nav-mobile-overlay") ||
    (panelMode && node.classList.contains("panel-scroll"))
  );
}

function PanelHead({
  path,
  tab,
  onTab,
  status,
}: {
  path: string;
  tab: Tab;
  onTab: (tab: Tab) => void;
  status?: ReactNode;
}) {
  return (
    <div className="term-head panel-head">
      <span className="tdot"></span>
      <span className="tdot"></span>
      <span className="tdot"></span>
      <span className="path mono">{path}</span>
      {status}
      <div className="panel-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "profile"}
          onClick={() => onTab("profile")}
        >
          PROFILE
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "projects"}
          onClick={() => onTab("projects")}
        >
          PROJECTS
        </button>
      </div>
    </div>
  );
}

export default function HomeShell({
  left,
  middle,
  right,
}: {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("profile");
  const [paused, setPaused] = useState(false);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightAsideRef = useRef<HTMLElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  // Measurements the CSS can't know: the real viewport width (without the
  // page scrollbar, which 100vw includes) and the nav's height, so the panel
  // headers line up exactly with it.
  useEffect(() => {
    const root = document.documentElement;
    const nav = document.querySelector<HTMLElement>("header.site-nav");
    const sync = () => {
      root.style.setProperty("--vw", `${root.clientWidth}px`);
      if (nav) root.style.setProperty("--nav-h", `${nav.offsetHeight}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(root);
    if (nav) observer.observe(nav);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--vw");
      root.style.removeProperty("--nav-h");
    };
  }, []);

  // Tabbed layout: switch to whichever panel a jump-link points into.
  useEffect(() => {
    function onTab(event: Event) {
      const name = (event as CustomEvent<string>).detail;
      setTab(name === "right" ? "projects" : "profile");
    }
    window.addEventListener(PANEL_TAB_EVENT, onTab);
    return () => window.removeEventListener(PANEL_TAB_EVENT, onTab);
  }, []);

  // The scrollers themselves.
  useEffect(() => {
    const panelQuery = window.matchMedia(PANEL_MEDIA);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const page = new Lenis({
      autoRaf: true,
      prevent: (node) => shouldIgnore(node, panelQuery.matches),
    });
    registerScroller("page", page);

    function mountPanels() {
      const leftEl = leftScrollRef.current;
      const rightEl = rightScrollRef.current;
      const rightAside = rightAsideRef.current;
      const leftContent = leftEl?.firstElementChild;
      const rightContent = rightEl?.firstElementChild;
      if (!leftEl || !rightEl || !rightAside || !leftContent || !rightContent) {
        return () => {};
      }

      const leftLenis = new Lenis({
        wrapper: leftEl,
        content: leftContent,
        autoRaf: true,
      });
      const rightLenis = new Lenis({
        wrapper: rightEl,
        content: rightContent,
        autoRaf: true,
      });
      registerScroller("left", leftLenis);
      registerScroller("right", rightLenis);

      // --- Right panel: infinite loop -----------------------------------
      rightContent
        .querySelectorAll<HTMLElement>(".loop-clone a")
        .forEach((link) => (link.tabIndex = -1));
      let setHeight = 0;
      let positioned = false;
      const measure = () => {
        const sets = rightContent.querySelectorAll<HTMLElement>(".loop-set");
        setHeight = sets.length > 1 ? sets[1].offsetTop - sets[0].offsetTop : 0;
        if (setHeight > 0 && !positioned) {
          positioned = true;
          rightLenis.scrollTo(setHeight * LOOP_START_SET, { immediate: true });
        }
      };
      const resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(rightContent);
      measure();

      // Anything that should stop the drift: mouse over the panel, a finger
      // on it, or keyboard focus inside it (so a focused link doesn't slide
      // away from under the user).
      let hovered = false;
      let touching = false;
      let focused = false;
      let touchTimer: ReturnType<typeof setTimeout> | undefined;
      let isPaused = false;
      const updatePaused = () => {
        isPaused = hovered || touching || focused;
        setPaused(isPaused);
      };
      const onEnter = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        hovered = true;
        updatePaused();
      };
      const onLeave = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        hovered = false;
        updatePaused();
      };
      const onTouchStart = (e: PointerEvent) => {
        if (e.pointerType !== "touch") return;
        clearTimeout(touchTimer);
        touching = true;
        updatePaused();
      };
      const onTouchEnd = (e: PointerEvent) => {
        if (e.pointerType !== "touch") return;
        clearTimeout(touchTimer);
        touchTimer = setTimeout(() => {
          touching = false;
          updatePaused();
        }, TOUCH_RESUME_MS);
      };
      const onFocusIn = () => {
        focused = true;
        updatePaused();
      };
      const onFocusOut = (e: FocusEvent) => {
        if (rightAside.contains(e.relatedTarget as Node | null)) return;
        focused = false;
        updatePaused();
      };
      rightAside.addEventListener("pointerenter", onEnter);
      rightAside.addEventListener("pointerleave", onLeave);
      rightAside.addEventListener("pointerdown", onTouchStart);
      rightAside.addEventListener("pointerup", onTouchEnd);
      rightAside.addEventListener("pointercancel", onTouchEnd);
      rightAside.addEventListener("focusin", onFocusIn);
      rightAside.addEventListener("focusout", onFocusOut);

      let raf = 0;
      let last = performance.now();
      let pos = 0;
      let wasDrifting = false;
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(now - last, 64) / 1000;
        last = now;
        if (setHeight <= 0) {
          wasDrifting = false;
          return;
        }

        // Keep the scroll inside the middle band, whoever is moving it
        // (the drift below, or the visitor's wheel).
        let current = rightLenis.scroll;
        if (current >= setHeight * 3) {
          current -= setHeight;
          rightLenis.scrollTo(current, { immediate: true });
        } else if (current < setHeight) {
          current += setHeight;
          rightLenis.scrollTo(current, { immediate: true });
        }

        // A card revealed by a tap also holds the drift, so it isn't pulled
        // out from under the reader.
        const drifting =
          !isPaused &&
          !document.hidden &&
          !reducedMotion.matches &&
          !rightAside.querySelector(".pcard.is-revealed");
        if (drifting) {
          // The drift keeps its own fractional position: at 1x DPR the
          // browser rounds scrollTop, and re-reading it every frame would
          // round the sub-pixel step away and stall the panel.
          if (!wasDrifting) pos = current;
          pos += DRIFT_PX_PER_SEC * dt;
          if (pos >= setHeight * 3) pos -= setHeight;
          rightLenis.scrollTo(pos, { immediate: true });
        }
        wasDrifting = drifting;
      };
      raf = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(touchTimer);
        resizeObserver.disconnect();
        rightAside.removeEventListener("pointerenter", onEnter);
        rightAside.removeEventListener("pointerleave", onLeave);
        rightAside.removeEventListener("pointerdown", onTouchStart);
        rightAside.removeEventListener("pointerup", onTouchEnd);
        rightAside.removeEventListener("pointercancel", onTouchEnd);
        rightAside.removeEventListener("focusin", onFocusIn);
        rightAside.removeEventListener("focusout", onFocusOut);
        setPaused(false);
        unregisterScroller("left", leftLenis);
        unregisterScroller("right", rightLenis);
        leftLenis.destroy();
        rightLenis.destroy();
      };
    }

    let unmountPanels: (() => void) | null = null;
    const syncPanels = () => {
      unmountPanels?.();
      unmountPanels = panelQuery.matches ? mountPanels() : null;
    };
    syncPanels();
    panelQuery.addEventListener("change", syncPanels);

    // Route every in-page anchor through scrollToSection: the nav links, the
    // hero's "View work" button and the footer's "back to top" all point at
    // sections that may live in a different scroller than the window.
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element).closest("a");
      const href = anchor?.getAttribute("href");
      if (!href) return;
      const id = href.startsWith("/#") ? href.slice(2) : href.startsWith("#") ? href.slice(1) : "";
      if (!id) return;
      if (scrollToSection(decodeURIComponent(id))) {
        event.preventDefault();
        history.replaceState(null, "", `#${id}`);
      }
    }
    document.addEventListener("click", onClick);

    // Opened as /#work etc.: the browser can only scroll the window, so
    // finish the job once the panels exist.
    const hash = window.location.hash.slice(1);
    const hashTimer = hash
      ? setTimeout(() => scrollToSection(decodeURIComponent(hash), true), 200)
      : undefined;

    return () => {
      clearTimeout(hashTimer);
      document.removeEventListener("click", onClick);
      panelQuery.removeEventListener("change", syncPanels);
      unmountPanels?.();
      unregisterScroller("page", page);
      page.destroy();
    };
  }, []);

  return (
    <div className="home-shell" data-tab={tab}>
      <main className="home-main">{middle}</main>

      <aside className="side-panel side-left" aria-label="Profile">
        <PanelHead path="~/kumar/profile.sh" tab={tab} onTab={setTab} />
        <div
          className="panel-scroll"
          data-scroller="left"
          ref={leftScrollRef}
          tabIndex={0}
        >
          <div className="panel-content">{left}</div>
        </div>
      </aside>

      <aside
        className="side-panel side-right"
        aria-label="Projects"
        ref={rightAsideRef}
      >
        <PanelHead
          path="~/kumar/projects"
          tab={tab}
          onTab={setTab}
          status={
            <span className="panel-status mono">
              {paused ? "❚❚ PAUSED" : "▶ AUTO"}
            </span>
          }
        />
        <div className="panel-scroll" data-scroller="right" ref={rightScrollRef}>
          <div className="panel-content">
            {/* Only the first copy is real: the rest exist to make the loop
                seamless, so they're hidden from assistive tech and their links
                are taken out of the tab order (see mountPanels). They must
                stay clickable though — the scroll sits in the middle copies
                most of the time. #work lives in the main column, not here. */}
            {Array.from({ length: LOOP_SETS }, (_, i) => (
              <div
                key={i}
                className={i === 0 ? "loop-set" : "loop-set loop-clone"}
                aria-hidden={i > 0 ? true : undefined}
              >
                {right}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
