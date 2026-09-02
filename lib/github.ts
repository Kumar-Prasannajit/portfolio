import { openSourceFallback, type OpenSourceItem } from "@/lib/data";

// Both the Open Source feed and the contribution heatmap read this same
// public GitHub username — kept in one place so they can't drift apart.
export const GITHUB_USERNAME = "Kumar-Prasannajit";

const REVALIDATE_SECONDS = 3600; // 1 hour — well under the 60 req/hr unauthenticated rate limit.
const FETCH_TIMEOUT_MS = 5000;

type GithubSearchIssueItem = {
  title: string;
  html_url: string;
  state: "open" | "closed";
  repository_url: string;
  pull_request?: { merged_at: string | null };
};

type GithubSearchResponse = {
  items?: GithubSearchIssueItem[];
};

function repoFromRepositoryUrl(repositoryUrl: string): string {
  // repository_url looks like "https://api.github.com/repos/<owner>/<repo>".
  const marker = "/repos/";
  const i = repositoryUrl.indexOf(marker);
  return i === -1 ? repositoryUrl : repositoryUrl.slice(i + marker.length);
}

/**
 * Recent pull requests authored by GITHUB_USERNAME, via GitHub's public
 * (unauthenticated) search API. Server-side only, cached/revalidated hourly
 * via Next's fetch cache — never called per-client-request. Returns the
 * static `openSourceFallback` list (see lib/data.ts) if the call fails or
 * comes back empty, so the section never renders empty.
 */
export async function getOpenSourceActivity(): Promise<{
  items: OpenSourceItem[];
  isFallback: boolean;
}> {
  try {
    const res = await fetch(
      `https://api.github.com/search/issues?q=author:${GITHUB_USERNAME}+type:pr&sort=updated&order=desc&per_page=6`,
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) return { items: openSourceFallback, isFallback: true };

    const data: GithubSearchResponse = await res.json();
    if (!data.items || data.items.length === 0) {
      return { items: openSourceFallback, isFallback: true };
    }

    const items: OpenSourceItem[] = data.items.map((item) => ({
      title: item.title,
      repo: repoFromRepositoryUrl(item.repository_url),
      state: item.pull_request?.merged_at ? "merged" : item.state,
      url: item.html_url,
    }));
    return { items, isFallback: false };
  } catch {
    return { items: openSourceFallback, isFallback: true };
  }
}

export type ContributionDay = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };

/**
 * Last ~12 months of contribution-calendar data via the public
 * github-contributions-api.jogruber.de mirror (no auth required). Same
 * server-side caching approach as getOpenSourceActivity. Returns null on
 * failure so the caller can fall back to a static illustrative grid.
 */
export async function getContributionCalendar(): Promise<ContributionDay[] | null> {
  try {
    const res = await fetch(`https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const data: { contributions?: ContributionDay[] } = await res.json();
    if (!data.contributions || data.contributions.length === 0) return null;
    return data.contributions;
  } catch {
    return null;
  }
}
