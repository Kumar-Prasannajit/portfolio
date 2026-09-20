"use client";

// A wrapper that moves / scales with the page scroll: the hero uses it for
// the name (slower than the page, easing smaller) and the line decoration
// behind it (drifts and grows). Both run over the first PARALLAX_RANGE px of
// scroll. Under prefers-reduced-motion a CSS rule on [data-scroll-layer]
// cancels the transform. That is done in CSS rather than by branching on
// useReducedMotion(): the hook is false on the server and true on the
// client's first render, which would change the style attribute and fail
// hydration.
//
// useScroll() tracks the window, which is what the home page's main column
// scrolls (see HomeShell's page-level Lenis).

import type { ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { PARALLAX_RANGE } from "@/lib/motion";

type Props = {
  as?: "div" | "h1";
  className?: string;
  /** [from, to] translateY in px over the scroll range. */
  y?: [number, number];
  /** [from, to] scale over the scroll range. */
  scale?: [number, number];
  origin?: string;
  "aria-hidden"?: boolean;
  children: ReactNode;
};

export default function ScrollLayer({
  as = "div",
  className,
  y = [0, 0],
  scale = [1, 1],
  origin,
  children,
  ...rest
}: Props) {
  const { scrollY } = useScroll();
  const yValue = useTransform(scrollY, [0, PARALLAX_RANGE], y);
  const scaleValue = useTransform(scrollY, [0, PARALLAX_RANGE], scale);
  const Component = as === "h1" ? motion.h1 : motion.div;
  return (
    <Component
      className={className}
      data-scroll-layer=""
      style={{ y: yValue, scale: scaleValue, transformOrigin: origin }}
      {...rest}
    >
      {children}
    </Component>
  );
}
