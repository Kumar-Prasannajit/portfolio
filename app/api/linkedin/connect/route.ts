import { linkedinFromEnv } from "@/lib/linkedinEnv";
import { handleConnect } from "@/lib/linkedinHandlers";

// The link the Telegram bot sends ("Connect LinkedIn"). Only a state the bot issued
// is sent on to LinkedIn's authorization page (lib/linkedinHandlers.ts).

export const dynamic = "force-dynamic";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

export async function GET(request: Request) {
  const li = linkedinFromEnv();
  if (!li) {
    console.error("linkedin connect: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET or the Redis variables are not set");
    return text("LinkedIn is not set up on this site.", 503);
  }
  try {
    const res = await handleConnect(new URL(request.url).searchParams.get("state"), { store: li.store, api: li.api });
    if ("redirect" in res) {
      return new Response(null, { status: 302, headers: { location: res.redirect, "cache-control": "no-store" } });
    }
    return text("This link is not valid. Send the bot the word linkedin.", res.status);
  } catch (err) {
    console.error("linkedin connect:", err instanceof Error ? err.message : "unknown error");
    return text("Something went wrong. Try again from the bot.", 500);
  }
}
