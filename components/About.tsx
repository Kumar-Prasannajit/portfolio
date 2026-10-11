"use client";

// About (docs/redesign-spec.md phase 5): two short paragraphs in one wide
// column, no whoami card (rail 1 and rail 3 own that state now). A few words
// are live variables bound to data — role, company and city come from
// EXPERIENCE, the closing line from the AniList "currently watching" feed the
// rail-3 Stats block already uses. That is the section's whole animation
// budget: on scroll the lines rise through a mask (GSAP SplitText, the spec's
// masked-line-rise effect) and the variable words land with scramble-settle.
//
// Like Reveal.tsx, everything is visible in the server HTML and with scripts
// off. Only after mount, and only if the copy starts below the fold, is it
// hidden and armed to rise when scrolled into view.
//
// Two constraints shape the code below:
//  - SplitText moves DOM nodes into line wrappers, so React must not swap
//    elements inside a split paragraph afterwards. The "watching" line is
//    therefore frozen to the first response (or a fallback if none arrives),
//    and the split is only built once that structure is settled. Later polls
//    still refresh rail 3; they just never restructure this copy.
//  - Variable words are `.about-var` and passed to SplitText as `ignore`, so a
//    line break can never slice one in half.

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import ScrambleText from "./ScrambleText";
import { EXPERIENCE } from "@/lib/data";
import { FOLD, STAGGER } from "@/lib/motion";
import { useRailStats } from "@/lib/useRailStats";
import type { WatchingStat } from "@/app/api/rail-stats/route";

gsap.registerPlugin(SplitText);

const CURRENT = EXPERIENCE[0];
const PREVIOUS = EXPERIENCE[1];

// "Aideas Tech Solutions Pvt. Ltd." reads as paperwork in a sentence.
const company = (org: string) => org.replace(/\s+Pvt\.?\s+Ltd\.?$/i, "");
const city = (location: string) => location.split(",")[0];

const MAX_TITLE = 32;
// How long to wait for the stats response before settling on the fallback
// line, so a failed request can't leave the reveal waiting forever.
const STATS_WAIT_MS = 2500;

// A live word. The visible glyphs cycle while they settle, so they are hidden
// from assistive tech; the real value is exposed once, in the sr-only copy.
function Live({ value, active }: { value: string; active: boolean }) {
  return (
    <span className="about-var mono">
      <span className="about-var-sr">{value}</span>
      <ScrambleText value={value} active={active} />
    </span>
  );
}

function progressLabel(watching: Extract<WatchingStat, { status: "ok" }>) {
  const { progress, episodes } = watching;
  return episodes ? `EP ${progress} / ${episodes}` : `EP ${progress}`;
}

function truncate(title: string) {
  return title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1)}…` : title;
}

export default function About() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stats = useRailStats();
  const [watching, setWatching] = useState<WatchingStat | null>(null);
  const [active, setActive] = useState(false);

  // Freeze the watching line to the first answer (see header note).
  if (!watching && stats) setWatching(stats.watching);
  useEffect(() => {
    if (watching) return;
    const timer = setTimeout(() => setWatching({ status: "error" }), STATS_WAIT_MS);
    return () => clearTimeout(timer);
  }, [watching]);

  // Build the masked reveal once the copy's structure is final.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !watching) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Already on screen at load, or reduced motion: leave the copy alone and
    // just let the live words settle.
    if (reduced || root.getBoundingClientRect().top < window.innerHeight * FOLD) {
      setActive(true);
      return;
    }

    let revealed = false;
    let split: SplitText | undefined;
    let observer: IntersectionObserver | undefined;
    let cancelled = false;

    // Line breaks depend on the webfont's metrics, so wait for it.
    document.fonts.ready.then(() => {
      if (cancelled) return;
      split = SplitText.create(root.querySelectorAll("[data-split]"), {
        type: "lines",
        mask: "lines",
        aria: "none", // the paragraphs' own text stays the accessible name
        ignore: ".about-var",
        autoSplit: true, // re-split on resize / late font swap
        onSplit(self) {
          // A re-split after the reveal must not hide the copy again.
          if (!revealed) gsap.set(self.lines, { yPercent: 110 });
        },
      });

      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer?.disconnect();
          revealed = true;
          gsap.to(split!.lines, {
            yPercent: 0,
            duration: 0.9,
            ease: "power4.out",
            stagger: STAGGER,
            onComplete: () => split?.revert(),
          });
          setActive(true);
        },
        { threshold: 0.2 },
      );
      observer.observe(root);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (split) {
        gsap.killTweensOf(split.lines);
        split.revert();
      }
    };
  }, [watching]);

  const live = watching?.status === "ok" ? watching : null;

  return (
    <section className="section band" id="about">
      <div className="wrap">
        <div className="eyebrow">
          <span className="idx">000</span> About
        </div>
        <div className="about-copy" ref={rootRef}>
          <p data-split>
            I&apos;m a full stack developer who&apos;d rather be in the backend.
            Right now I&apos;m a <Live value={CURRENT.role} active={active} /> at{" "}
            <Live value={company(CURRENT.org)} active={active} /> in{" "}
            <Live value={city(CURRENT.location)} active={active} />, wiring
            React to APIs and making sure the pages don&apos;t crawl.
          </p>
          <p data-split>
            Before that I interned at <strong>{company(PREVIOUS.org)}</strong>,
            where I shipped three web apps and talked a five-person team into a
            Git workflow that didn&apos;t hurt. My degree is in electronics, from{" "}
            <strong>GIET University</strong>, so yes, I got here sideways.{" "}
            {live ? (
              <>
                Lately I&apos;m watching{" "}
                <Live value={truncate(live.title)} active={active} />,{" "}
                <Live value={progressLabel(live)} active={active} />.
              </>
            ) : (
              <>When I&apos;m not shipping, it&apos;s DSA problems in JavaScript.</>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
