// "Last used" for the Stack section, from the owner's real GitHub activity
// rather than only the three showcased projects: for each of the most recently
// pushed repos, work out which tools it uses (lib/githubTools.ts) and take the
// newest push per tool. Returns tool name -> ISO date; computeStack() merges it
// with the per-project dates. Every fetch is revalidated hourly and any failure
// degrades to {} (the section falls back to project dates) — it never throws.
//
// Only repos owned by ALLOWED_OWNERS (lib/githubTools.ts) are listed: the
// user's account and the org they own. Each owner is listed separately with
// its own token (lib/githubHeaders.ts), so an employer's repos are never even
// fetched, and the allowlist check below is a second guard. ALLOWED_REPOS,
// single repos the user built on other people's accounts, are fetched by name.
//
// Rate budget, unauthenticated (60/hr, shared with rail-stats' ~24/hr and the
// 3 pushedAt calls): 2 repo lists + 3 named repos + at most REPO_LIMIT + 3
// /languages = 23 per
// revalidation. Public package.json comes from raw.githubusercontent.com, which
// is not API-rate-limited; a private repo's goes through the contents API
// (+ at most REPO_LIMIT, authenticated only).

import { githubHeaders } from "./githubHeaders";
import {
  ALLOWED_OWNERS,
  ALLOWED_REPOS,
  latestByTool,
  pickRecentRepos,
  repoListUrl,
  toolsFromLanguages,
  toolsFromPackageJson,
  type RepoSummary,
} from "./githubTools";

const REPO_LIMIT = 15;
const NEXT = { revalidate: 3600 };

const ownerOf = (repo: RepoSummary) => repo.full_name.split("/")[0];

async function getJson(url: string, headers: Record<string, string>) {
  try {
    const res = await fetch(url, { headers, next: NEXT });
    return res.ok ? ((await res.json()) as unknown) : null;
  } catch {
    return null;
  }
}

/** One owner's most recently pushed repos, private ones included when its token allows. */
async function listRepos(owner: string): Promise<unknown[]> {
  const url = repoListUrl(owner, !!process.env.GITHUB_TOKEN);
  const list = await getJson(url, githubHeaders(owner));
  return Array.isArray(list) ? list : [];
}

function packageJson(repo: RepoSummary) {
  const { full_name: name, default_branch: branch } = repo;
  if (repo.private) {
    // Only the contents API can read a private repo; ask for the raw file.
    return getJson(
      `https://api.github.com/repos/${name}/contents/package.json?ref=${encodeURIComponent(branch)}`,
      { ...githubHeaders(ownerOf(repo)), Accept: "application/vnd.github.raw+json" },
    );
  }
  // Public: raw host, no token, no API quota.
  return getJson(
    `https://raw.githubusercontent.com/${name}/${encodeURIComponent(branch)}/package.json`,
    {},
  );
}

async function scan(repo: RepoSummary) {
  const [languages, pkg] = await Promise.all([
    getJson(
      `https://api.github.com/repos/${repo.full_name}/languages`,
      githubHeaders(ownerOf(repo)),
    ),
    packageJson(repo),
  ]);
  return {
    pushedAt: repo.pushed_at,
    tools: new Set([...toolsFromLanguages(languages), ...toolsFromPackageJson(pkg)]),
  };
}

export async function githubActivity(): Promise<Record<string, string>> {
  try {
    const [lists, named] = await Promise.all([
      Promise.all(ALLOWED_OWNERS.map(listRepos)),
      Promise.all(
        ALLOWED_REPOS.map((name) =>
          getJson(`https://api.github.com/repos/${name}`, githubHeaders(name.split("/")[0])),
        ),
      ),
    ]);
    // The named repos are few and older than most, so they're always scanned
    // rather than competing for the REPO_LIMIT most recent slots.
    const repos = [
      ...pickRecentRepos(lists.flat(), REPO_LIMIT, ALLOWED_OWNERS),
      ...pickRecentRepos(named, ALLOWED_REPOS.length, [], ALLOWED_REPOS),
    ];
    return latestByTool(await Promise.all(repos.map(scan)));
  } catch {
    return {};
  }
}
