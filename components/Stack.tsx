import StackBoard from "./StackBoard";
import { LEARNING_NOW, PROJECTS } from "@/lib/data";
import { computeStack, githubRepo } from "@/lib/stack";

// Phase 6 (docs/redesign-spec.md): the stack is computed from PROJECTS — the
// same data the Work cards render — not typed by hand. "Last used" comes from
// each project's GitHub repo (pushed_at, via its Source link); a project with
// no public repo contributes to counts but not dates unless it sets
// `lastWorked` in lib/data.ts. Fetched at build and revalidated hourly, so a
// GitHub outage or rate limit just drops the "last used" segment.

async function pushedAt(repo: string): Promise<string | undefined> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return undefined;
    const json: { pushed_at?: string } = await res.json();
    return json.pushed_at;
  } catch {
    return undefined;
  }
}

export default async function Stack() {
  const dates: Record<string, string | undefined> = {};
  await Promise.all(
    PROJECTS.map(async (project) => {
      const source = project.links.find((l) => githubRepo(l.href));
      const repo = source && githubRepo(source.href);
      if (repo) dates[project.slug] = await pushedAt(repo);
    }),
  );

  return (
    <section className="section band alt" id="stack">
      <div className="wrap">
        <div className="eyebrow">
          <span className="idx">001</span> Stack
        </div>
        <h2 className="h2">Tools I reach for</h2>
        <div style={{ height: 28 }}></div>
        <StackBoard
          tools={computeStack(PROJECTS, dates)}
          learning={LEARNING_NOW}
        />
      </div>
    </section>
  );
}
