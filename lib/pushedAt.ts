// Last push date of a public GitHub repo ("org/repo"), shared by the Stack
// section ("last used") and the Work feed (date chip). Fetched at build and
// revalidated hourly; a GitHub outage or rate limit just yields undefined.

export async function pushedAt(repo: string): Promise<string | undefined> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return undefined;
    const json: { pushed_at?: string } = await res.json();
    return json.pushed_at;
  } catch {
    return undefined;
  }
}
