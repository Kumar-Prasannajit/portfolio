"use client";

// Wires the optional interaction sounds (lib/sound.ts) to the page with one
// set of delegated listeners: a soft tick when the mouse enters a link or
// button, a click sound when one is activated, and a tone when the route
// changes without a click (keyboard / ⌘K navigation). Renders nothing, and
// does nothing at all unless the visitor has turned sound on.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { playSound, unlockAudio } from "@/lib/sound";

const INTERACTIVE = 'a[href], button, [role="button"], summary';

export default function SoundEffects() {
  const pathname = usePathname();
  const firstRender = useRef(true);

  useEffect(() => {
    // Browsers only allow audio after a gesture; note the first one.
    function onGesture() {
      unlockAudio();
    }

    function interactive(target: EventTarget | null) {
      const el = (target as Element | null)?.closest?.(INTERACTIVE) ?? null;
      // The speaker toggle announces itself (lib/sound.ts toggleSound).
      return el && !el.closest("[data-sound-toggle]") ? el : null;
    }

    function onOver(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      const el = interactive(event.target);
      if (!el) return;
      // Ignore moves between children of the same control.
      if (event.relatedTarget instanceof Node && el.contains(event.relatedTarget)) return;
      playSound("hover");
    }

    function onClick(event: MouseEvent) {
      if (interactive(event.target)) playSound("click");
    }

    window.addEventListener("pointerdown", onGesture, { capture: true, passive: true });
    window.addEventListener("keydown", onGesture, { capture: true, passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("click", onClick, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture, { capture: true });
      window.removeEventListener("keydown", onGesture, { capture: true });
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("click", onClick);
    };
  }, []);

  // A page change; lib/sound.ts keeps it quiet when a click sound just played.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    playSound("nav");
  }, [pathname]);

  return null;
}
