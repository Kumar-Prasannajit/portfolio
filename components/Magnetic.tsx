"use client";

// Magnetic hover for the primary buttons: while the pointer is within a small
// radius of the wrapped element it is pulled slightly toward the pointer, then
// springs back when the pointer moves away or leaves the window.
//
// Only on hover-capable fine pointers ((hover: hover) and (pointer: fine), the
// same test the custom cursor uses) and never under prefers-reduced-motion.
// Those checks live in the effect, so the rendered markup is identical on the
// server and the client. Tuning lives in MAGNET (lib/motion.ts).

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { MAGNET } from "@/lib/motion";

const POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

export default function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, MAGNET.spring);
  const springY = useSpring(y, MAGNET.spring);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      !window.matchMedia(POINTER_QUERY).matches ||
      window.matchMedia(REDUCED_QUERY).matches
    ) {
      return;
    }

    function release() {
      x.set(0);
      y.set(0);
    }

    function onMove(event: PointerEvent) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // The rect includes the current pull; take it back out so the target
      // is measured from where the element rests, not where it has been drawn.
      const cx = rect.left - springX.get() + rect.width / 2;
      const cy = rect.top - springY.get() + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      // Distance from the element's edge (0 while over it), not its centre,
      // so wide buttons pull as readily at their ends as in the middle.
      const edge = Math.hypot(
        Math.max(Math.abs(dx) - rect.width / 2, 0),
        Math.max(Math.abs(dy) - rect.height / 2, 0)
      );
      if (edge > MAGNET.radius) {
        release();
        return;
      }
      const clamp = (v: number) => Math.max(-MAGNET.max, Math.min(MAGNET.max, v));
      x.set(clamp(dx * MAGNET.strength));
      y.set(clamp(dy * MAGNET.strength));
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", release);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", release);
      release();
    };
  }, [x, y, springX, springY]);

  return (
    <motion.span ref={ref} style={{ display: "inline-flex", x: springX, y: springY }}>
      {children}
    </motion.span>
  );
}
