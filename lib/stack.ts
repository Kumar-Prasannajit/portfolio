// Phase 6: the Stack section is computed from project data, never hand-typed
// (docs/redesign-spec.md section 8). Pure and client-safe — the GitHub fetch
// lives in components/Stack.tsx, this only aggregates.

import type { Project } from "./data";

export type StackTool = {
  name: string;
  /** Projects that shipped with it. */
  count: number;
  /** Most recent activity across those projects (ISO), when any is known. */
  lastUsed: string | null;
  /** 0..1, relative to the heaviest tool. Drives rendered size. */
  weight: number;
};

/** Roughly ten, per the spec. */
export const STACK_SIZE = 10;

/**
 * Aggregate `tags` across projects. `dates` maps project slug -> ISO date of
 * last activity; a project with no known date still counts, it just can't
 * contribute a "last used" (so that segment is omitted rather than guessed).
 *
 * Ranking: more projects first, then earlier in a project's own tag list (its
 * primary tools), then project order — deterministic. Recency is display-only:
 * ranking by it would sink every tool from a project with no known date (a
 * private repo) below the cut, which is a data gap, not a signal.
 */
export function computeStack(
  projects: readonly Project[],
  dates: Readonly<Record<string, string | undefined>>,
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
      if (when && (!seen.lastUsed || when > seen.lastUsed)) seen.lastUsed = when;
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
    lastUsed,
    weight: max === 1 ? 0 : (count - 1) / (max - 1),
  }));
}

/** "org/repo" from a GitHub URL, or null for anything else. */
export function githubRepo(href: string): string | null {
  const m = href.match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+)/);
  return m ? m[1] : null;
}
