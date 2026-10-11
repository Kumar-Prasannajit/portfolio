// Prints the user's recent commits as JSON, for the post-drafting routines.
// Plain code, not AI. Reads only repos that pass isAllowedRepo (lib/githubTools.ts):
// the allowed owners' repos are listed with that owner's own token
// (lib/githubHeaders.ts), the single named repos are fetched by name, and
// toCommits drops anything not allowed a second time. Nothing from an
// employer's repos is ever requested.
//
//   node scripts/collect-activity.mjs --since <YYYY-MM-DD> [--until <YYYY-MM-DD>]
//
// Dates are Asia/Kolkata calendar days, both inclusive; --until defaults to
// today. Output: { since, until, commits, errors }, commits oldest first. A
// failing request is recorded in `errors` and doesn't throw; if every request
// failed the JSON is still printed but the exit status is 1.

import { assertNode } from "./nodeVersion.mjs";

assertNode();

const { ALLOWED_OWNERS, ALLOWED_REPOS, USER_LOGIN, isAllowedRepo, repoListUrl } =
  await import("../lib/githubTools.ts");
const { githubHeaders } = await import("../lib/githubHeaders.ts");
const { addDays, istDate, istMidnightIso, pageWarning, toCommits } =
  await import("../lib/activity.ts");

const PER_PAGE = 100;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const since = arg("since");
const until = arg("until") ?? istDate(new Date());
if (!since || !DATE.test(since) || !DATE.test(until)) {
  console.error("usage: collect-activity.mjs --since <YYYY-MM-DD> [--until <YYYY-MM-DD>]");
  process.exit(2);
}
const sinceIso = istMidnightIso(since);
const untilIso = istMidnightIso(addDays(until, 1));

const errors = [];
let requests = 0;
let failures = 0;

/** GET `url` as JSON. Failures are recorded and yield null. */
async function getJson(url, headers) {
  requests++;
  try {
    const res = await fetch(url, { headers });
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

const repos = new Map();
for (const repo of [...lists.flat(), ...named]) {
  const name = repo?.full_name;
  if (typeof name !== "string" || typeof repo.pushed_at !== "string") continue;
  if (!allowed(name) || repo.pushed_at < sinceIso) continue;
  repos.set(name.toLowerCase(), name);
}

// 2. Commits by the user in the window, per repo.
const perRepo = await Promise.all(
  [...repos.values()].map(async (name) => {
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

const commits = perRepo.flat().sort((a, b) => a.date.localeCompare(b.date));
console.log(JSON.stringify({ since, until, commits, errors }, null, 2));
if (requests > 0 && failures === requests) process.exit(1);
