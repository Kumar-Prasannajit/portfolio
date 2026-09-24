import ProjectCard from "./ProjectCard";
import { PROJECTS } from "@/lib/data";

// Ambient project rail for the right panel (looped by HomeShell). The real
// "Work" section, with the #work anchor, is WorkSection in the main column.
// `decorative` marks a copy that only exists to make the loop seamless: its
// links are skipped by the keyboard.
export default function Projects({ decorative = false }: { decorative?: boolean }) {
  return (
    <section className="section band alt">
      <div className="wrap">
        <div className="proj-grid">
          {PROJECTS.map((project) => (
            <ProjectCard
              project={project}
              key={project.slug}
              decorative={decorative}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
