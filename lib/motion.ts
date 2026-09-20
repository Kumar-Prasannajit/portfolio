// The site's one motion vocabulary. Every scroll animation (Reveal.tsx,
// ScrollLayer.tsx) takes its easing, timing and distances from here, so the
// whole page moves the same way and tuning it is a one-file change.
// Library: `motion` (motion/react). Don't mix in a second animation library.
//
// Reduced motion: globals.css force-shows every [data-reveal] element and
// cancels every [data-scroll-layer] transform, so it holds from the first
// frame and never depends on hydration. Reveal.tsx also skips its own
// animation, and MotionProvider sets MotionConfig reducedMotion="user".

import type { Variants } from "motion/react";

type Bezier = [number, number, number, number];

export const EASE = {
  // Fast start, long soft landing: entrances.
  out: [0.22, 1, 0.36, 1] as Bezier,
  inOut: [0.65, 0, 0.35, 1] as Bezier,
};

export const DURATION = {
  fast: 0.3,
  base: 0.6,
  slow: 1.2,
};

// Scroll-reveal: a short rise + fade, once, when ~20% of the element is in view.
export const REVEAL_DISTANCE = 16; // px
export const STAGGER = 0.08; // s between siblings in a group
export const VIEWPORT = { once: true, amount: 0.2 } as const;
export const REVEAL_TRANSITION = { duration: DURATION.base, ease: EASE.out };

export const revealVariants: Variants = {
  hidden: { opacity: 0, y: REVEAL_DISTANCE },
  show: { opacity: 1, y: 0 },
};

export function groupVariants(stagger = STAGGER, delay = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };
}

// Scroll-linked effects (the hero) run over the first this-many px of scroll.
export const PARALLAX_RANGE = 640;
