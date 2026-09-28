"use client";

// The site's three-zone layout, mounted once in app/layout.tsx so it survives
// navigation: only the middle column (the current route) changes. Both side
// panels are FIXED, non-scrolling shells (docs/redesign-spec.md phase 2):
//
//   left  — identity: the portrait plus big time / date / viewers tiles
//           (IdentityPanel). Protected — layout, contents and copy final.
//   right — the placeholder shell for the rail 3 redesign (RailThree):
//           ASCII block / Stats / theme accordion / BRUTAL, top to bottom.
//           Real content lands in phase 3; phase 2 only establishes the
//           non-scrolling grid.
//
// The middle column (the current route's content, under the sticky nav) is
// the only scroll container on the page, driven by a single Lenis instance.
// Below 1024px there are no fixed panels: CSS collapses everything into one
// stacked page (see the "HOME PANELS" block in globals.css) — rail 1 becomes
// a compact top strip and rail 3's controls become a fixed bottom bar, both
// in normal document flow / fixed positioning rather than a second scroller.

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { registerScroller, scrollToSection, unregisterScroller } from "@/lib/panelScroll";

// Lenis asks this for every element under a wheel/touch event; true means
// "leave this one alone" (out of dialogs, the palette backdrop and the
// mobile drawer — none of which should also move the page underneath them).
function shouldIgnore(node: HTMLElement) {
  return (
    node.getAttribute("role") === "dialog" ||
    node.hasAttribute("cmdk-overlay") ||
    node.classList.contains("nav-mobile-overlay")
  );
}

function PanelHead({ path }: { path: string }) {
  return (
    <div className="term-head panel-head">
      <span className="tdot"></span>
      <span className="tdot"></span>
      <span className="tdot"></span>
      <span className="path mono">{path}</span>
    </div>
  );
}

export default function HomeShell({
  left,
  children,
  right,
}: {
  left: ReactNode;
  children: ReactNode;
  right: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // The nav's real height, so the panel headers line up exactly with it (the
  // CSS fallback for --nav-h is already right, this only corrects any drift).
  useEffect(() => {
    const root = document.documentElement;
    const nav = document.querySelector<HTMLElement>("header.site-nav");
    const sync = () => {
      if (nav) root.style.setProperty("--nav-h", `${nav.offsetHeight}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(root);
    if (nav) observer.observe(nav);
    return () => {
      observer.disconnect();
    };
  }, []);

  // The page scroller, plus in-page anchor routing.
  useEffect(() => {
    const page = new Lenis({ autoRaf: true, prevent: shouldIgnore });
    registerScroller(page);

    // Route every in-page anchor through scrollToSection: the nav links, the
    // hero's "View work" button and the footer's "back to top" all point at
    // sections in this one scroller.
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
      // The skip link relies on the browser's own jump-and-focus.
      if (anchor?.hasAttribute("data-skip-link")) return;
      const href = anchor?.getAttribute("href");
      if (!href) return;
      // "Home" while already home: scroll to the top rather than do nothing.
      if (href === "/" && window.location.pathname === "/" && anchor?.closest(".nav-links, .nav-mobile-links")) {
        event.preventDefault();
        scrollToSection("top");
        history.replaceState(null, "", "/");
        return;
      }
      const id = href.startsWith("/#") ? href.slice(2) : href.startsWith("#") ? href.slice(1) : "";
      if (!id) return;
      if (scrollToSection(decodeURIComponent(id))) {
        event.preventDefault();
        history.replaceState(null, "", `#${id}`);
      } else if (href.startsWith("/#") && window.location.pathname !== "/") {
        // From another route: go to the home page client-side, so the
        // scroller stays mounted instead of reloading. The pathname effect
        // below scrolls to the section once the home page is in.
        event.preventDefault();
        router.push(href);
      }
    }
    document.addEventListener("click", onClick);

    // Opened as /#work etc.: the browser can only scroll the window, so
    // finish the job once the scroller exists.
    const hash = window.location.hash.slice(1);
    const hashTimer = hash
      ? setTimeout(() => scrollToSection(decodeURIComponent(hash), true), 200)
      : undefined;

    return () => {
      clearTimeout(hashTimer);
      document.removeEventListener("click", onClick);
      unregisterScroller(page);
      page.destroy();
    };
  }, [router]);

  // Route changes: the page scroller outlives the route, so put it back where
  // the new page starts (the top, or the section a "/#work" link names).
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    const hash = window.location.hash.slice(1);
    const timer = setTimeout(() => {
      if (!hash || !scrollToSection(decodeURIComponent(hash), true)) {
        scrollToSection("top", true);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div className="home-shell">
      <main className="home-main" id="main" tabIndex={-1}>
        {children}
      </main>

      <aside className="side-panel side-left" aria-label="Portrait, time, date and viewers">
        <PanelHead path="~/kumar/profile.sh" />
        <div className="panel-fixed">{left}</div>
      </aside>

      <aside className="side-panel side-right" aria-label="Status">
        <PanelHead path="~/kumar/status.sh" />
        <div className="panel-fixed">{right}</div>
      </aside>
    </div>
  );
}
