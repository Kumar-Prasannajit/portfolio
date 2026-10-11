import StackBoard from "./StackBoard";
import { LEARNING_NOW, PROJECTS } from "@/lib/data";
import { computeStack, githubRepo } from "@/lib/stack";
import { pushedAt } from "@/lib/pushedAt";
import { githubActivity } from "@/lib/githubActivity";

// Phase 6 (docs/redesign-spec.md): the stack is computed from PROJECTS — the
// same data the Work cards render — not typed by hand, so counts and ranking
// come only from the projects. "Last used" is broader: the newest of the owner's
// recent pushes to any GitHub repo that uses the tool (githubActivity), each
// project's own Source-repo push date and its `lastWorked` in lib/data.ts. A
// GitHub outage or rate limit just drops back to whichever of those remain,
// and to no "last used" segment when none do.

export default async function Stack() {
  const dates: Record<string, string | undefined> = {};
  const [activity] = await Promise.all([
    githubActivity(),
    ...PROJECTS.map(async (project) => {
      const source = project.links.find((l) => githubRepo(l.href));
      const repo = source && githubRepo(source.href);
      if (repo) dates[project.slug] = await pushedAt(repo);
    }),
  ]);

  return (
    <section className="section band alt" id="stack">
      <div className="wrap">
        <div className="eyebrow">
          <span className="idx">001</span> Stack
        </div>
        <h2 className="h2">Tools I reach for</h2>
        <div style={{ height: 28 }}></div>
        <StackBoard
          tools={computeStack(PROJECTS, dates, activity)}
          learning={LEARNING_NOW}
        />
      </div>
    </section>
  );
}
