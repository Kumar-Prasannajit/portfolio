"use client";

// App-wide motion config. reducedMotion="user" makes every motion component
// honour the OS prefers-reduced-motion setting (transforms are disabled).
// See lib/motion.ts for the rest of the motion setup.

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
