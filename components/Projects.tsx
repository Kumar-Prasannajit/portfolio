import ProjectCard from "./ProjectCard";
import { PROJECTS } from "@/lib/data";

// Ambient project rail for the right panel (looped by HomeShell). The real
// "Work" section, with the #work anchor, is WorkSection in the main column.
export default function Projects() {
  return (
    <section className="section band alt">
      <div className="wrap">
        <div className="proj-grid">
          {PROJECTS.map((project) => (
            <ProjectCard project={project} key={project.slug} />
          ))}
        </div>
      </div>
    </section>
  );
}
