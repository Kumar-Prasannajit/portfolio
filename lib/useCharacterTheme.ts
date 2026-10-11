"use client";

// The data-theme axis (docs/redesign-spec.md phase 1's character palette —
// zoro | luffy | news | shanks), managed the same way lib/useTheme.ts
// manages data-mode, but with an extra preview/commit split for the phase 3
// accordion: "hover previews the theme across the entire site; click
// commits it; leaving without clicking restores the previous theme."
//
// `committed` is the persisted choice (localStorage `kps-theme`, same key
// app/layout.tsx's no-flash script reads). `preview`/`restore` just flip the
// live `data-theme` attribute without touching storage or `committed`, so a
// hover that never resolves to a click leaves no trace.

import { useCallback, useEffect, useState } from "react";

export const CHARACTER_THEMES = ["shanks", "zoro", "luffy", "news"] as const;
export type CharacterTheme = (typeof CHARACTER_THEMES)[number];

function isCharacterTheme(value: string | null): value is CharacterTheme {
  return !!value && (CHARACTER_THEMES as readonly string[]).includes(value);
}

export function useCharacterTheme() {
  const [committed, setCommitted] = useState<CharacterTheme>("shanks");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isCharacterTheme(current)) setCommitted(current);
  }, []);

  const preview = useCallback((theme: CharacterTheme) => {
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  // Re-created when `committed` changes, which is exactly what should
  // happen — leaving a hover should always restore the *current* commit.
  const restore = useCallback(() => {
    document.documentElement.setAttribute("data-theme", committed);
  }, [committed]);

  const commit = useCallback((theme: CharacterTheme) => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("kps-theme", theme);
    } catch {}
    setCommitted(theme);
  }, []);

  return { committed, preview, restore, commit };
}
