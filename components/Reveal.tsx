"use client";

// Scroll-reveal primitives. All timing comes from lib/motion.ts.
//
//   <Reveal>                     one element rises + fades in once
//   <RevealGroup> + <RevealItem> a parent that staggers its children in
//
// Elements start hidden (opacity 0, nudged down) and animate once when ~20%
// is in view. Under prefers-reduced-motion nothing is animated: they are
// simply visible (the CSS rule on [data-reveal] does this even before
// hydration, and `reduce` below makes the components jump straight to the
// shown state afterwards). IntersectionObserver clips by scroll containers,
// so this also works inside the Lenis side panels.

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  REVEAL_TRANSITION,
  VIEWPORT,
  groupVariants,
  revealVariants,
} from "@/lib/motion";

const TAGS = {
  div: motion.div,
  p: motion.p,
  ul: motion.ul,
  li: motion.li,
} as const;

type Tag = keyof typeof TAGS;
type BaseProps = { as?: Tag; className?: string; children: ReactNode };

export function Reveal({
  as = "div",
  className,
  delay = 0,
  children,
}: BaseProps & { delay?: number }) {
  const reduce = useReducedMotion();
  const Component = TAGS[as] as typeof motion.div;
  return (
    <Component
      className={className}
      data-reveal=""
      variants={revealVariants}
      initial="hidden"
      whileInView={reduce ? undefined : "show"}
      animate={reduce ? "show" : undefined}
      viewport={VIEWPORT}
      transition={reduce ? { duration: 0 } : { ...REVEAL_TRANSITION, delay }}
    >
      {children}
    </Component>
  );
}

export function RevealGroup({
  as = "div",
  className,
  stagger,
  delay,
  children,
}: BaseProps & { stagger?: number; delay?: number }) {
  const reduce = useReducedMotion();
  const Component = TAGS[as] as typeof motion.div;
  return (
    <Component
      className={className}
      variants={groupVariants(stagger, delay)}
      initial="hidden"
      whileInView={reduce ? undefined : "show"}
      animate={reduce ? "show" : undefined}
      viewport={VIEWPORT}
    >
      {children}
    </Component>
  );
}

export function RevealItem({ as = "div", className, children }: BaseProps) {
  const reduce = useReducedMotion();
  const Component = TAGS[as] as typeof motion.div;
  return (
    <Component
      className={className}
      data-reveal=""
      variants={revealVariants}
      transition={reduce ? { duration: 0 } : REVEAL_TRANSITION}
    >
      {children}
    </Component>
  );
}
