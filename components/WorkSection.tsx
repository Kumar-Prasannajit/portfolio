import WorkGrid from "./WorkGrid";
import { PROJECTS } from "@/lib/data";

// The in-flow "Work" section: the real target of the nav's and ⌘K's /#work.
// (The right-hand ticker is ambient — it loops and can't be scrolled to.)
// Cards live in WorkGrid so the Stack section's tool filter can narrow them.
export default function WorkSection() {
  return (
    <section className="section band alt" id="work">
      <div className="wrap">
        <div className="eyebrow">
          <span className="idx">011</span> Work
        </div>
        <h2 className="h2">Selected projects</h2>
        <div style={{ height: 28 }}></div>
        <WorkGrid
          projects={PROJECTS.map(({ slug, title, badge, summary, tags }) => ({
            slug,
            title,
            badge,
            summary,
            tags,
          }))}
        />
      </div>
    </section>
  );
}
