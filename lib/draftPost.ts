// What the Telegram bot knows about a draft PR: its posts, the owner's "Please
// check" list, the cover file and frontmatter edit, and whether it may be merged.
// Pure except `loadDraft`, whose GitHub reads are injected. Imports use
// relative ./x.ts paths so `node --test` and scripts/*.mjs can load it.

import matter from "gray-matter";
import { SITE_URL } from "./site.ts";
import type { GitHubRepo } from "./githubWrite.ts";

export type PostKind = "blog" | "weekly";

export type PostDraft = {
  kind: PostKind;
  path: string;
  slug: string;
  number: string | null; // "009" for a weekly, null for a blog
  title: string;
  summary: string; // a weekly's `summary`, a blog's `excerpt`
  linkedin: string;
};

export type DraftPr = {
  number: number;
  branch: string;
  headSha: string;
  createdAt: string;
  posts: PostDraft[];
  checks: string[]; // the PR body's "Please check" bullets
};

export type PrInfo = {
  number: number;
  state: "open" | "closed";
  merged: boolean;
  labels: string[];
  head: string;
  headSha: string;
  body: string;
  createdAt: string;
  mergeSha: string | null;
};

/** Only labelled `draft-post` PRs from a `draft/*` branch are the bot's to act on. */
export function isDraftPr(pr: Pick<PrInfo, "labels" | "head">): boolean {
  return pr.labels.includes("draft-post") && pr.head.startsWith("draft/");
}

const POST_FILE = /^content\/(blog|weekly)\/[^/]+\.mdx$/;

/** The post files a PR adds or changes, in the order given. */
export function postFiles(changed: { filename: string; status: string }[]): string[] {
  return changed
    .filter((f) => (f.status === "added" || f.status === "modified") && POST_FILE.test(f.filename))
    .map((f) => f.filename);
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

export function postDraft(path: string, source: string): PostDraft {
  const kind: PostKind = path.startsWith("content/blog/") ? "blog" : "weekly";
  const slug = path.slice(path.lastIndexOf("/") + 1).replace(/\.mdx$/, "");
  const { data } = matter(source);
  return {
    kind,
    path,
    slug,
    number: kind === "weekly" ? (/^(\d+)-/.exec(slug)?.[1] ?? null) : null,
    title: text(data.title),
    summary: text(kind === "blog" ? data.excerpt : data.summary),
    linkedin: text(data.linkedin).trim(),
  };
}

/** The bullets under the PR body's `## Please check`; "nothing flagged" is no items. */
export function pleaseCheck(prBody: string): string[] {
  const lines = prBody.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Please check\s*$/i.test(l));
  if (start < 0) return [];
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const bullet = /^-\s+(.*\S)\s*$/.exec(line);
    if (bullet && !/^nothing flagged$/i.test(bullet[1])) items.push(bullet[1]);
  }
  return items;
}

/** Where a post's cover goes in the repo, and the URL the site serves it at. */
export function coverPath(post: PostDraft, ext: "jpg" | "png"): { file: string; url: string } {
  const name = `${post.kind}-${post.slug}.${ext}`;
  return { file: `public/covers/${name}`, url: `/covers/${name}` };
}

/**
 * Sets `coverImage` in the frontmatter: replaces a column-0 `coverImage:` line,
 * else appends one as the last frontmatter line. Every other byte is untouched.
 */
export function withCoverImage(source: string, url: string): string {
  const open = /^---\r?\n/.exec(source);
  if (!open) throw new Error("post has no frontmatter");
  const start = open[0].length;
  const close = /\r?\n---[ \t]*(?:\r?\n|$)/.exec(source.slice(start));
  if (!close) throw new Error("post frontmatter is not closed");
  const nl = open[0].endsWith("\r\n") ? "\r\n" : "\n";
  const lines = source.slice(start, start + close.index).split(nl);
  const line = `coverImage: ${JSON.stringify(url)}`;
  const at = lines.findIndex((l) => l.startsWith("coverImage:"));
  if (at >= 0) lines[at] = line;
  else lines.push(line);
  return source.slice(0, start) + lines.join(nl) + source.slice(start + close.index);
}

/** Both the content check and the Vercel preview must be present and green. */
export function requiredChecksGreen(
  runs: { name: string; conclusion: string | null }[],
  statuses: { context: string; state: string }[],
): boolean {
  return (
    runs.some((r) => r.name === "check" && r.conclusion === "success") &&
    statuses.some((s) => s.context === "Vercel" && s.state === "success")
  );
}

/** Commits the bot (`Cover for #n`) and the edit routine (`Edit #n: …`) make. */
export function isBotCommit(message: string): boolean {
  return /^(Cover for|Edit) #\d+/.test(message);
}

export function postUrl(post: PostDraft): string {
  return `${SITE_URL}/${post.kind}/${post.slug}`;
}

/** The draft behind PR `n`, or null when that PR is not one of the bot's. */
export async function loadDraft(
  gh: Pick<GitHubRepo, "getPr" | "prFiles" | "fileAt">,
  n: number,
  ref?: string,
): Promise<{ pr: PrInfo; draft: DraftPr } | null> {
  const pr = await gh.getPr(n);
  if (!isDraftPr(pr)) return null;
  const paths = postFiles(await gh.prFiles(n));
  const posts = await Promise.all(
    paths.map(async (path) => postDraft(path, await gh.fileAt(path, ref ?? pr.headSha))),
  );
  return {
    pr,
    draft: {
      number: pr.number,
      branch: pr.head,
      headSha: pr.headSha,
      createdAt: pr.createdAt,
      posts,
      checks: pleaseCheck(pr.body),
    },
  };
}
