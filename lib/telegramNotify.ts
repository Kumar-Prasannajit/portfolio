// The messages the bot sends on its own, from GitHub Actions: a draft's preview,
// a failed preview, the live link after a publish, the daily reminders, the
// routine's log issues and edit failures. Adapters are injected, so the tests
// run it with fakes; scripts/notify-telegram.mjs wires the real ones. Each
// function returns one log line for the Actions run.

import { isBotCommit, isDraftPr, loadDraft, postUrl } from "./draftPost.ts";
import type { PrInfo } from "./draftPost.ts";
import type { GitHubRepo } from "./githubWrite.ts";
import type { LinkedInClient } from "./linkedinClient.ts";
import { postInputs } from "./linkedinDraft.ts";
import type { PostResult } from "./linkedinPost.ts";
import {
  REPLY, TELEGRAM_MAX, draftKeyboard, draftMessage, escapeHtml, linkedinMessage, reminderMessage, retryKeyboard,
} from "./telegram.ts";
import type { TelegramApi } from "./telegramApi.ts";

/** `linkedin` is absent until LINKEDIN_POST_SECRET is set (part c): the bot then sends the plain Live message. */
export type NotifyDeps = { gh: GitHubRepo; tg: TelegramApi; chatId: string; now: Date; linkedin?: LinkedInClient };

export type DeploymentEvent = {
  environment: string;
  state: string;
  sha: string;
  environmentUrl: string | null;
  targetUrl: string | null;
};

const FINISHED = new Set(["success", "failure", "error"]);
const REMINDER_AFTER_MS = 20 * 3_600_000;

const short = (sha: string) => sha.slice(0, 7);

/** The PRs GitHub associates with a commit, loaded. */
async function prsAt(sha: string, gh: GitHubRepo): Promise<PrInfo[]> {
  return Promise.all((await gh.prsForSha(sha)).map((n) => gh.getPr(n)));
}

export async function notifyDeployment(e: DeploymentEvent, deps: NotifyDeps): Promise<string> {
  const { gh, tg, chatId } = deps;
  if (!FINISHED.has(e.state)) return `skip: ${e.state}`;

  if (e.environment.startsWith("Preview")) {
    // Only the PR's current head: an older commit's preview is already superseded.
    const pr = (await prsAt(e.sha, gh)).find((p) => isDraftPr(p) && p.state === "open" && p.headSha === e.sha);
    if (!pr) return `skip: no open draft PR at ${short(e.sha)}`;

    if (e.state !== "success") {
      await tg.sendMessage(chatId, REPLY.previewFailed(pr.number, e.targetUrl ?? e.environmentUrl ?? "no link"));
      return `sent: preview failed for PR #${pr.number}`;
    }
    const loaded = await loadDraft(gh, pr.number, e.sha);
    if (!loaded) return `skip: PR #${pr.number} is not a draft`;
    const url = e.environmentUrl || (await gh.previewUrl(e.sha)) || e.targetUrl || "unavailable";
    const updated = isBotCommit(await gh.commitMessage(e.sha));
    await tg.sendMessage(chatId, draftMessage(loaded.draft, url, updated), { keyboard: draftKeyboard(pr.number) });
    return `sent: ${updated ? "updated " : ""}draft PR #${pr.number}`;
  }

  if (e.environment.startsWith("Production")) {
    if (e.state !== "success") return `skip: production ${e.state}`;
    const pr = (await prsAt(e.sha, gh)).find((p) => isDraftPr(p) && p.merged && p.mergeSha === e.sha);
    if (!pr) return `skip: no merged draft PR at ${short(e.sha)}`;
    const loaded = await loadDraft(gh, pr.number, e.sha);
    if (!loaded) return `skip: PR #${pr.number} is not a draft`;
    if (!deps.linkedin) {
      await tg.sendMessage(chatId, loaded.draft.posts.map((p) => REPLY.live(postUrl(p))).join("\n"));
      return `sent: live PR #${pr.number}`;
    }

    // The site is live whatever LinkedIn says, so a failed request still sends the Live lines.
    let outcome: { results: PostResult[]; connectUrl: string | null };
    try {
      outcome = await deps.linkedin.post(pr.number, e.sha);
    } catch {
      outcome = {
        results: postInputs(loaded.draft).map((p) => ({
          key: p.key, label: p.label, siteUrl: p.siteUrl, status: "failed" as const, linkedinUrl: null,
          reason: "LinkedIn request failed", retry: true, reconnect: false,
        })),
        connectUrl: null,
      };
    }
    const { results, connectUrl } = outcome;
    await tg.sendMessage(
      chatId,
      linkedinMessage(results, connectUrl, { withLive: true }),
      results.some((r) => r.retry) ? { keyboard: retryKeyboard(pr.number) } : undefined,
    );
    const count = (status: PostResult["status"]) => results.filter((r) => r.status === status).length;
    return `sent: live PR #${pr.number} (LinkedIn: ${count("posted")} posted, ${count("skipped")} skipped, ${count("failed")} failed)`;
  }

  return `skip: environment ${e.environment}`;
}

export async function notifyReminders(deps: NotifyDeps): Promise<string> {
  const { gh, tg, chatId, now } = deps;
  const old = (await gh.listOpenDrafts()).filter((p) => now.getTime() - Date.parse(p.createdAt) > REMINDER_AFTER_MS);
  const reminded: number[] = [];
  for (const pr of old) {
    const loaded = await loadDraft(gh, pr.number);
    if (!loaded) continue;
    const url = await gh.previewUrl(pr.headSha);
    await tg.sendMessage(chatId, reminderMessage(loaded.draft, url, now), { keyboard: draftKeyboard(pr.number) });
    reminded.push(pr.number);
  }
  let line = reminded.length ? `sent: reminders for ${reminded.map((n) => `PR #${n}`).join(", ")}` : "skip: no draft waiting";
  if (deps.linkedin) {
    // The LinkedIn token check never costs the draft reminders above.
    try {
      line += `; LinkedIn: ${await deps.linkedin.remind()}`;
    } catch (err) {
      line += `; LinkedIn remind failed: ${(err instanceof Error ? err.message : String(err)).split("\n")[0]}`;
    }
  }
  return line;
}

export async function notifyLogIssue(issue: number, deps: NotifyDeps): Promise<string> {
  const { gh, tg, chatId } = deps;
  const { title, body } = await gh.issue(issue);
  const build = (b: string) => `<b>${escapeHtml(title.slice(0, 200))}</b>\n${escapeHtml(b)}`;
  let text = body;
  while (build(text).length > TELEGRAM_MAX && text.length > 0) text = `${text.slice(0, Math.floor(text.length * 0.8))}…`;
  await tg.sendMessage(chatId, build(text));
  await gh.closeIssue(issue); // after the send: a failed send leaves the issue open to retry
  return `sent: log issue #${issue}`;
}

export async function notifyEditFailed(pr: number, body: string, deps: NotifyDeps): Promise<string> {
  const { gh, tg, chatId } = deps;
  // Anyone can comment on a public PR, so only a draft PR's comments are forwarded.
  if (!isDraftPr(await gh.getPr(pr))) return `skip: PR #${pr} is not a draft`;
  await tg.sendMessage(chatId, REPLY.editFailed(pr, body.length > 1000 ? `${body.slice(0, 999)}…` : body));
  return `sent: edit failed for PR #${pr}`;
}
