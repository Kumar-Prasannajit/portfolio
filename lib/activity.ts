// Pure half of the post-drafting automation (scripts/collect-activity.mjs does
// the GitHub I/O): IST dates and activity windows, commit filtering and
// mapping, the next weekly number, and the blog idea backlog. No imports and no
// I/O, so it runs under `node --test` as well as from the scripts. The
// allowlist is passed in rather than imported, to keep it that way.

export type Commit = {
  repo: string;
  sha: string; // first 7 characters
  date: string; // ISO timestamp of the commit
  message: string; // first line only
  url: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseDate(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/* -------------------------------- Dates -------------------------------- */

/** The YYYY-MM-DD calendar date of `now` in Asia/Kolkata. */
export function istDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

/** 00:00 IST of `date` as a UTC ISO string. */
export function istMidnightIso(date: string): string {
  return new Date(parseDate(date) - IST_OFFSET_MS).toISOString();
}

/** Calendar-day arithmetic on YYYY-MM-DD; `days` may be negative. */
export function addDays(date: string, days: number): string {
  return new Date(parseDate(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Where a weekly run's window starts: the newest entry's date, inclusive, so
 * work done later that same day isn't lost. A week back when there are no entries.
 */
export function weeklySince(entryDates: string[], runDate: string): string {
  if (entryDates.length === 0) return addDays(runDate, -7);
  return entryDates.reduce((a, b) => (b > a ? b : a));
}

/**
 * A weekly window split into one post per Monday-Sunday (IST) week. Each chunk
 * ends on its Sunday, or on `runDate` for a partial last week, and that end is
 * the post's date. When `since` is a Sunday it is the previous entry's own
 * date, so it joins the following week instead of becoming a one-day post.
 */
export function weeklyChunks(since: string, runDate: string): { start: string; end: string }[] {
  const weekday = (date: string) => new Date(parseDate(date)).getUTCDay(); // 0 = Sunday
  const chunks: { start: string; end: string }[] = [];
  let start = since;
  while (start <= runDate) {
    const sunday = addDays(start, (7 - weekday(start)) % 7);
    const end = sunday < runDate ? sunday : runDate;
    chunks.push({ start, end });
    start = addDays(end, 1);
  }
  if (chunks.length > 1 && weekday(since) === 0) {
    chunks.splice(0, 2, { start: since, end: chunks[1].end });
  }
  return chunks;
}

/** The blog run's fallback window, used only when no idea is waiting. */
export function blogSince(runDate: string): string {
  return addDays(runDate, -14);
}

/** Whether a weekly entry already carries today's (IST) date. */
export function alreadyPostedToday(entryDates: string[], runDate: string): boolean {
  return entryDates.includes(runDate);
}

/* ------------------------------- Commits ------------------------------- */

/**
 * GitHub's commit list for one repo -> Commits. Drops anything that isn't an
 * object, merge commits, and commits by anyone but `author` (case-insensitive).
 * Everything is dropped when `allow(repo)` is false, so the allowlist is
 * enforced here as well as where repos are listed. Never throws: an error
 * body ({ message }) yields [].
 */
export function toCommits(
  raw: unknown,
  repo: string,
  author: string,
  allow: (fullName: string) => boolean,
): Commit[] {
  if (!Array.isArray(raw) || !allow(repo)) return [];
  const commits: Commit[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (Array.isArray(item.parents) && item.parents.length > 1) continue;
    const login = isRecord(item.author) ? item.author.login : undefined;
    if (typeof login !== "string" || login.toLowerCase() !== author.toLowerCase()) continue;
    const commit = isRecord(item.commit) ? item.commit : undefined;
    const message = commit?.message;
    const date = isRecord(commit?.author) ? commit.author.date : undefined;
    if (
      typeof item.sha !== "string" ||
      typeof item.html_url !== "string" ||
      typeof message !== "string" ||
      typeof date !== "string"
    ) {
      continue;
    }
    commits.push({
      repo,
      sha: item.sha.slice(0, 7),
      date,
      message: message.split(/\r?\n/)[0],
      url: item.html_url,
    });
  }
  return commits;
}

/** A full page means the API may have more commits than the one page we read. */
export function pageWarning(repo: string, count: number, perPage: number): string | null {
  return count >= perPage ? `${repo}: ${count} commits, results may be truncated` : null;
}

/* ------------------------------ Weekly files ----------------------------- */

/** The next `NNN` after the highest `NNN-` filename prefix, zero-padded. */
export function nextWeeklyNumber(filenames: string[]): string {
  let highest = 0;
  for (const name of filenames) {
    const match = /^(\d+)-/.exec(name);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return String(highest + 1).padStart(3, "0");
}

/** A weekly entry's `cover` label: its number in two digits, like the existing "01" to "03". */
export function coverLabel(number: string): string {
  return String(Number(number)).padStart(2, "0");
}

/* --------------------------------- Ideas --------------------------------- */

const UNTICKED = /^\s*-\s*\[ \]\s*(\S.*?)\s*$/;

/**
 * The first unticked `- [ ]` line of content/ideas.md. `index` is its 0-based
 * line number; text after the first `—` is the user's notes.
 */
export function pickIdea(
  markdown: string,
): { index: number; topic: string; notes: string } | null {
  const lines = markdown.split(/\r?\n/);
  let inComment = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    // Lines inside an HTML comment (the file's format notes) are examples, not ideas.
    const wasInComment = inComment;
    if (line.includes("<!--")) inComment = true;
    if (line.includes("-->")) inComment = false;
    if (wasInComment || line.includes("<!--")) continue;
    const match = UNTICKED.exec(line);
    if (!match) continue;
    const [topic, ...notes] = match[1].split("—");
    return { index, topic: topic.trim(), notes: notes.join("—").trim() };
  }
  return null;
}

/** Ticks line `index` and links the post, keeping every other line (and its line ending) as it was. */
export function tickIdea(markdown: string, index: number, slug: string): string {
  // The capture group keeps the \n / \r\n separators at the odd positions.
  const parts = markdown.split(/(\r?\n)/);
  const match = UNTICKED.exec(parts[index * 2] ?? "");
  if (!match) return markdown;
  parts[index * 2] = `- [x] ${match[1]} → /blog/${slug}`;
  return parts.join("");
}
