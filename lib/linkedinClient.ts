// The Actions side of LinkedIn posting: two calls to the site's own routes with the
// shared secret, and nothing else. The LinkedIn token, the client secret and Redis
// stay on Vercel; this only asks the site to post a merged draft or to check the
// token. `fetch` injected so the tests fake it. Errors name the route and the status
// only, never the secret.

import type { PostResult } from "./linkedinPost.ts";
import { SITE_URL } from "./site.ts";

export type LinkedInClient = {
  post(pr: number, sha: string): Promise<{ results: PostResult[]; connectUrl: string | null }>;
  remind(): Promise<string>; // the route's note, for the Actions log
};

const TIMEOUT_MS = 65_000; // the post route may run for 60 s

export function linkedinClient(secret: string, baseUrl: string = SITE_URL, fetchImpl: typeof fetch = fetch): LinkedInClient {
  const base = baseUrl.replace(/\/$/, "");

  async function call(route: "post" | "remind", body: object): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}/api/linkedin/${route}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-linkedin-post-secret": secret },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new Error(`LinkedIn ${route} route failed`); // the underlying error may quote the URL
    }
    if (!res.ok) throw new Error(`LinkedIn ${route} route → ${res.status}`);
    const json = await res.json().catch(() => null);
    if (typeof json !== "object" || json === null) throw new Error(`LinkedIn ${route} route → unexpected response`);
    return json as Record<string, unknown>;
  }

  return {
    async post(pr, sha) {
      const json = await call("post", { pr, sha });
      if (!Array.isArray(json.results)) throw new Error("LinkedIn post route → unexpected response");
      return {
        results: json.results as PostResult[],
        connectUrl: typeof json.connectUrl === "string" ? json.connectUrl : null,
      };
    },

    async remind() {
      const json = await call("remind", {});
      return typeof json.note === "string" ? json.note : "ok";
    },
  };
}
