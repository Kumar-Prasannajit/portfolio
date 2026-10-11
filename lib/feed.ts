// Phase 7: the Work feed's item model (docs/redesign-spec.md section 9). It is
// a discriminated union so blog / weekly / gallery entries can join later
// without touching the grid; today it ships with projects only (open decision
// 1: feed scope stays projects-only, since a unified feed would change the
// protected nav).

import type { Project } from "./data";

type FeedBase = {
  id: string;
  href: string;
  title: string;
  summary: string;
  tags: readonly string[];
  /** ISO date, only when a real one is known. Never invented. */
  date: string | null;
  image: string | null;
  alt: string;
};

export type FeedItem =
  | (FeedBase & { kind: "project"; badge: string })
  | (FeedBase & { kind: "blog" })
  | (FeedBase & { kind: "weekly" })
  | (FeedBase & { kind: "gallery" });

export type FeedFrame = "fill" | "outline" | "invert";

/** Card footprint in the three-column grid. */
export type FeedSize = "wide" | "tall" | "small";

// Rhythm, cycled by position. Frames vary the treatment, never the hue.
const SIZES: readonly FeedSize[] = ["wide", "tall", "small", "small", "wide"];
const FRAMES: readonly FeedFrame[] = ["fill", "outline", "invert"];

export const sizeAt = (i: number): FeedSize => SIZES[i % SIZES.length];
export const frameAt = (i: number): FeedFrame => FRAMES[i % FRAMES.length];

export function projectsToFeed(
  projects: readonly Project[],
  dates: Readonly<Record<string, string | undefined>> = {},
): FeedItem[] {
  return projects.map((p) => ({
    kind: "project" as const,
    id: p.slug,
    href: `/work/${p.slug}`,
    title: p.title,
    summary: p.summary,
    tags: p.tags,
    badge: p.badge,
    date: p.lastWorked ?? dates[p.slug] ?? null,
    image: p.image,
    alt: `${p.title} landing page`,
  }));
}

/** Tag -> item count, most used first; the same tags the Stack section counts. */
export function tagCounts(items: readonly FeedItem[]): [string, number][] {
  const counts = new Map<string, number>();
  items.forEach((item) =>
    item.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)),
  );
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
