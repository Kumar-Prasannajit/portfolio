import { IconExternalLink } from "./icons";
import { PROJECTS } from "@/lib/data";

export default function Projects() {
  return (
    <section className="section band alt" id="work">
      <div className="wrap">
        <div className="eyebrow">
          <span className="idx">04</span> Work
        </div>
        <h2 className="h2">Selected projects</h2>
        <div style={{ height: 28 }}></div>
        <div className="proj-grid">
          {PROJECTS.map((project) => (
            <div className="card" key={project.title}>
              <div className="card-top">
                <h3>{project.title}</h3>
                <span className="card-badge">{project.badge}</span>
              </div>
              <p>{project.description}</p>
              <div className="card-tags">
                {project.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className="card-links">
                {project.links.map((link) => (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener"
                    key={link.href}
                  >
                    {link.label}
                    <IconExternalLink />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
