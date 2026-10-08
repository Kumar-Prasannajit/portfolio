// Last push date of one GitHub repo ("org/repo"): the Work feed's date chip,
// and one input to the Stack section's "last used" (the showcased project's
// Source repo — the rest of that comes from lib/githubActivity.ts). Fetched at
// build and revalidated hourly; a GitHub outage or rate limit just yields
// undefined.

import { githubHeaders } from "./githubHeaders";

export async function pushedAt(repo: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: githubHeaders(),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return undefined;
    const json: { pushed_at?: string } = await res.json();
    return json.pushed_at;
  } catch {
    return undefined;
  }
}
