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
// Rate budget, unauthenticated (60/hr, shared with rail-stats' ~28/hr and the
// 3 pushedAt calls): 2 repo lists + 3 named repos + at most REPO_LIMIT + 3
// /languages = 23 per
// revalidation. Public package.json comes from raw.githubusercontent.com, which
// is not API-rate-limited; a private repo's goes through the contents API.
//
// With a token for the repo's owner (5000/hr), each repo also gets one
// recursive /git/trees call (+ at most REPO_LIMIT + 3): it finds Docker files
// and a monorepo's workspace package.json files (apps/api/package.json), which
// is where a backend's pg/ioredis/bullmq live. A private repo then reads up to
// MANIFEST_LIMIT manifests through the contents API. Without a token the tree
// call is skipped, so the budget above holds, and only the root package.json
// is read, as before.

import { githubHeaders } from "./githubHeaders";
import {
  ALLOWED_OWNERS,
  ALLOWED_REPOS,
  latestByTool,
  manifestPaths,
  pickRecentRepos,
  repoListUrl,
  toolsFromLanguages,
  toolsFromPackageJson,
  toolsFromTree,
  treePaths,
  type RepoSummary,
} from "./githubTools";

const REPO_LIMIT = 15;
// Root + three workspaces covers a typical apps/api, apps/web, packages/shared.
const MANIFEST_LIMIT = 4;
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

function packageJson(repo: RepoSummary, file: string) {
  const { full_name: name, default_branch: branch } = repo;
  const filePath = file.split("/").map(encodeURIComponent).join("/");
  if (repo.private) {
    // Only the contents API can read a private repo; ask for the raw file.
    return getJson(
      `https://api.github.com/repos/${name}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
      { ...githubHeaders(ownerOf(repo)), Accept: "application/vnd.github.raw+json" },
    );
  }
  // Public: raw host, no token, no API quota.
  return getJson(
    `https://raw.githubusercontent.com/${name}/${encodeURIComponent(branch)}/${filePath}`,
    {},
  );
}

async function scan(repo: RepoSummary) {
  const headers = githubHeaders(ownerOf(repo));
  const [languages, tree] = await Promise.all([
    getJson(`https://api.github.com/repos/${repo.full_name}/languages`, headers),
    // Only with a token: see the rate budget above.
    headers.Authorization
      ? getJson(
          `https://api.github.com/repos/${repo.full_name}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`,
          headers,
        )
      : null,
  ]);
  const paths = treePaths(tree);
  // No tree (no token, or the call failed): the root manifest, as before.
  const manifests = paths.length > 0 ? manifestPaths(paths, MANIFEST_LIMIT) : ["package.json"];
  const pkgs = await Promise.all(manifests.map((file) => packageJson(repo, file)));
  return {
    pushedAt: repo.pushed_at,
    tools: new Set([
      ...toolsFromLanguages(languages),
      ...toolsFromTree(paths),
      ...pkgs.flatMap((pkg) => [...toolsFromPackageJson(pkg)]),
    ]),
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
