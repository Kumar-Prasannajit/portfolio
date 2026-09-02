import { projects } from "@/lib/data";
import SectionHeading from "@/components/SectionHeading";

export default function Projects() {
  return (
    <section id="projects" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <SectionHeading eyebrow="BUILT & SHIPPED" title="Projects" />

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {projects.map((project) => (
          <article
            key={project.title}
            className="flex flex-col rounded-xl border border-panel-line bg-panel p-6"
          >
            <h3 className="font-display text-lg font-bold text-paper">
              {project.title}
            </h3>
            <p className="mt-2 flex-1 font-body text-sm leading-relaxed text-muted">
              {project.description}
            </p>

            <ul className="mt-4 flex flex-wrap gap-2">
              {project.stackTags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-panel-line bg-violet-deep/60 px-2.5 py-1 font-body text-xs text-muted"
                >
                  {tag}
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap gap-4">
              {project.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="font-body text-sm font-semibold text-ember underline decoration-transparent underline-offset-4 transition-colors hover:decoration-ember"
                >
                  {link.label} →
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
