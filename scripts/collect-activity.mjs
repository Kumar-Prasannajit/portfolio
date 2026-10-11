// Prints the user's recent commits as JSON, for the post-drafting routines.
// Plain code, not AI. Reads only public repos that pass isAllowedRepo (lib/githubTools.ts):
// the allowed owners' repos are listed with that owner's own token
// (lib/githubHeaders.ts), the single named repos are fetched by name, and
// toCommits drops anything not allowed a second time. Nothing from an
// employer's repos is ever requested. Private repos are skipped too, even
// allowed ones: their commit messages would land in a public PR and post.
//
//   node scripts/collect-activity.mjs --since <YYYY-MM-DD> [--until <YYYY-MM-DD>]
//
// Dates are Asia/Kolkata calendar days, both inclusive; --until defaults to
// today. Output: { since, until, commits, errors }, commits oldest first. A
// failing request is recorded in `errors` and doesn't throw; if every request
// failed the JSON is still printed but the exit status is 1.

import { assertNode } from "./nodeVersion.mjs";

assertNode();

const { ALLOWED_OWNERS, ALLOWED_REPOS, USER_LOGIN, isAllowedRepo, pickRecentRepos, repoListUrl } =
  await import("../lib/githubTools.ts");
const { mentionsEmployer } = await import("../lib/contentCheck.ts");
const { githubHeaders } = await import("../lib/githubHeaders.ts");
const { addDays, istDate, istMidnightIso, pageWarning, toCommits } =
  await import("../lib/activity.ts");

const PER_PAGE = 100;
const TIMEOUT_MS = 30_000;
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && addDays(d, 0) === d;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const since = arg("since");
const until = arg("until") ?? istDate(new Date());
if (!since || !isDate(since) || !isDate(until) || until < since) {
  console.error("usage: collect-activity.mjs --since <YYYY-MM-DD> [--until <YYYY-MM-DD>]");
  process.exit(2);
}
const sinceIso = istMidnightIso(since);
const untilIso = istMidnightIso(addDays(until, 1));

const errors = [];
// Only public repos are read, but without a token GitHub allows 60 requests an
// hour per IP (shared in the cloud) and lists just 30 of the user's repos; say so.
// GITHUB_TOKEN alone covers every owner (githubHeaders falls back to it), since
// any token can read public repos.
if (!process.env.GITHUB_TOKEN) {
  errors.push("GITHUB_TOKEN not set: unauthenticated, 60 requests/hour and only 30 repos of " + USER_LOGIN + " listed");
} else if (process.env.GITHUB_TOKEN === "proxy-injected") {
  // What a Claude Code cloud session sees when its environment sets no token.
  errors.push("GITHUB_TOKEN is the cloud placeholder \"proxy-injected\": set a real token in the routine's environment");
}
let requests = 0;
let failures = 0;

/** GET `url` as JSON. Failures are recorded and yield null. */
async function getJson(url, headers) {
  requests++;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) return await res.json();
    errors.push(`${url}: HTTP ${res.status}`);
  } catch (err) {
    errors.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
  }
  failures++;
  return null;
}

const ownerOf = (fullName) => fullName.split("/")[0];
const allowed = (fullName) => isAllowedRepo(fullName, ALLOWED_OWNERS, ALLOWED_REPOS);

// 1. Candidate repos: each allowed owner's list, plus the named single repos.
const lists = await Promise.all(
  ALLOWED_OWNERS.map(async (owner) => {
    const url = repoListUrl(owner, !!process.env.GITHUB_TOKEN);
    const list = await getJson(url, githubHeaders(owner));
    // Sorted by last push, newest first: a full page that still reaches back
    // into the window may have cut off repos that belong in it.
    if (Array.isArray(list) && list.length >= PER_PAGE && list.at(-1)?.pushed_at >= sinceIso) {
      errors.push(`${owner}: repo list may be truncated`);
    }
    return Array.isArray(list) ? list : [];
  }),
);
const named = await Promise.all(
  ALLOWED_REPOS.map((name) =>
    getJson(`https://api.github.com/repos/${name}`, githubHeaders(ownerOf(name))),
  ),
);

// Same filter as the Stack section: allowed owners or named repos only, and no
// forks (a fork of an employer repo sits under the user's own account),
// archived repos or the profile repo. Plus public only: a repo without an
// explicit private: false is treated as private.
const repos = [
  ...pickRecentRepos(lists.flat(), Infinity, ALLOWED_OWNERS, ALLOWED_REPOS),
  ...pickRecentRepos(named, ALLOWED_REPOS.length, [], ALLOWED_REPOS),
]
  .filter((repo) => allowed(repo.full_name) && repo.private === false && repo.pushed_at >= sinceIso)
  .map((repo) => repo.full_name);

// 2. Commits by the user in the window, per repo.
const perRepo = await Promise.all(
  [...new Set(repos)].map(async (name) => {
    const query = new URLSearchParams({
      author: USER_LOGIN,
      since: sinceIso,
      until: untilIso,
      per_page: String(PER_PAGE),
    });
    const json = await getJson(
      `https://api.github.com/repos/${name}/commits?${query}`,
      githubHeaders(ownerOf(name)),
    );
    if (Array.isArray(json)) {
      const warning = pageWarning(name, json.length, PER_PAGE);
      if (warning) errors.push(warning);
    }
    return toCommits(json, name, USER_LOGIN, allowed);
  }),
);

// Defence in depth: the term list is also enforced on what gets collected, so
// an employer reference in an allowed repo never reaches a PR body.
const all = perRepo.flat();
const commits = all
  .filter((c) => !mentionsEmployer(`${c.repo} ${c.message} ${c.url}`))
  .sort((a, b) => a.date.localeCompare(b.date));
if (commits.length < all.length) {
  errors.push(`dropped ${all.length - commits.length} commit(s) that mention an employer term`);
}
console.log(JSON.stringify({ since, until, commits, errors }, null, 2));
if (requests > 0 && failures === requests) process.exit(1);
