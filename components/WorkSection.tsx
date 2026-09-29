import WorkGrid from "./WorkGrid";
import { PROJECTS } from "@/lib/data";
import { projectsToFeed } from "@/lib/feed";
import { pushedAt } from "@/lib/pushedAt";
import { githubRepo } from "@/lib/stack";

// The in-flow "Work" section: the real target of the nav's and ⌘K's /#work.
// (The right-hand ticker is ambient — it loops and can't be scrolled to.)
// Phase 7: an editorial feed (WorkGrid) built from the same data as the Stack
// section, so its tag filter and the Stack tool filter are one control.
export default async function WorkSection() {
  const dates: Record<string, string | undefined> = {};
  await Promise.all(
    PROJECTS.map(async (project) => {
      const source = project.links.find((l) => githubRepo(l.href));
      const repo = source && githubRepo(source.href);
      if (repo) dates[project.slug] = await pushedAt(repo);
    }),
  );

  return (
    <section className="section band alt" id="work">
      <div className="wrap">
        <div className="eyebrow">
          <span className="idx">011</span> Work
        </div>
        <h2 className="h2">Selected projects</h2>
        <div style={{ height: 28 }}></div>
        <WorkGrid items={projectsToFeed(PROJECTS, dates)} />
      </div>
    </section>
  );
}
