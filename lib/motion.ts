// The site's one motion vocabulary. Every scroll animation (Reveal.tsx,
// ScrollLayer.tsx, Magnetic.tsx) takes its easing, timing and distances from
// here, so the whole page moves the same way and tuning it is a one-file change.
// Library: `motion` (motion/react). Don't mix in a second animation library.
//
// Reveals never hide content in the server HTML: everything renders visible,
// and after mount only elements that start below the fold are hidden and then
// revealed as they scroll in (see Reveal.tsx). That keeps above-the-fold text
// in the first paint (it used to be opacity 0 until hydration, which delayed
// the largest contentful paint).
//
// Reduced motion: Reveal never arms under prefers-reduced-motion (content just
// stays visible), globals.css cancels every [data-scroll-layer] transform, and
// MotionProvider sets MotionConfig reducedMotion="user".

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

// An element only takes part in the reveal if its top starts below this
// fraction of the viewport height when the page loads.
export const FOLD = 0.95;

// `hidden` applies instantly (it is only ever set on something off screen).
// A `delay` key is only set when one is asked for: even `delay: 0` would
// override the per-child delay a parent's staggerChildren computes.
export function itemVariants(delay = 0): Variants {
  return {
    hidden: { opacity: 0, y: REVEAL_DISTANCE, transition: { duration: 0 } },
    show: {
      opacity: 1,
      y: 0,
      transition: delay ? { ...REVEAL_TRANSITION, delay } : REVEAL_TRANSITION,
    },
  };
}

export function groupVariants(stagger = STAGGER, delay = 0): Variants {
  return {
    hidden: { transition: { duration: 0 } },
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };
}

// Scroll-linked effects (the hero) run over the first this-many px of scroll.
export const PARALLAX_RANGE = 640;

// Magnetic buttons (components/Magnetic.tsx): pull toward the pointer within
// `radius` px of the element's edge, by `strength` of the pointer's offset,
// capped at `max` px; a spring returns it to rest.
export const MAGNET = {
  radius: 40,
  strength: 0.28,
  max: 9,
  spring: { stiffness: 220, damping: 18, mass: 0.6 },
};
