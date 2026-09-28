import { NextResponse } from "next/server";

// Rail 3's three Stats rows (docs/redesign-spec.md phase 3): WATCHING (AniList
// public GraphQL), LAST COMMIT and UPTIME (GitHub REST). One route so the
// client makes a single request instead of three, and each field fails
// independently — a broken AniList call never blanks LAST COMMIT or UPTIME,
// per the spec's "placeholder rows if a request fails, never a layout hole."
// Same shape as app/api/now-playing/route.ts: a discriminated status union
// per field, "unconfigured" distinct from "error".

const GITHUB_OWNER = "Kumar-Prasannajit";
const GITHUB_REPO = "portfolio";
// 5 minutes: these change at most a few times a day (a commit, an episode),
// so there's no reason to hit AniList/GitHub on every poll — see
// lib/useRailStats.ts, which polls this route itself every 5 minutes too.
const REVALIDATE_SECONDS = 300;

export type WatchingStat =
  | { status: "unconfigured" }
  | { status: "none" } // account configured, nothing currently airing/watching
  | { status: "error" }
  | { status: "ok"; title: string; progress: number; episodes: number | null };

export type LastCommitStat =
  | { status: "error" }
  | { status: "ok"; repo: string; committedAt: string };

export type UptimeStat =
  | { status: "error" }
  | { status: "ok"; committedAt: string; build: "ok" | "preview" };

export type RailStatsResponse = {
  watching: WatchingStat;
  lastCommit: LastCommitStat;
  uptime: UptimeStat;
};

function githubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  // Optional: raises the unauthenticated 60/hr rate limit to 5000/hr. Public
  // read-only data either way — see .env.example.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

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

async function fetchLastCommit(): Promise<LastCommitStat> {
  try {
    const res = await fetch(
      `https://api.github.com/users/${GITHUB_OWNER}/events/public?per_page=30`,
      { headers: githubHeaders(), next: { revalidate: REVALIDATE_SECONDS } }
    );
    if (!res.ok) return { status: "error" };

    const events = await res.json();
    if (!Array.isArray(events)) return { status: "error" };
    const push = events.find((event) => event?.type === "PushEvent");
    if (!push) return { status: "error" };

    const repoName: string = push.repo?.name ?? `${GITHUB_OWNER}/unknown`;
    return {
      status: "ok",
      repo: repoName.split("/")[1] ?? repoName,
      committedAt: push.created_at,
    };
  } catch {
    return { status: "error" };
  }
}

async function fetchUptime(): Promise<UptimeStat> {
  try {
    // The commit actually live right now: Vercel stamps its SHA into the
    // runtime env automatically. Falls back to the default branch's HEAD
    // for local dev / non-Vercel hosting, where that var isn't set.
    const ref = process.env.VERCEL_GIT_COMMIT_SHA || "main";
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${ref}`,
      { headers: githubHeaders(), next: { revalidate: REVALIDATE_SECONDS } }
    );
    if (!res.ok) return { status: "error" };

    const commit = await res.json();
    const committedAt: string | undefined =
      commit?.commit?.committer?.date ?? commit?.commit?.author?.date;
    if (!committedAt) return { status: "error" };

    return {
      status: "ok",
      committedAt,
      build: process.env.VERCEL_ENV === "production" ? "ok" : process.env.VERCEL_ENV ? "preview" : "ok",
    };
  } catch {
    return { status: "error" };
  }
}

export async function GET() {
  const [watching, lastCommit, uptime] = await Promise.all([
    fetchWatching(),
    fetchLastCommit(),
    fetchUptime(),
  ]);
  return NextResponse.json<RailStatsResponse>({ watching, lastCommit, uptime });
}
