import { githubRepo } from "@/lib/githubWrite";
import { linkedinFromEnv } from "@/lib/linkedinEnv";
import { handleUpdate, secretMatches } from "@/lib/telegramBot";
import { telegramApi } from "@/lib/telegramApi";

// Telegram's webhook (set once with setWebhook, see docs/PROGRESS.md). It always
// answers 200 so Telegram never retries a rejected update; a request without the
// secret header, or from any chat but TELEGRAM_CHAT_ID, gets an empty 200 and
// no reply (lib/telegramBot.ts). Nothing here logs a token or a Telegram file URL.

export const dynamic = "force-dynamic";
// A Retry LinkedIn tap posts to LinkedIn from here (an image upload and a post per draft
// post); the default limit could end it early and make Telegram deliver the update again.
export const maxDuration = 60;

const OK = () => new Response(null, { status: 200 });

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return OK();
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const writeToken = process.env.GITHUB_WRITE_TOKEN;
  if (!botToken || !chatId || !writeToken) {
    console.error("telegram webhook: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID or GITHUB_WRITE_TOKEN is not set");
    return OK();
  }
  try {
    await handleUpdate(await request.json(), {
      gh: githubRepo(writeToken),
      tg: telegramApi(botToken),
      chatId,
      linkedin: linkedinFromEnv()?.core, // undefined until LinkedIn is set up (part c)
    });
  } catch (err) {
    console.error("telegram webhook:", err instanceof Error ? err.message : "unknown error");
  }
  return OK();
}
