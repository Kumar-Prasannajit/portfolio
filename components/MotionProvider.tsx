"use client";

// App-wide motion config. reducedMotion="user" makes every motion component
// honour the OS prefers-reduced-motion setting (transforms are disabled).
// See lib/motion.ts for the rest of the motion setup.

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";

export default function MotionProvider({ children }: { children: ReactNode }) {
  // Tells the CSS failsafe in globals.css that scripts loaded and hydrated.
  useEffect(() => {
    document.documentElement.dataset.hydrated = "1";
  }, []);
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
