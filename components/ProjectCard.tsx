"use client";

// One project in the Work list. At rest it is only the landing-page
// screenshot. On hover (or keyboard focus) a dark scrim wipes in over it with
// the project name and a "Click me" button. On touch screens, which have no
// hover, tapping the card toggles that state instead.
//
// The button is a placeholder for now: it will open a details modal (summary,
// tech stack, links — all still in lib/data.ts) once that exists.

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import type { Project } from "@/lib/data";

export default function ProjectCard({ project }: { project: Project }) {
  const [revealed, setRevealed] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // Touch only: the CSS :hover reveal is scoped to hover-capable devices.
  function onClick(event: MouseEvent) {
    if (!window.matchMedia("(hover: none)").matches) return;
    // Taps on the button belong to the button, not the toggle.
    if ((event.target as Element).closest("button")) return;
    setRevealed((value) => !value);
  }

  // Tapping anywhere outside closes it again.
  useEffect(() => {
    if (!revealed) return;
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setRevealed(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [revealed]);

  return (
    <article
      ref={ref}
      className={`pcard${revealed ? " is-revealed" : ""}`}
      onClick={onClick}
    >
      <div className="pcard-media">
        <Image
          src={project.image}
          alt={`${project.title} landing page`}
          width={1200}
          height={900}
          sizes="(min-width: 1024px) 460px, 100vw"
          draggable={false}
        />
      </div>

      <div className="pcard-overlay">
        <h3 className="pcard-name">{project.title}</h3>
        <button type="button" className="pcard-cta">
          Click me
        </button>
      </div>
    </article>
  );
}
