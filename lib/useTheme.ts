"use client";

// Shared theme-toggle logic, extracted out of Nav.tsx so the command
// palette's "Toggle dark mode" action can flip the same theme without
// duplicating the View Transitions wave animation. Client-only (reads
// document/localStorage/matchMedia).

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>;
  };
};

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// The theme actually being rendered right now: an explicit data-theme
// stamp wins, otherwise it's whatever the prefers-color-scheme media
// query is currently resolving the CSS variables to.
export function effectiveTheme(): "light" | "dark" {
  const stamped = document.documentElement.getAttribute("data-theme");
  if (stamped === "light" || stamped === "dark") return stamped;
  return systemPrefersDark() ? "dark" : "light";
}

export function useTheme() {
  // Base design is dark-first by default, matching the original site behavior.
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Syncs from the theme actually in effect — an explicit data-theme
    // stamp the pre-hydration inline script (see app/layout.tsx) may
    // have set from localStorage, or the system preference otherwise.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(effectiveTheme() === "dark");
  }, []);

  const applyTheme = useCallback((next: "light" | "dark") => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("kps-theme", next);
    } catch {}
    setIsDark(next === "dark");
  }, []);

  // `origin`, when given, is the point (usually a clicked button's own
  // center) the View Transitions "wave" grows from. Callers with no
  // natural anchor point — e.g. the command palette, triggered by
  // keyboard — omit it and get the plain crossfade instead, the same
  // fallback touch devices already use (animating a wave's clip-path
  // is cheap on desktop GPUs but not guaranteed on phone-class
  // hardware, or meaningful without a click to anchor to).
  const toggleTheme = useCallback(
    (origin?: { x: number; y: number }) => {
      const next = effectiveTheme() === "dark" ? "light" : "dark";
      const doc = document as ViewTransitionDocument;

      if (!doc.startViewTransition || prefersReducedMotion()) {
        applyTheme(next);
        return;
      }

      const coarsePointer =
        window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

      if (!origin || coarsePointer) {
        doc.startViewTransition(() => {
          flushSync(() => applyTheme(next));
        });
        return;
      }

      const { x, y } = origin;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = doc.startViewTransition(() => {
        flushSync(() => applyTheme(next));
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 650,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      });
    },
    [applyTheme]
  );

  return { isDark, toggleTheme };
}
