// Request headers for api.github.com, shared by the rail-stats route, the
// Stack section's pushedAt and githubActivity. Never send these to any other
// host (the token would leak to it).

export function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  // Optional: raises the unauthenticated 60/hr rate limit to 5000/hr, and lets
  // lib/githubActivity.ts see private/work repos — see .env.example.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}
