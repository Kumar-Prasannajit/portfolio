import { githubRepo } from "@/lib/githubWrite";
import { linkedinFromEnv } from "@/lib/linkedinEnv";
import { handlePost } from "@/lib/linkedinHandlers";

// Called by the Actions `live` step (scripts/notify-telegram.mjs) with the shared
// secret in `x-linkedin-post-secret`. It re-checks that the PR is a merged draft
// whose merge commit is `sha`, then posts its posts. The token, the client secret
// and Redis never leave Vercel (lib/linkedinHandlers.ts).

export const dynamic = "force-dynamic";
export const maxDuration = 60; // an image upload and a post per draft post

const json = (body: object, status: number) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const li = linkedinFromEnv();
  const writeToken = process.env.GITHUB_WRITE_TOKEN;
  if (!li || !writeToken) {
    console.error("linkedin post: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, the Redis variables or GITHUB_WRITE_TOKEN are not set");
    return json({ error: "not configured" }, 503);
  }
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // handlePost answers 400 for a missing body
  }
  try {
    const res = await handlePost(
      { secretHeader: request.headers.get("x-linkedin-post-secret"), body },
      { secret: process.env.LINKEDIN_POST_SECRET, gh: githubRepo(writeToken), core: li.core },
    );
    return json(res.body, res.status);
  } catch (err) {
    console.error("linkedin post:", err instanceof Error ? err.message : "unknown error");
    return json({ error: "failed" }, 500);
  }
}
