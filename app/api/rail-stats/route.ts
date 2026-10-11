import { NextResponse } from "next/server";
import { githubHeaders } from "@/lib/githubHeaders";
import {
  ALLOWED_OWNERS,
  USER_LOGIN,
  newestCommit,
  pickRecentRepos,
  repoListUrl,
} from "@/lib/githubTools";

// Rail 3's three Stats rows (docs/redesign-spec.md phase 3): WATCHING (AniList
// public GraphQL), LAST COMMIT and DEPLOYED (GitHub REST). One route so the
// client makes a single request instead of three, and each field fails
// independently — a broken AniList call never blanks LAST COMMIT or DEPLOYED,
// per the spec's "placeholder rows if a request fails, never a layout hole."
// Same shape as app/api/now-playing/route.ts: a discriminated status union
// per field, "unconfigured" distinct from "error".

const GITHUB_REPO = "portfolio";
// 5 minutes: these change at most a few times a day (a commit, an episode),
// so there's no reason to hit AniList/GitHub on every poll — see
// lib/useRailStats.ts, which polls this route itself every 5 minutes too.
const REVALIDATE_SECONDS = 300;
// Repo lists only decide which repos to ask for commits; they change slowly.
const LIST_REVALIDATE_SECONDS = 1800;

export type WatchingStat =
  | { status: "unconfigured" }
  | { status: "none" } // account configured, nothing currently airing/watching
  | { status: "error" }
  | { status: "ok"; title: string; progress: number; episodes: number | null };

export type LastCommitStat =
  | { status: "error" }
  | { status: "ok"; repo: string; committedAt: string };

// When the live version was deployed: the deployed commit's committer date
// (a merge lands, Vercel deploys it within minutes). Never a health claim:
// nothing here monitors the site.
export type DeployedStat =
  | { status: "error" }
  | { status: "ok"; deployedAt: string };

export type RailStatsResponse = {
  watching: WatchingStat;
  lastCommit: LastCommitStat;
  deployed: DeployedStat;
};

async function fetchWatching(): Promise<WatchingStat> {
  const username = process.env.ANILIST_USERNAME;
  if (!username) return { status: "unconfigured" };

  try {
    const query = `
      query ($name: String) {
        MediaListCollection(userName: $name, type: ANIME, status: CURRENT) {
          lists {
            entries {
              progress
              media {
                title { userPreferred }
                episodes
              }
            }
          }
        }
      }
    `;
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { name: username } }),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return { status: "error" };

    type AniListEntry = {
      progress?: number;
      media?: { title?: { userPreferred?: string }; episodes?: number | null };
    };
    const data = (await res.json()) as {
      data?: { MediaListCollection?: { lists?: { entries?: AniListEntry[] }[] } };
    };
    const lists = data?.data?.MediaListCollection?.lists;
    const entry: AniListEntry | undefined = Array.isArray(lists)
      ? lists.flatMap((list) => list?.entries ?? [])[0]
      : undefined;
    if (!entry) return { status: "none" };

    return {
      status: "ok",
      title: entry.media?.title?.userPreferred ?? "Unknown",
      progress: entry.progress ?? 0,
      episodes: entry.media?.episodes ?? null,
    };
  } catch {
    return { status: "error" };
  }
}

async function getJson(url: string, owner: string, revalidate: number): Promise<unknown> {
  const res = await fetch(url, { headers: githubHeaders(owner), next: { revalidate } });
  return res.ok ? res.json() : null;
}

// The user's own newest commit, read from the commits themselves: the public
// events feed it replaced could lag GitHub by an hour or more. Only allowed
// owners' PUBLIC repos (the rail is public, and so is every repo it names),
// and only the 2 most recently pushed, which keeps the route near 40 GitHub
// calls an hour while Vercel has no token (60/hr unauthenticated).
async function fetchLastCommit(): Promise<LastCommitStat> {
  try {
    const hasToken = !!process.env.GITHUB_TOKEN;
    const lists = await Promise.all(
      ALLOWED_OWNERS.map((owner) =>
        getJson(repoListUrl(owner, hasToken), owner, LIST_REVALIDATE_SECONDS)
      )
    );
    const publicRepos = lists
      .flatMap((list) => (Array.isArray(list) ? list : []))
      .filter((repo) => repo?.private === false);
    const repos = pickRecentRepos(publicRepos, 2, ALLOWED_OWNERS);

    const perRepo = await Promise.all(
      repos.map(async (repo) => ({
        repo: repo.full_name,
        commits: await getJson(
          `https://api.github.com/repos/${repo.full_name}/commits?author=${USER_LOGIN}&per_page=1`,
          repo.full_name.split("/")[0],
          REVALIDATE_SECONDS
        ),
      }))
    );
    const newest = newestCommit(perRepo);
    if (!newest) return { status: "error" };

    return {
      status: "ok",
      repo: newest.repo.split("/")[1] ?? newest.repo,
      committedAt: newest.committedAt,
    };
  } catch {
    return { status: "error" };
  }
}

async function fetchDeployed(): Promise<DeployedStat> {
  try {
    // The commit actually live right now: Vercel stamps its SHA into the
    // runtime env automatically. Falls back to the default branch's HEAD
    // for local dev / non-Vercel hosting, where that var isn't set.
    const ref = process.env.VERCEL_GIT_COMMIT_SHA || "main";
    const res = await fetch(
      `https://api.github.com/repos/${USER_LOGIN}/${GITHUB_REPO}/commits/${ref}`,
      // One deployed SHA, one fixed answer: cached for the whole deploy
      // (the next deploy has a new SHA, so a new URL). Only the local "main"
      // fallback moves, so only it is revalidated.
      {
        headers: githubHeaders(),
        next: { revalidate: process.env.VERCEL_GIT_COMMIT_SHA ? false : REVALIDATE_SECONDS },
      }
    );
    if (!res.ok) return { status: "error" };

    const commit = await res.json();
    const deployedAt: string | undefined =
      commit?.commit?.committer?.date ?? commit?.commit?.author?.date;
    if (!deployedAt) return { status: "error" };

    return { status: "ok", deployedAt };
  } catch {
    return { status: "error" };
  }
}

export async function GET() {
  const [watching, lastCommit, deployed] = await Promise.all([
    fetchWatching(),
    fetchLastCommit(),
    fetchDeployed(),
  ]);
  return NextResponse.json<RailStatsResponse>({ watching, lastCommit, deployed });
}
