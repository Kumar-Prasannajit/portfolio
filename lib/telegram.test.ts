import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REPLY, TELEGRAM_MAX, draftKeyboard, draftMessage, escapeHtml, parseUpdate, prFromText,
  reminderMessage,
} from "./telegram.ts";
import type { DraftPr, PostDraft } from "./draftPost.ts";

const CHAT = "4242";
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../scripts/fixtures/telegram/${name}.json`, import.meta.url), "utf8"));

test("a photo replying to a draft message is a cover for that PR, from the largest size", () => {
  assert.deepEqual(parseUpdate(fixture("photo-reply"), CHAT),
    { kind: "photo", pr: 21, fileId: "large-id", ext: "jpg", size: 150000 });
});
test("a photo that replies to nothing has no PR", () => {
  assert.deepEqual(parseUpdate(fixture("photo-plain"), CHAT),
    { kind: "photo", pr: null, fileId: "large-id", ext: "jpg", size: 150000 });
});
test("a PNG document is accepted, with its size", () => {
  assert.deepEqual(parseUpdate(fixture("document-png"), CHAT),
    { kind: "photo", pr: 21, fileId: "doc-png-id", ext: "png", size: 420000 });
});
test("a GIF document has no usable extension", () => {
  const intent = parseUpdate(fixture("document-gif"), CHAT);
  assert.equal(intent.kind, "photo");
  assert.equal(intent.kind === "photo" && intent.ext, null);
});
test("a button press carries its action, PR and callback id", () => {
  assert.deepEqual(parseUpdate(fixture("button-pub"), CHAT),
    { kind: "button", action: "pub", pr: 21, callbackId: "cb-1" });
});
test("text replying to the edit question is the edit instruction", () => {
  assert.deepEqual(parseUpdate(fixture("edit-reply"), CHAT),
    { kind: "editText", pr: 21, text: "shorter intro" });
});
test("text replying to a draft message is also an edit instruction", () => {
  const update = fixture("edit-reply");
  update.message.reply_to_message.text = "Weekly #009 · PR #21\nSalonjaa NAP fixes";
  assert.deepEqual(parseUpdate(update, CHAT), { kind: "editText", pr: 21, text: "shorter intro" });
});
test("plain text that replies to nothing gets the help reply", () => {
  assert.deepEqual(parseUpdate(fixture("text-plain"), CHAT), { kind: "help" });
});
test("a message of another kind from the owner gets the help reply too", () => {
  const update = fixture("text-plain");
  delete update.message.text;
  update.message.sticker = { file_id: "s" };
  assert.deepEqual(parseUpdate(update, CHAT), { kind: "help" });
});
test("anyone else, in any chat, is ignored", () => {
  assert.deepEqual(parseUpdate(fixture("stranger"), CHAT), { kind: "ignore" });
  const button = fixture("button-pub");
  button.callback_query.from.id = 777;
  assert.deepEqual(parseUpdate(button, CHAT), { kind: "ignore" });
  const elsewhere = fixture("text-plain");
  elsewhere.message.chat.id = 888;
  assert.deepEqual(parseUpdate(elsewhere, CHAT), { kind: "ignore" });
});
test("junk is ignored", () => {
  assert.deepEqual(parseUpdate({}, CHAT), { kind: "ignore" });
  assert.deepEqual(parseUpdate(null, CHAT), { kind: "ignore" });
  const button = fixture("button-pub");
  button.callback_query.data = "pub:abc";
  assert.deepEqual(parseUpdate(button, CHAT), { kind: "ignore" });
  button.callback_query.data = "merge:21";
  assert.deepEqual(parseUpdate(button, CHAT), { kind: "ignore" });
});

test("prFromText reads the PR number, not the weekly number", () => {
  assert.equal(prFromText("Weekly #009 · PR #21\n…"), 21);
  assert.equal(prFromText("Weekly #009"), null);
  assert.equal(prFromText(undefined), null);
});
test("escapeHtml escapes the three characters Telegram HTML cares about", () => {
  assert.equal(escapeHtml("A <b> & c"), "A &lt;b&gt; &amp; c");
});

const post = (over: Partial<PostDraft> = {}): PostDraft => ({
  kind: "weekly", path: "content/weekly/009-x.mdx", slug: "009-x", number: "009",
  title: "Salonjaa NAP fixes", summary: "A quiet week.", linkedin: "Caption one.", ...over,
});
const draft = (over: Partial<DraftPr> = {}): DraftPr => ({
  number: 21, branch: "draft/weekly-009", headSha: "abc", createdAt: "2026-10-27T00:00:00Z",
  posts: [post()], checks: ["#009: a claim to verify", "Collector errors: none."], ...over,
});
const PREVIEW = "https://p.example.vercel.app";

test("draftMessage has the PR, title, summary, checks, caption and preview", () => {
  const msg = draftMessage(draft(), PREVIEW, false);
  assert.ok(msg.startsWith("Weekly #009 · PR #21\n"));
  for (const part of ["Salonjaa NAP fixes", "A quiet week.", "• #009: a claim to verify",
    "• Collector errors: none.", "Caption one.", `Preview: ${PREVIEW}`]) {
    assert.ok(msg.includes(part), part);
  }
});
test("draftMessage starts Updated · when it is a new version", () => {
  assert.ok(draftMessage(draft(), PREVIEW, true).startsWith("Updated · Weekly #009 · PR #21\n"));
});
test("draftMessage says nothing flagged when there are no checks", () => {
  assert.ok(draftMessage(draft({ checks: [] }), PREVIEW, false).includes("• nothing flagged"));
});
test("draftMessage escapes what it inserts", () => {
  const msg = draftMessage(draft({ posts: [post({ title: "A <b> & c" })] }), PREVIEW, false);
  assert.ok(msg.includes("A &lt;b&gt; &amp; c"));
  assert.ok(!msg.includes("A <b> & c"));
});
test("draftMessage headers: one weekly, two weeklies, a blog", () => {
  const two = draft({ posts: [post(), post({ slug: "010-y", number: "010", title: "Second" })] });
  assert.ok(draftMessage(two, PREVIEW, false).startsWith("Weekly #009–#010 · PR #21\n"));
  const blog = draft({ number: 19, posts: [post({ kind: "blog", number: null, slug: "allowlist" })] });
  assert.ok(draftMessage(blog, PREVIEW, false).startsWith("Blog · PR #19\n"));
});
test("draftMessage fits Telegram's limit by cutting long captions at a sentence", () => {
  const long = "Sentence number one is here. ".repeat(110).trim(); // ~3,200 chars
  const msg = draftMessage(
    draft({ posts: [post({ linkedin: long }), post({ slug: "010-y", number: "010", linkedin: long })] }),
    PREVIEW, false);
  assert.ok(msg.length <= TELEGRAM_MAX, String(msg.length));
  assert.equal(msg.match(/here\.… \(full caption in the PR\)/g)?.length, 2);
  assert.ok(msg.includes(`Preview: ${PREVIEW}`));
});
test("draftMessage leaves a short caption whole", () => {
  assert.ok(!draftMessage(draft(), PREVIEW, false).includes("full caption in the PR"));
});

test("reminderMessage counts days, and hours under a day", () => {
  const now = new Date("2026-10-29T10:00:00Z");
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  assert.ok(reminderMessage(draft({ createdAt: ago(50) }), PREVIEW, now)
    .startsWith("Still waiting: Weekly #009, PR #21, open 2 days"));
  assert.ok(reminderMessage(draft({ createdAt: ago(26) }), PREVIEW, now).includes("open 1 day"));
  assert.ok(reminderMessage(draft({ createdAt: ago(21) }), PREVIEW, now).includes("open 21 hours"));
});
test("reminderMessage links the preview when there is one", () => {
  const now = new Date("2026-10-29T10:00:00Z");
  assert.ok(reminderMessage(draft(), PREVIEW, now).includes(`Preview: ${PREVIEW}`));
  assert.ok(!reminderMessage(draft(), null, now).includes("Preview:"));
});

test("draftKeyboard is one row of Publish, Edit and Reject", () => {
  assert.deepEqual(draftKeyboard(21), { inline_keyboard: [[
    { text: "Publish", callback_data: "pub:21" },
    { text: "Edit", callback_data: "edit:21" },
    { text: "Reject", callback_data: "rej:21" },
  ]] });
});

test("REPLY holds the exact message copy", () => {
  assert.equal(REPLY.coverAdded(21), "Cover added to PR #21, preview rebuilding.");
  assert.equal(REPLY.coverSame(21), "Cover already on PR #21.");
  assert.equal(REPLY.twoDrafts, "Two drafts are open: reply to the one this photo is for.");
  assert.equal(REPLY.noDraft, "No draft is open.");
  assert.equal(REPLY.resendPhoto, "Send it as a photo (JPEG or PNG, under 5 MB).");
  assert.equal(REPLY.editAsk(21), "What should change in PR #21?");
  assert.equal(REPLY.editQueued(21), "Edit queued for PR #21.");
  assert.equal(REPLY.notGreen(21), "Checks not green yet for PR #21, try after the next message.");
  assert.equal(REPLY.merged(21), "Merged PR #21, deploying.");
  assert.equal(REPLY.rejected(21), "Rejected PR #21, branch deleted.");
  assert.equal(REPLY.alreadyMerged(21), "PR #21 is already merged.");
  assert.equal(REPLY.notOpen(21), "PR #21 is no longer open.");
  assert.equal(REPLY.help, "Reply to a draft with a photo, or use its buttons.");
  assert.equal(REPLY.failed("GitHub PUT /pulls/21/merge → 409"), "Failed: GitHub PUT /pulls/21/merge → 409");
  assert.equal(REPLY.previewFailed(21, "https://v.example/log"), "Preview failed for PR #21: https://v.example/log");
  assert.equal(REPLY.live("https://www.kumarp.in/weekly/009-x"), "Live: https://www.kumarp.in/weekly/009-x");
  assert.equal(REPLY.editFailed(21, "Edit failed: check:content still fails"),
    "PR #21: Edit failed: check:content still fails");
});
test("REPLY escapes values it inserts", () => {
  assert.equal(REPLY.failed("a <b> & c"), "Failed: a &lt;b&gt; &amp; c");
});
