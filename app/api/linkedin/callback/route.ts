import { linkedinFromEnv } from "@/lib/linkedinEnv";
import { handleCallback } from "@/lib/linkedinHandlers";
import { telegramApi } from "@/lib/telegramApi";

// LinkedIn redirects here after the owner approves. The state is burned before the
// code is exchanged; the page and the Telegram message never show a token or the
// code (lib/linkedinHandlers.ts).

export const dynamic = "force-dynamic";

const html = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

const sorry = (message: string, status: number) =>
  html(`<!doctype html><meta charset="utf-8"><title>LinkedIn</title><p style="font:16px system-ui;margin:2rem">${message}</p>`, status);

export async function GET(request: Request) {
  const li = linkedinFromEnv();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!li || !botToken || !chatId) {
    console.error("linkedin callback: LinkedIn, Redis or Telegram variables are not set");
    return sorry("LinkedIn is not set up on this site.", 503);
  }
  const q = new URL(request.url).searchParams;
  try {
    const res = await handleCallback(
      { code: q.get("code"), state: q.get("state"), error: q.get("error") },
      { store: li.store, api: li.api, tg: telegramApi(botToken), chatId, now: new Date() },
    );
    return html(res.html, res.status);
  } catch (err) {
    console.error("linkedin callback:", err instanceof Error ? err.message : "unknown error");
    return sorry("Something went wrong. Try again from the bot.", 500);
  }
}
