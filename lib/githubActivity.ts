// "Last used" for the Stack section, from the owner's real GitHub activity
// rather than only the three showcased projects: for each of the most recently
// pushed repos, work out which tools it uses (lib/githubTools.ts) and take the
// newest push per tool. Returns tool name -> ISO date; computeStack() merges it
// with the per-project dates. Every fetch is revalidated hourly and any failure
// degrades to {} (the section falls back to project dates) — it never throws.
//
// Rate budget, unauthenticated (60/hr, shared with rail-stats' ~24/hr and the
// 3 pushedAt calls): 1 repo list + at most REPO_LIMIT /languages = 16 per
// revalidation. package.json comes from raw.githubusercontent.com, which is not
// API-rate-limited. With GITHUB_TOKEN the list also covers private/org repos
// and their package.json goes through the contents API (+ at most REPO_LIMIT).

import { githubHeaders } from "./githubHeaders";
import {
  latestByTool,
  pickRecentRepos,
  toolsFromLanguages,
  toolsFromPackageJson,
  type RepoSummary,
} from "./githubTools";

const OWNER = "Kumar-Prasannajit";
const REPO_LIMIT = 15;
const NEXT = { revalidate: 3600 };

async function getJson(url: string, headers: Record<string, string>) {
  try {
    const res = await fetch(url, { headers, next: NEXT });
    return res.ok ? ((await res.json()) as unknown) : null;
  } catch {
    return null;
  }
}

function packageJson(repo: RepoSummary) {
  const { full_name: name, default_branch: branch } = repo;
  if (repo.private) {
    // Only the contents API can read a private repo; ask for the raw file.
    return getJson(
      `https://api.github.com/repos/${name}/contents/package.json?ref=${encodeURIComponent(branch)}`,
      { ...githubHeaders(), Accept: "application/vnd.github.raw+json" },
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
      githubHeaders(),
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
    const list = await getJson(
      process.env.GITHUB_TOKEN
        ? "https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&sort=pushed&per_page=30"
        : `https://api.github.com/users/${OWNER}/repos?sort=pushed&per_page=30`,
      githubHeaders(),
    );
    const repos = pickRecentRepos(list, REPO_LIMIT);
    return latestByTool(await Promise.all(repos.map(scan)));
  } catch {
    return {};
  }
}
