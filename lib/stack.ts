// Phase 6: the Stack section is computed from project data, never hand-typed
// (docs/redesign-spec.md section 8). Pure and client-safe — the GitHub fetches
// live in lib/pushedAt.ts and lib/githubActivity.ts, this only aggregates.

import type { Project } from "./data";

export type StackTool = {
  name: string;
  /** Projects that shipped with it. */
  count: number;
  /** Most recent activity for it (ISO), when any is known — see computeStack. */
  lastUsed: string | null;
  /** 0..1, relative to the heaviest tool. Drives rendered size. */
  weight: number;
};

/** Roughly ten, per the spec. */
export const STACK_SIZE = 10;

/** The later of two ISO dates; either may be missing. */
function later(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(b) > Date.parse(a) ? b : a;
}

/**
 * Aggregate `tags` across projects. The board is always the projects' tags:
 * `activity` only adds dates to tools already on it.
 *
 * "Last used" for a tool is the latest of: `activity[tool]` (the owner's
 * newest push to any repo that uses it — lib/githubActivity.ts), and across
 * the projects that list it, `lastWorked` or else `dates[slug]` (that project's
 * Source repo push date). Any of them may be missing; with none, the segment
 * is omitted rather than guessed. A tool that shows up in `activity` but in no
 * project is ignored: the board indexes the Work feed (spec section 8), and an
 * entry reading "0 projects" would contradict it.
 *
 * Ranking: more projects first, then earlier in a project's own tag list (its
 * primary tools), then project order — deterministic. Recency is display-only:
 * ranking by it would sink every tool from a project with no known date (a
 * private repo) below the cut, which is a data gap, not a signal.
 */
export function computeStack(
  projects: readonly Project[],
  dates: Readonly<Record<string, string | undefined>>,
  activity: Readonly<Record<string, string | undefined>> = {},
  size = STACK_SIZE,
): StackTool[] {
  const byName = new Map<
    string,
    { count: number; lastUsed: string | null; tagIndex: number; order: number }
  >();

  projects.forEach((project, order) => {
    const when = project.lastWorked ?? dates[project.slug] ?? null;
    project.tags.forEach((name, tagIndex) => {
      const seen = byName.get(name);
      if (!seen) {
        byName.set(name, { count: 1, lastUsed: when, tagIndex, order });
        return;
      }
      seen.count += 1;
      seen.tagIndex = Math.min(seen.tagIndex, tagIndex);
      seen.lastUsed = later(seen.lastUsed, when);
    });
  });

  const ranked = [...byName.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort(
      (a, b) =>
        b.count - a.count || a.tagIndex - b.tagIndex || a.order - b.order,
    )
    .slice(0, size);

  const max = Math.max(1, ...ranked.map((t) => t.count));
  return ranked.map(({ name, count, lastUsed }) => ({
    name,
    count,
    lastUsed: later(lastUsed, activity[name]),
    weight: max === 1 ? 0 : (count - 1) / (max - 1),
  }));
}

/** "org/repo" from a GitHub URL, or null for anything else. */
export function githubRepo(href: string): string | null {
  const m = href.match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+)/);
  return m ? m[1] : null;
}
