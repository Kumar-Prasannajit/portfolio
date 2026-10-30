// The Telegram side of the review bot, without any network: an incoming update
// becomes one intent, and every message the bot sends is built here (Telegram
// HTML, each inserted string escaped, at most 4,096 characters). Relative ./x.ts
// imports, so `node --test` and scripts/*.mjs can load it.

import type { DraftPr } from "./draftPost.ts";
import type { PostResult, TokenStatus } from "./linkedinPost.ts";

export const TELEGRAM_MAX = 4096;

export type Action = "pub" | "edit" | "rej" | "li";

export type Intent =
  | { kind: "photo"; pr: number | null; fileId: string; ext: "jpg" | "png" | null; size: number | null }
  | { kind: "button"; action: Action; pr: number; callbackId: string }
  | { kind: "editText"; pr: number; text: string }
  | { kind: "linkedin" }
  | { kind: "help" }
  | { kind: "ignore" };

export type Keyboard = { inline_keyboard: { text: string; callback_data: string }[][] };

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : null;
const idOf = (v: unknown): string | null => {
  const id = rec(v)?.id;
  return typeof id === "number" || typeof id === "string" ? String(id) : null;
};
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

/** The PR a bot message is about: every message the bot sends contains `PR #<n>`. */
export function prFromText(text: string | undefined): number | null {
  const m = /\bPR #(\d+)/.exec(text ?? "");
  return m ? Number(m[1]) : null;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const IGNORE: Intent = { kind: "ignore" };
const MIME_EXT: Record<string, "jpg" | "png"> = { "image/jpeg": "jpg", "image/png": "png" };

/** Turns a Telegram update into what the bot should do. Anyone but `chatId` is ignored. */
export function parseUpdate(update: unknown, chatId: string): Intent {
  const u = rec(update);
  if (!u) return IGNORE;

  const cb = rec(u.callback_query);
  if (cb) {
    if (idOf(cb.from) !== chatId) return IGNORE;
    const chat = rec(cb.message)?.chat;
    if (chat !== undefined && idOf(chat) !== chatId) return IGNORE;
    const m = /^(pub|edit|rej|li):(\d+)$/.exec(typeof cb.data === "string" ? cb.data : "");
    if (!m || typeof cb.id !== "string") return IGNORE;
    return { kind: "button", action: m[1] as Action, pr: Number(m[2]), callbackId: cb.id };
  }

  const msg = rec(u.message);
  if (!msg || idOf(msg.from) !== chatId || idOf(msg.chat) !== chatId) return IGNORE;

  const reply = rec(msg.reply_to_message);
  const replyText = reply?.text ?? reply?.caption;
  const replyPr = prFromText(typeof replyText === "string" ? replyText : undefined);

  if (Array.isArray(msg.photo) && msg.photo.length > 0) {
    // Telegram sends several sizes; the one with the most pixels is the original.
    const sizes = msg.photo.map(rec).filter((p): p is Rec => p !== null && typeof p.file_id === "string");
    const area = (p: Rec) => (num(p.width) ?? 0) * (num(p.height) ?? 0);
    const best = sizes.reduce<Rec | null>((a, p) => (a === null || area(p) >= area(a) ? p : a), null);
    if (best) {
      return { kind: "photo", pr: replyPr, fileId: best.file_id as string, ext: "jpg", size: num(best.file_size) };
    }
  }

  const doc = rec(msg.document);
  if (doc && typeof doc.file_id === "string") {
    const mime = typeof doc.mime_type === "string" ? doc.mime_type : "";
    return { kind: "photo", pr: replyPr, fileId: doc.file_id, ext: MIME_EXT[mime] ?? null, size: num(doc.file_size) };
  }

  if (typeof msg.text === "string" && replyPr !== null && msg.text.trim() !== "") {
    return { kind: "editText", pr: replyPr, text: msg.text.trim() };
  }
  if (typeof msg.text === "string" && msg.text.trim().toLowerCase() === "linkedin") return { kind: "linkedin" };
  return { kind: "help" };
}

export function draftKeyboard(pr: number): Keyboard {
  return {
    inline_keyboard: [[
      { text: "Publish", callback_data: `pub:${pr}` },
      { text: "Edit", callback_data: `edit:${pr}` },
      { text: "Reject", callback_data: `rej:${pr}` },
    ]],
  };
}

/** The one button under a LinkedIn failure; its callback names the merged PR. */
export function retryKeyboard(pr: number): Keyboard {
  return { inline_keyboard: [[{ text: "Retry LinkedIn", callback_data: `li:${pr}` }]] };
}

/** "Weekly #009", "Weekly #009–#010" or "Blog". */
function label(d: DraftPr): string {
  const first = d.posts[0];
  if (!first) return "Draft";
  if (first.kind === "blog") return "Blog";
  const numbers = d.posts.map((p) => p.number).filter((n): n is string => n !== null);
  if (numbers.length === 0) return "Weekly";
  if (numbers.length === 1) return `Weekly #${numbers[0]}`;
  return `Weekly #${numbers[0]}–#${numbers[numbers.length - 1]}`;
}

const CAPTION_CUT = "… (full caption in the PR)";
const MAX_CHECKS = 10;

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** `raw` escaped, cut at a sentence end if needed so the result is at most `max` characters. */
function fitCaption(raw: string, max: number): string {
  const whole = escapeHtml(raw);
  if (whole.length <= max) return whole;
  const room = max - CAPTION_CUT.length;
  let end = 0;
  let used = 0;
  for (const ch of raw) {
    const width = escapeHtml(ch).length;
    if (used + width > room) break;
    used += width;
    end += ch.length;
  }
  const head = raw.slice(0, end);
  const sentence = /^[\s\S]*[.!?](?=\s|$)/.exec(head);
  const cut = sentence ? sentence[0] : head.replace(/\s+\S*$/, "") || head;
  return escapeHtml(cut.trimEnd()) + CAPTION_CUT;
}

/** Splits `budget` characters between the captions, giving short ones what they need. */
function allocate(lengths: number[], budget: number): number[] {
  const order = lengths.map((len, i) => ({ len, i })).sort((a, b) => a.len - b.len);
  const out = new Array<number>(lengths.length).fill(0);
  let remaining = Math.max(0, budget);
  order.forEach(({ len, i }, k) => {
    const share = Math.floor(remaining / (order.length - k));
    out[i] = Math.min(len, share);
    remaining -= out[i];
  });
  return out;
}

export function draftMessage(d: DraftPr, previewUrl: string, updated: boolean): string {
  const several = d.posts.length > 1;
  const head = `${updated ? "Updated · " : ""}${label(d)} · PR #${d.number}`;

  const posts = d.posts.map((p) => {
    const name = several && p.number ? `#${p.number} · ${p.title}` : p.title;
    const lines = [`<b>${escapeHtml(clip(name, 150))}</b>`];
    if (p.summary) lines.push("", escapeHtml(clip(p.summary, 400)));
    return lines.join("\n");
  });

  const checks = d.checks.length
    ? d.checks.slice(0, MAX_CHECKS).map((c) => `• ${escapeHtml(clip(c, 300))}`)
    : ["• nothing flagged"];
  if (d.checks.length > MAX_CHECKS) checks.push(`• …and ${d.checks.length - MAX_CHECKS} more in the PR`);

  const build = (captions: string[]) =>
    [
      head,
      ...posts,
      ["Please check:", ...checks].join("\n"),
      ...d.posts.map((p, i) => `${several && p.number ? `LinkedIn #${p.number}` : "LinkedIn"}:\n${captions[i]}`),
      `Preview: ${escapeHtml(previewUrl)}`,
    ].join("\n\n");

  const raws = d.posts.map((p) => p.linkedin || "(none)");
  const room = TELEGRAM_MAX - build(raws.map(() => "")).length;
  const shares = allocate(raws.map((r) => escapeHtml(r).length), room);
  const message = build(raws.map((r, i) => fitCaption(r, shares[i])));

  if (message.length <= TELEGRAM_MAX) return message;
  // Only reachable with absurdly long titles or checks: cut at a line end, never inside a tag.
  return message.slice(0, message.lastIndexOf("\n", TELEGRAM_MAX));
}

export function reminderMessage(d: DraftPr, previewUrl: string | null, now: Date): string {
  const hours = Math.max(0, Math.floor((now.getTime() - Date.parse(d.createdAt)) / 3_600_000));
  const days = Math.floor(hours / 24);
  const open = days >= 1 ? `${days} day${days === 1 ? "" : "s"}` : `${hours} hour${hours === 1 ? "" : "s"}`;
  const lines = [`Still waiting: ${label(d)}, PR #${d.number}, open ${open}`];
  if (previewUrl) lines.push(`Preview: ${escapeHtml(previewUrl)}`);
  return lines.join("\n");
}

/**
 * What happened to each post on LinkedIn, with `Live:` lines when the message is the
 * site-is-live one. A reconnect link, when given, always survives the length cut.
 */
export function linkedinMessage(results: PostResult[], connectUrl: string | null, opts: { withLive: boolean }): string {
  const blocks = results.map((r) => {
    const live = opts.withLive ? `Live: ${escapeHtml(r.siteUrl)}\n` : "";
    if (r.status === "posted") return `${live}On LinkedIn: ${escapeHtml(r.linkedinUrl ?? "")}`;
    if (r.status === "skipped") return `${live}Already on LinkedIn: ${escapeHtml(r.linkedinUrl ?? "")}`;
    return `${live}LinkedIn failed for "${escapeHtml(clip(r.label, 80))}": ${escapeHtml(clip(r.reason ?? "unknown error", 200))}`;
  });
  const reconnect = connectUrl ? `\n\nReconnect LinkedIn: ${escapeHtml(connectUrl)}` : "";
  const head = blocks.join("\n\n");
  const room = TELEGRAM_MAX - reconnect.length;
  if (head.length <= room) return head + reconnect;
  const cut = head.lastIndexOf("\n", room);
  return head.slice(0, cut > 0 ? cut : room) + reconnect;
}

/** Every fixed reply, exact copy. Telegram HTML: values passed in are escaped. */
export const REPLY = {
  coverAdded: (pr: number) => `Cover added to PR #${pr}, preview rebuilding.`,
  coverSame: (pr: number) => `Cover already on PR #${pr}.`,
  twoDrafts: "Two drafts are open: reply to the one this photo is for.",
  noDraft: "No draft is open.",
  resendPhoto: "Send it as a photo (JPEG or PNG, under 5 MB).",
  editAsk: (pr: number) => `What should change in PR #${pr}?`,
  editQueued: (pr: number) => `Edit queued for PR #${pr}.`,
  notGreen: (pr: number) => `Checks not green yet for PR #${pr}, try after the next message.`,
  merged: (pr: number) => `Merged PR #${pr}, deploying.`,
  rejected: (pr: number) => `Rejected PR #${pr}, branch deleted.`,
  alreadyMerged: (pr: number) => `PR #${pr} is already merged.`,
  notOpen: (pr: number) => `PR #${pr} is no longer open.`,
  help: "Reply to a draft with a photo, or use its buttons.",
  failed: (oneLine: string) => `Failed: ${escapeHtml(oneLine)}`,
  previewFailed: (pr: number, url: string) => `Preview failed for PR #${pr}: ${escapeHtml(url)}`,
  live: (url: string) => `Live: ${escapeHtml(url)}`,
  editFailed: (pr: number, commentBody: string) => `PR #${pr}: ${escapeHtml(commentBody)}`,
  linkedinOff: "LinkedIn is not set up on the site yet.",
  linkedinNotMerged: (pr: number) => `PR #${pr} is not merged yet.`,
  linkedinConnected: (until: string) => `LinkedIn connected until ${escapeHtml(until)}.`,
  linkedinDifferentAccount: "That is a different LinkedIn account from the one already connected. Nothing was changed.",
  linkedinStatus: (s: TokenStatus, connectUrl: string) => {
    const state =
      s.state === "none"
        ? "not connected."
        : s.state === "expired"
          ? "token expired."
          : `connected until ${s.expiresAt.toISOString().slice(0, 10)}.`;
    return `LinkedIn: ${state}\nConnect LinkedIn: ${escapeHtml(connectUrl)}`;
  },
  linkedinReminder: (daysLeft: number, connectUrl: string) =>
    `LinkedIn token expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.\nReconnect LinkedIn: ${escapeHtml(connectUrl)}`,
  linkedinExpired: (connectUrl: string) => `LinkedIn token expired.\nReconnect LinkedIn: ${escapeHtml(connectUrl)}`,
};
