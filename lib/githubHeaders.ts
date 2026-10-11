// Request headers for api.github.com, shared by the rail-stats route, the
// Stack section's pushedAt and githubActivity. Never send these to any other
// host (the token would leak to it).

// A fine-grained token covers exactly one owner, so an org the user owns gets
// its own variable. Any other owner uses GITHUB_TOKEN — see .env.example.
const OWNER_TOKEN_ENV: Record<string, string> = {
  "salonjaa-digital-solution": "GITHUB_TOKEN_SALONJAA",
};

/** Headers for a request about `owner`'s repos (or the user's, if omitted). */
export function githubHeaders(owner?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  const envName = owner ? OWNER_TOKEN_ENV[owner.toLowerCase()] : undefined;
  // Optional: raises the unauthenticated 60/hr rate limit to 5000/hr, and lets
  // lib/githubActivity.ts read that owner's private repos.
  const token = (envName && process.env[envName]) || process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
