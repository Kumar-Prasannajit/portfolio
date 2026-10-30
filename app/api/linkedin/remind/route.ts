import { linkedinFromEnv } from "@/lib/linkedinEnv";
import { handleRemind } from "@/lib/linkedinHandlers";
import { telegramApi } from "@/lib/telegramApi";

// Called by the daily 10:00 IST job with the shared secret. When the token has ten
// days or fewer left (or has expired) it sends the owner the reconnect message
// itself, so Actions never sees the token or Redis (lib/linkedinHandlers.ts).

export const dynamic = "force-dynamic";

const json = (body: object, status: number) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const li = linkedinFromEnv();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!li || !botToken || !chatId) {
    console.error("linkedin remind: LinkedIn, Redis or Telegram variables are not set");
    return json({ error: "not configured" }, 503);
  }
  try {
    const res = await handleRemind(
      { secretHeader: request.headers.get("x-linkedin-post-secret") },
      { secret: process.env.LINKEDIN_POST_SECRET, core: li.core, tg: telegramApi(botToken), chatId },
    );
    return json(res.body, res.status);
  } catch (err) {
    console.error("linkedin remind:", err instanceof Error ? err.message : "unknown error");
    return json({ error: "failed" }, 500);
  }
}
