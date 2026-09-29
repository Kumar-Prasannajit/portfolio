"use client";

// The Work section's cards, narrowed by the Stack section's selected tool
// (lib/useStackFilter.ts). Card markup is unchanged from before phase 6;
// phase 7 replaces this grid with the editorial feed and keeps the same hook.

import Link from "next/link";
import { setStackFilter, useStackFilter } from "@/lib/useStackFilter";

type Card = {
  slug: string;
  title: string;
  badge: string;
  summary: string;
  tags: readonly string[];
};

export default function WorkGrid({ projects }: { projects: readonly Card[] }) {
  const filter = useStackFilter();
  const shown = filter ? projects.filter((p) => p.tags.includes(filter)) : projects;

  return (
    <>
      {filter ? (
        <p className="stack-filter-note mono" aria-live="polite">
          Showing {shown.length} of {projects.length} projects using {filter} ·{" "}
          <button type="button" onClick={() => setStackFilter(null)}>
            show all
          </button>
        </p>
      ) : null}
      <div className="work-grid">
        {shown.map((project) => (
          <article className="card work-card" key={project.slug}>
            <div className="card-top">
              <h3>{project.title}</h3>
              <span className="tag">{project.badge}</span>
            </div>
            <p>{project.summary}</p>
            <div className="card-tags">
              {project.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
            <Link
              href={`/work/${project.slug}`}
              className="work-card-link"
              data-cursor="View"
              aria-label={`${project.title}: view project`}
            >
              View project <span aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
