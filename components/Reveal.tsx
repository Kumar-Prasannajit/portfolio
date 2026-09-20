"use client";

// Scroll-reveal primitives. All timing comes from lib/motion.ts.
//
//   <Reveal>                     one element rises + fades in once
//   <RevealGroup> + <RevealItem> a parent that staggers its children in
//
// Everything is VISIBLE in the server HTML and stays visible if scripts never
// load. After mount, an element that starts below the fold is "armed": hidden
// instantly (off screen, so unseen) and animated in when ~20% of it scrolls
// into view. Anything already on screen at load, and everything under
// prefers-reduced-motion, is left alone. That keeps above-the-fold text in the
// first paint instead of waiting for hydration.
// IntersectionObserver clips by scroll containers, so this also works inside
// the Lenis side panels.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { FOLD, VIEWPORT, groupVariants, itemVariants } from "@/lib/motion";

const TAGS = {
  div: motion.div,
  p: motion.p,
  ul: motion.ul,
  li: motion.li,
} as const;

type Tag = keyof typeof TAGS;
type BaseProps = { as?: Tag; className?: string; children: ReactNode };
// For a scrollable item (e.g. the contribution graph) that must be keyboard-focusable.
type A11yProps = { tabIndex?: number; role?: string; "aria-label"?: string };

// Returns the ref to attach and the variant to animate to: undefined (leave the
// element alone) until armed, then "hidden" until it scrolls into view.
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [armed, setArmed] = useState(false);
  const inView = useInView(ref, VIEWPORT);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight * FOLD) {
      // Needs the element's position, which only exists in the browser.
      setArmed(true);
    }
  }, [reduce]);

  return { ref, animate: armed ? (inView ? "show" : "hidden") : undefined };
}

export function Reveal({
  as = "div",
  className,
  delay = 0,
  children,
}: BaseProps & { delay?: number }) {
  const { ref, animate } = useReveal();
  const Component = TAGS[as] as typeof motion.div;
  return (
    <Component
      ref={ref}
      className={className}
      data-reveal=""
      variants={itemVariants(delay)}
      animate={animate}
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
  const { ref, animate } = useReveal();
  const Component = TAGS[as] as typeof motion.div;
  return (
    <Component
      ref={ref}
      className={className}
      variants={groupVariants(stagger, delay)}
      animate={animate}
    >
      {children}
    </Component>
  );
}

// Takes its state from the enclosing RevealGroup via variant propagation.
export function RevealItem({
  as = "div",
  className,
  children,
  ...a11y
}: BaseProps & A11yProps) {
  const Component = TAGS[as] as typeof motion.div;
  return (
    <Component className={className} data-reveal="" variants={itemVariants()} {...a11y}>
      {children}
    </Component>
  );
}
