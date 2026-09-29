"use client";

// Client half of the Stack section (docs/redesign-spec.md phase 6). Tools
// arrive already computed and ranked (lib/stack.ts). This adds the section's
// signature move — it ranks itself: tools enter as a flat, equal-weight row,
// then FLIP into their real sizes and order as the section scrolls into view,
// once, with the counts scramble-settling as they land — plus the click that
// filters the Work feed (lib/useStackFilter.ts).
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
import { setStackFilter, useStackFilter } from "@/lib/useStackFilter";

gsap.registerPlugin(Flip);

// "Last used" is relative to the visitor's clock, so it can't be in the
// prerendered HTML without a hydration mismatch. False on the server and
// during hydration, true after.
const subscribeNever = () => () => {};
const useMounted = () =>
  useSyncExternalStore(subscribeNever, () => true, () => false);

const plural = (n: number) => `${n} project${n === 1 ? "" : "s"}`;

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
  const filter = useStackFilter();

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
      // Already visible, or motion is off: no ranking show, just land counts.
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

  const selected = tools.find((t) => t.name === filter);

  return (
    <>
      <div className="stack-board" ref={boardRef} role="group" aria-label="Tools, ranked by projects shipped">
        {shown.map((tool) => {
          const pressed = tool.name === filter;
          const last =
            mounted && tool.lastUsed ? formatRelativeTime(tool.lastUsed) : null;
          return (
            <button
              type="button"
              key={tool.name}
              data-flip-id={tool.name}
              className="stack-tool"
              style={{ "--w": flat ? 0 : tool.weight } as React.CSSProperties}
              aria-pressed={pressed}
              aria-label={`${tool.name}, ${plural(tool.count)}${last ? `, last used ${last}` : ""}`}
              onClick={() => setStackFilter(pressed ? null : tool.name)}
            >
              <span className="stack-tool-name" aria-hidden="true">
                {tool.name}
              </span>
              <span className="stack-tool-meta" aria-hidden="true">
                <ScrambleText value={plural(tool.count)} active={counted} />
                {last ? ` · last used ${last}` : null}
              </span>
            </button>
          );
        })}
      </div>

      <p className="stack-filter-note mono" aria-live="polite">
        {selected ? (
          <>
            Filtering Work by {selected.name} · {plural(selected.count)} ·{" "}
            <a href="#work">jump to Work ↓</a> ·{" "}
            <button type="button" onClick={() => setStackFilter(null)}>
              clear
            </button>
          </>
        ) : (
          "Pick a tool to filter the work below."
        )}
      </p>

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
