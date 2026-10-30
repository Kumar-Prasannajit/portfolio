// What the four /api/linkedin routes do, without any framework: the routes only
// read the request and wire env vars to these. The adapters are injected, so the
// tests drive them with fakes. Nothing here puts a token, a client secret, the
// OAuth code or the shared secret in a response, a page or a Telegram message.

import { loadDraft } from "./draftPost.ts";
import type { GitHubRepo } from "./githubWrite.ts";
import type { LinkedInApi } from "./linkedinApi.ts";
import { connectUrl, postMergedDraft } from "./linkedinDraft.ts";
import type { LinkedInCore } from "./linkedinDraft.ts";
import { tokenStatus } from "./linkedinPost.ts";
import type { LinkedInStore } from "./linkedinStore.ts";
import { REPLY, escapeHtml } from "./telegram.ts";
import { secretMatches } from "./telegramBot.ts";
import type { TelegramApi } from "./telegramApi.ts";

const REMIND_WITHIN_DAYS = 10;
const SHA = /^[0-9a-f]{7,40}$/i;

const firstLine = (err: unknown) => (err instanceof Error ? err.message : String(err)).split("\n")[0];

/** Called by the Actions `live` step with the shared secret: posts a merged draft's posts. */
export async function handlePost(
  req: { secretHeader: string | null; body: unknown },
  deps: { secret: string | undefined; gh: GitHubRepo; core: LinkedInCore },
): Promise<{ status: number; body: object }> {
  if (!secretMatches(req.secretHeader, deps.secret)) return { status: 401, body: { error: "unauthorized" } };

  const b = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
  const pr = typeof b.pr === "number" && Number.isInteger(b.pr) && b.pr > 0 ? b.pr : null;
  const sha = typeof b.sha === "string" && SHA.test(b.sha) ? b.sha.toLowerCase() : null;
  if (pr === null || sha === null) return { status: 400, body: { error: "expected { pr, sha }" } };

  let loaded;
  try {
    loaded = await loadDraft(deps.gh, pr, sha);
  } catch {
    return { status: 502, body: { error: "could not read the PR" } };
  }
  if (!loaded) return { status: 403, body: { error: "not a draft PR" } };
  if (!loaded.pr.merged || loaded.pr.mergeSha?.toLowerCase() !== sha) {
    return { status: 409, body: { error: "not merged at that sha" } };
  }
  return { status: 200, body: await postMergedDraft(loaded, deps.core) };
}

/** Called by the daily job with the shared secret: nudges the owner to reconnect before the token ends. */
export async function handleRemind(
  req: { secretHeader: string | null },
  deps: { secret: string | undefined; core: LinkedInCore; tg: TelegramApi; chatId: string },
): Promise<{ status: number; body: { sent: boolean; note: string } }> {
  if (!secretMatches(req.secretHeader, deps.secret)) return { status: 401, body: { sent: false, note: "unauthorized" } };

  const { core, tg, chatId } = deps;
  const status = await tokenStatus(core.store, core.now());
  if (status.state === "none") return { status: 200, body: { sent: false, note: "not connected" } };
  if (status.state === "ok" && status.daysLeft > REMIND_WITHIN_DAYS) {
    return { status: 200, body: { sent: false, note: `${status.daysLeft} days left` } };
  }
  const link = connectUrl(await core.store.createState());
  if (status.state === "expired") {
    await tg.sendMessage(chatId, REPLY.linkedinExpired(link));
    return { status: 200, body: { sent: true, note: "expired, reconnect link sent" } };
  }
  await tg.sendMessage(chatId, REPLY.linkedinReminder(status.daysLeft, link));
  return { status: 200, body: { sent: true, note: `${status.daysLeft} days left, reconnect link sent` } };
}

/** The link the bot sent: only a state the bot issued gets through to LinkedIn. */
export async function handleConnect(
  state: string | null,
  deps: { store: LinkedInStore; api: LinkedInApi },
): Promise<{ redirect: string } | { status: number }> {
  if (!state || !(await deps.store.hasState(state))) return { status: 400 };
  return { redirect: deps.api.authorizeUrl(state) };
}

const page = (status: number, message: string) => ({
  status,
  html:
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>LinkedIn</title><p style="font:16px system-ui;margin:2rem">${escapeHtml(message)}</p>`,
});

/** LinkedIn's redirect back: burns the state, exchanges the code, stores the token. */
export async function handleCallback(
  q: { code: string | null; state: string | null; error: string | null },
  deps: { store: LinkedInStore; api: LinkedInApi; tg: TelegramApi; chatId: string; now: Date },
): Promise<{ status: number; html: string }> {
  const { store, api, tg, chatId, now } = deps;
  if (!q.state || !(await store.burnState(q.state))) {
    return page(400, "This link has expired. Send the bot the word linkedin again.");
  }
  if (q.error || !q.code) return page(400, "LinkedIn did not authorize the connection.");

  try {
    const { accessToken, expiresIn } = await api.exchangeCode(q.code);
    const personUrn = `urn:li:person:${await api.memberId(accessToken)}`;
    const existing = await store.getToken();
    if (existing && existing.personUrn !== personUrn) {
      await tg.sendMessage(chatId, REPLY.linkedinDifferentAccount);
      return page(409, "That is a different LinkedIn account. Nothing was changed.");
    }
    const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();
    await store.setToken({ accessToken, expiresAt, personUrn });
    await tg.sendMessage(chatId, REPLY.linkedinConnected(expiresAt.slice(0, 10)));
    return page(200, "Connected. You can close this tab.");
  } catch (err) {
    try {
      await tg.sendMessage(chatId, REPLY.failed(firstLine(err)));
    } catch {
      // the page below still tells the owner
    }
    return page(502, "Could not connect LinkedIn. Try again from the bot.");
  }
}
