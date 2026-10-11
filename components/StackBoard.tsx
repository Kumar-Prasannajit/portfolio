"use client";

// Client half of the Stack section (docs/redesign-spec.md phase 6). Tools
// arrive already computed and ranked (lib/stack.ts). This adds the section's
// signature move — it ranks itself: tools enter as a flat, equal-weight row,
// then FLIP into their real sizes and order as the section scrolls into view,
// once, with the "last used" dates scramble-settling as they land. The tiles
// are read-only: clicking a tool no longer filters the Work feed, because the
// site doesn't show every project, so "projects using X" would undercount.
// For the same reason the tiles don't print the project count; it only ranks.
//
// Like About/Reveal, the server HTML is the finished, ranked state. Only after
// mount, and only if the board starts below the fold (and not reduced-motion),
// is it swapped to the flat row — off screen, so unseen — and armed.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import ScrambleText from "./ScrambleText";
import { formatRelativeTime } from "@/lib/format";
import { FOLD } from "@/lib/motion";
import type { StackTool } from "@/lib/stack";

gsap.registerPlugin(Flip);

// "Last used" is relative to the visitor's clock, so it can't be in the
// prerendered HTML without a hydration mismatch. False on the server and
// during hydration, true after.
const subscribeNever = () => () => {};
const useMounted = () =>
  useSyncExternalStore(subscribeNever, () => true, () => false);

export default function StackBoard({
  tools,
  learning,
}: {
  tools: readonly StackTool[];
  learning: readonly string[];
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [flat, setFlat] = useState(false);
  const [counted, setCounted] = useState(false);
  const mounted = useMounted();

  // The flat row's order is deliberately unrelated to rank, so the FLIP
  // visibly re-sorts instead of only resizing.
  const flatOrder = useMemo(
    () => [...tools].sort((a, b) => a.name.localeCompare(b.name)),
    [tools],
  );
  const shown = flat ? flatOrder : tools;

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || board.getBoundingClientRect().top < window.innerHeight * FOLD) {
      // Already visible, or motion is off: no ranking show, just land the dates.
      setCounted(true);
      return;
    }

    setFlat(true);
    let timeline: gsap.core.Timeline | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const state = Flip.getState(board.querySelectorAll("[data-flip-id]"));
        flushSync(() => setFlat(false));
        timeline = Flip.from(state, {
          duration: 0.9,
          ease: "power4.out",
          stagger: 0.05,
        });
        setCounted(true);
      },
      { threshold: 0.35 },
    );
    observer.observe(board);

    return () => {
      observer.disconnect();
      timeline?.kill();
    };
  }, []);

  return (
    <>
      <div className="stack-board" ref={boardRef} role="list" aria-label="Tools, ranked by projects shipped">
        {shown.map((tool) => {
          const last =
            mounted && tool.lastUsed ? formatRelativeTime(tool.lastUsed) : null;
          return (
            <div
              role="listitem"
              key={tool.name}
              data-flip-id={tool.name}
              className="stack-tool"
              // Ranked (weighted, so drawn larger) tiles take a full row on
              // phones; see the max-width: 520px block in globals.css.
              data-ranked={!flat && tool.weight > 0 ? "" : undefined}
              style={{ "--w": flat ? 0 : tool.weight } as React.CSSProperties}
            >
              <span className="sr-only">
                {`${tool.name}${last ? `, last used ${last}` : ""}`}
              </span>
              <span className="stack-tool-name" aria-hidden="true">
                {tool.name}
              </span>
              {/* Only "last used": the project count still ranks the
                  board but isn't shown. A no-break space holds the line
                  until the date is known after mount, so tiles don't jump. */}
              <span className="stack-tool-meta" aria-hidden="true">
                <ScrambleText value={last ? `last used ${last}` : "\u00a0"} active={counted} />
              </span>
            </div>
          );
        })}
      </div>

      {learning.length > 0 ? (
        <div className="stack-learning">
          <span className="stack-label">
            <span className="pulse-dot" aria-hidden="true" /> Learning now
          </span>
          <div className="pill-row">
            {learning.map((name) => (
              <span className="pill" key={name}>
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
