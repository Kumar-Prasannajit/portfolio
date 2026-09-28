"use client";

// The data-ui axis (docs/redesign-spec.md phase 1: default | brutal), wired
// to rail 3's BRUTAL button (phase 3). Deliberately the simplest of the
// three theme hooks — no preview/commit split like useCharacterTheme, no
// View Transitions wave like useTheme: "the brutal toggle snaps with no
// transition — the hard cut is intentional," so this is just a flip.

import { useCallback, useEffect, useState } from "react";

export function useUiMode() {
  const [brutal, setBrutal] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrutal(document.documentElement.getAttribute("data-ui") === "brutal");
  }, []);

  const toggle = useCallback(() => {
    setBrutal((wasBrutal) => {
      const next = !wasBrutal;
      const root = document.documentElement;
      if (next) {
        root.setAttribute("data-ui", "brutal");
      } else {
        root.removeAttribute("data-ui");
      }
      try {
        if (next) localStorage.setItem("kps-ui", "brutal");
        else localStorage.removeItem("kps-ui");
      } catch {}
      return next;
    });
  }, []);

  return { brutal, toggle };
}
