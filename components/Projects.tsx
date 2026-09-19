import ProjectCard from "./ProjectCard";
import { PROJECTS } from "@/lib/data";

export default function Projects() {
  return (
    <section className="section band alt">
      <div className="wrap">
        <div className="proj-heading">
          <div className="eyebrow">
            <span className="idx">04</span> Work
          </div>
          <h2 className="h2">Selected projects</h2>
          <div style={{ height: 28 }}></div>
        </div>
        <div className="proj-grid">
          {PROJECTS.map((project) => (
            <ProjectCard project={project} key={project.title} />
          ))}
        </div>
      </div>
    </section>
  );
}
