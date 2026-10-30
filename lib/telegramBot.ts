// What the Telegram webhook does with an update. The adapters are injected, so
// the tests drive this with fakes; the route (app/api/telegram/route.ts) only
// wires env vars to it. Every action is safe to repeat: Telegram redelivers an
// update when a response is slow.

import { createHash, timingSafeEqual } from "node:crypto";
import { coverPath, loadDraft, requiredChecksGreen, withCoverImage } from "./draftPost.ts";
import type { DraftPr, PrInfo } from "./draftPost.ts";
import type { GitHubRepo } from "./githubWrite.ts";
import { connectUrl, postMergedDraft } from "./linkedinDraft.ts";
import type { LinkedInCore } from "./linkedinDraft.ts";
import { tokenStatus } from "./linkedinPost.ts";
import { REPLY, linkedinMessage, parseUpdate, retryKeyboard } from "./telegram.ts";
import type { TelegramApi } from "./telegramApi.ts";

/** `linkedin` is absent when LinkedIn is not set up on the site (part c). */
export type BotDeps = { gh: GitHubRepo; tg: TelegramApi; chatId: string; linkedin?: LinkedInCore };

const MAX_COVER_BYTES = 5_000_000;

/** Constant-time comparison of Telegram's secret-token header with ours. False if either is missing. */
export function secretMatches(header: string | null, secret: string | undefined): boolean {
  if (!header || !secret) return false;
  // Hash both so the buffers have equal length whatever the header held.
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

const firstLine = (err: unknown) => (err instanceof Error ? err.message : String(err)).split("\n")[0];

export async function handleUpdate(update: unknown, deps: BotDeps): Promise<void> {
  const { gh, tg, chatId } = deps;
  const intent = parseUpdate(update, chatId);
  if (intent.kind === "ignore") return;

  const say = (html: string, opts?: Parameters<TelegramApi["sendMessage"]>[2]) =>
    tg.sendMessage(chatId, html, opts);

  /** The draft behind PR `n` if it is still open; otherwise says why not and returns null. */
  async function openDraft(n: number): Promise<{ pr: PrInfo; draft: DraftPr } | null> {
    const loaded = await loadDraft(gh, n);
    if (!loaded) {
      await say(REPLY.notOpen(n));
      return null;
    }
    if (loaded.pr.merged) {
      await say(REPLY.alreadyMerged(n));
      return null;
    }
    if (loaded.pr.state !== "open") {
      await say(REPLY.notOpen(n));
      return null;
    }
    return loaded;
  }

  /** Posts a merged draft's posts to LinkedIn (again): recorded posts are skipped, so only what failed is retried. */
  async function retryLinkedIn(n: number): Promise<void> {
    const core = deps.linkedin;
    if (!core) return void (await say(REPLY.linkedinOff));
    // A merged draft's posts are read at its merge commit; the branch is gone by then.
    const pr = await gh.getPr(n);
    const loaded = await loadDraft(gh, n, pr.mergeSha ?? undefined);
    if (!loaded) return void (await say(REPLY.notOpen(n)));
    if (!loaded.pr.merged) return void (await say(REPLY.linkedinNotMerged(n)));
    const { results, connectUrl: link } = await postMergedDraft(loaded, core);
    await say(
      linkedinMessage(results, link, { withLive: false }),
      results.some((r) => r.retry) ? { keyboard: retryKeyboard(n) } : undefined,
    );
  }

  try {
    switch (intent.kind) {
      case "help":
        await say(REPLY.help);
        return;

      case "linkedin": {
        const core = deps.linkedin;
        if (!core) return void (await say(REPLY.linkedinOff));
        const status = await tokenStatus(core.store, core.now());
        await say(REPLY.linkedinStatus(status, connectUrl(await core.store.createState())));
        return;
      }

      case "photo": {
        let n = intent.pr;
        if (n === null) {
          const open = await gh.listOpenDrafts();
          if (open.length === 0) return void (await say(REPLY.noDraft));
          if (open.length > 1) return void (await say(REPLY.twoDrafts));
          n = open[0].number;
        }
        const loaded = await openDraft(n);
        if (!loaded) return;
        if (intent.ext === null || (intent.size !== null && intent.size > MAX_COVER_BYTES)) {
          return void (await say(REPLY.resendPhoto));
        }
        const { pr, draft } = loaded;
        const post = draft.posts[0];
        if (!post) throw new Error(`PR #${pr.number} has no post to put a cover on`);
        const cover = coverPath(post, intent.ext);
        const { bytes } = await tg.downloadFile(intent.fileId);
        const source = await gh.fileAt(post.path, pr.headSha);
        const sha = await gh.commitFiles(
          pr.head,
          [
            { path: cover.file, content: bytes },
            { path: post.path, content: withCoverImage(source, cover.url) },
          ],
          `Cover for #${pr.number}`,
        );
        await say(sha === null ? REPLY.coverSame(pr.number) : REPLY.coverAdded(pr.number));
        return;
      }

      case "button": {
        await tg.answerCallback(intent.callbackId);
        if (intent.action === "li") return void (await retryLinkedIn(intent.pr));
        const loaded = await openDraft(intent.pr);
        if (!loaded) return;
        const { pr } = loaded;
        if (intent.action === "edit") {
          await say(REPLY.editAsk(pr.number), { forceReply: true });
        } else if (intent.action === "rej") {
          await gh.close(pr.number);
          await gh.deleteBranch(pr.head);
          await say(REPLY.rejected(pr.number));
        } else {
          const { runs, statuses } = await gh.checks(pr.headSha);
          if (!requiredChecksGreen(runs, statuses)) return void (await say(REPLY.notGreen(pr.number)));
          await gh.merge(pr.number);
          await gh.deleteBranch(pr.head);
          await say(REPLY.merged(pr.number));
        }
        return;
      }

      case "editText": {
        const loaded = await openDraft(intent.pr);
        if (!loaded) return;
        await gh.comment(intent.pr, `edit: ${intent.text}`);
        await say(REPLY.editQueued(intent.pr));
        return;
      }
    }
  } catch (err) {
    await say(REPLY.failed(firstLine(err)));
  }
}
