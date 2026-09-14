// Filesystem-backed content pipeline for the blog and weekly devlog.
//
// Posts/entries are plain MDX files with YAML frontmatter under
// content/blog and content/weekly — not compiled into routes by
// @next/mdx, deliberately. Reading them as data (via gray-matter) lets
// the index pages enumerate, search, tag-filter and paginate across
// every post server-side without importing/compiling each one as a
// page. The MDX body itself is only compiled (via next-mdx-remote/rsc)
// on the individual [slug] page that actually renders it.
//
// Server-only: uses `fs`, so this module must never be imported from a
// "use client" component.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

// Date formatting lives in lib/format.ts, not here — that file has zero
// server-only imports, so both server pages and client components can
// safely import it. Importing anything from *this* file (even a single
// named export) from a client component pulls its `node:fs` import
// along into the client bundle, which Turbopack can't resolve.

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const WEEKLY_DIR = path.join(process.cwd(), "content", "weekly");

const WORDS_PER_MINUTE = 200;

function readTimeFor(bodyText: string) {
  const words = bodyText.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return { wordCount: words, readTimeMinutes: minutes };
}

// Strips the most common MDX/Markdown syntax down to plain words, so
// client-side search isn't matching against "##", "```", "[", etc.
// Intentionally simple — good enough for substring search, not a real
// markdown-to-text renderer.
function toPlainText(mdxBody: string) {
  return mdxBody
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> link text
    .replace(/<[^>]+>/g, " ") // JSX/HTML tags
    .replace(/^import .*$/gm, " ") // MDX import lines
    .replace(/^export .*$/gm, " ") // MDX export lines
    .replace(/[#>*_~-]/g, " ") // remaining markdown punctuation
    .replace(/\s+/g, " ")
    .trim();
}

function slugFromFilename(filename: string) {
  return filename.replace(/\.mdx?$/, "");
}

function listContentFiles(dir: string) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".mdx") || name.endsWith(".md"));
}

function sortByDateDesc<T extends { frontmatter: { date: string } }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.frontmatter.date).getTime() -
      new Date(a.frontmatter.date).getTime()
  );
}

/* ------------------------------- Blog ------------------------------- */

export type BlogFrontmatter = {
  title: string;
  date: string; // ISO yyyy-mm-dd
  tags: string[];
  excerpt: string;
};

export type BlogPostSummary = {
  slug: string;
  frontmatter: BlogFrontmatter;
  readTimeMinutes: number;
  wordCount: number;
  searchText: string;
};

export type BlogPost = BlogPostSummary & {
  content: string; // raw MDX body, frontmatter stripped
};

function loadBlogPost(filename: string): BlogPost {
  const slug = slugFromFilename(filename);
  const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf8");
  const { data, content } = matter(raw);
  const frontmatter = data as BlogFrontmatter;
  const plain = toPlainText(content);
  const { wordCount, readTimeMinutes } = readTimeFor(plain);
  const searchText = [
    frontmatter.title,
    frontmatter.excerpt,
    (frontmatter.tags ?? []).join(" "),
    plain,
  ]
    .join(" ")
    .toLowerCase();

  return { slug, frontmatter, content, wordCount, readTimeMinutes, searchText };
}

function toBlogSummary(post: BlogPost): BlogPostSummary {
  const { slug, frontmatter, readTimeMinutes, wordCount, searchText } = post;
  return { slug, frontmatter, readTimeMinutes, wordCount, searchText };
}

export function getAllBlogPosts(): BlogPostSummary[] {
  const posts = listContentFiles(BLOG_DIR)
    .map(loadBlogPost)
    .map(toBlogSummary);
  return sortByDateDesc(posts);
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  const file = listContentFiles(BLOG_DIR).find(
    (name) => slugFromFilename(name) === slug
  );
  return file ? loadBlogPost(file) : null;
}

export function getAllBlogSlugs(): string[] {
  return listContentFiles(BLOG_DIR).map(slugFromFilename);
}

export function getAllBlogTags(): string[] {
  const tags = new Set<string>();
  for (const post of getAllBlogPosts()) {
    for (const tag of post.frontmatter.tags ?? []) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

/* ------------------------------ Weekly ------------------------------ */

export type WeeklyFrontmatter = {
  title: string;
  date: string;
  summary: string;
  cover?: string; // optional short label the CSS-drawn placeholder cover displays
};

export type WeeklyEntrySummary = {
  slug: string;
  number: number; // sequential in authorship order, oldest = #001
  frontmatter: WeeklyFrontmatter;
  readTimeMinutes: number;
  wordCount: number;
};

export type WeeklyEntry = WeeklyEntrySummary & {
  content: string;
};

function loadWeeklyEntry(filename: string): Omit<WeeklyEntry, "number"> {
  const slug = slugFromFilename(filename);
  const raw = fs.readFileSync(path.join(WEEKLY_DIR, filename), "utf8");
  const { data, content } = matter(raw);
  const frontmatter = data as WeeklyFrontmatter;
  const { wordCount, readTimeMinutes } = readTimeFor(toPlainText(content));
  return { slug, frontmatter, content, wordCount, readTimeMinutes };
}

// Assigns sequential devlog numbers in chronological (authorship) order —
// #001 is the oldest entry, and the newest entry always has the highest
// number — independent of whatever order the input array is in.
function withSequentialNumbers<T extends { frontmatter: { date: string } }>(
  entries: T[]
): (T & { number: number })[] {
  const chronological = [...entries].sort(
    (a, b) =>
      new Date(a.frontmatter.date).getTime() -
      new Date(b.frontmatter.date).getTime()
  );
  const numberOf = new Map(chronological.map((entry, i) => [entry, i + 1]));
  return entries.map((entry) => ({ ...entry, number: numberOf.get(entry)! }));
}

function toWeeklySummary(entry: WeeklyEntry): WeeklyEntrySummary {
  const { slug, number, frontmatter, readTimeMinutes, wordCount } = entry;
  return { slug, number, frontmatter, readTimeMinutes, wordCount };
}

export function getAllWeeklyEntries(): WeeklyEntrySummary[] {
  const entries = withSequentialNumbers(
    listContentFiles(WEEKLY_DIR).map(loadWeeklyEntry)
  ).map(toWeeklySummary);
  return sortByDateDesc(entries);
}

export function getWeeklyEntryBySlug(slug: string): WeeklyEntry | null {
  // Numbers are only stable when computed across every entry, so this
  // still has to load the whole directory even though only one slug's
  // full content is returned.
  const numbered = withSequentialNumbers(
    listContentFiles(WEEKLY_DIR).map(loadWeeklyEntry)
  );
  return numbered.find((entry) => entry.slug === slug) ?? null;
}

export function getAllWeeklySlugs(): string[] {
  return listContentFiles(WEEKLY_DIR).map(slugFromFilename);
}

/* -------------------------- Command palette -------------------------- */

// Lightweight index (title/href/tags only — no post bodies) for the
// command palette's "Blog posts" and "Weekly" groups. Built server-side
// (this whole module is fs-based) and passed down as plain serializable
// props from the root layout to the client CommandPalette component.
export type CommandIndexItem = {
  title: string;
  href: string;
  group: "blog" | "weekly";
  keywords: string[];
};

export function getCommandIndex(): CommandIndexItem[] {
  const posts = getAllBlogPosts().map((post) => ({
    title: post.frontmatter.title,
    href: `/blog/${post.slug}`,
    group: "blog" as const,
    keywords: post.frontmatter.tags ?? [],
  }));
  const weekly = getAllWeeklyEntries().map((entry) => ({
    title: `#${String(entry.number).padStart(3, "0")} — ${entry.frontmatter.title}`,
    href: `/weekly/${entry.slug}`,
    group: "weekly" as const,
    keywords: [] as string[],
  }));
  return [...posts, ...weekly];
}
