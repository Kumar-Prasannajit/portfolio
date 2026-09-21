import Link from "next/link";
import { PROJECTS } from "@/lib/data";

// The in-flow "Work" section: the real target of the nav's and ⌘K's /#work.
// (The right-hand ticker is ambient — it loops and can't be scrolled to.)
// Each card is one stretched link to that project's /work/[slug] page.
export default function WorkSection() {
  return (
    <section className="section band alt" id="work">
      <div className="wrap">
        <div className="eyebrow">
          <span className="idx">011</span> Work
        </div>
        <h2 className="h2">Selected projects</h2>
        <div style={{ height: 28 }}></div>
        <div className="work-grid">
          {PROJECTS.map((project) => (
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
      </div>
    </section>
  );
}
