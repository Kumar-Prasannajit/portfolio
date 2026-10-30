import test from "node:test";
import assert from "node:assert/strict";
import {
  notifyDeployment, notifyEditFailed, notifyLogIssue, notifyReminders,
  type DeploymentEvent, type NotifyDeps,
} from "./telegramNotify.ts";
import { REPLY, draftKeyboard, retryKeyboard } from "./telegram.ts";
import type { LinkedInClient } from "./linkedinClient.ts";
import type { PostResult } from "./linkedinPost.ts";
import type { PrInfo } from "./draftPost.ts";
import type { GitHubRepo } from "./githubWrite.ts";
import type { TelegramApi } from "./telegramApi.ts";

const CHAT = "4242";
const NOW = new Date("2026-10-29T10:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const post = (n: string) => `---
title: "Post ${n}"
date: "2026-10-25"
summary: "Summary ${n}."
linkedin: |
  Caption ${n}.
---

Body.
`;
const PATH_9 = "content/weekly/009-salonjaa-nap.mdx";
const PATH_10 = "content/weekly/010-brand-name.mdx";

const pr = (over: Partial<PrInfo> = {}): PrInfo => ({
  number: 21, state: "open", merged: false, labels: ["draft-post"], head: "draft/weekly-009",
  headSha: "head21", body: "## Please check\n\n- one claim\n", createdAt: hoursAgo(30), mergeSha: null, ...over,
});

type World = {
  prs?: PrInfo[];
  forSha?: Record<string, number[]>;
  commitMessages?: Record<string, string>;
  files?: Record<string, string>; // path -> source, for every PR
  previewUrl?: string | null;
  issue?: { title: string; body: string };
};

function setup(world: World = {}) {
  const prs = world.prs ?? [pr()];
  const files = world.files ?? { [PATH_9]: post("009") };
  const calls: { name: string; args: unknown[] }[] = [];
  const sent: { text: string; opts?: Parameters<TelegramApi["sendMessage"]>[2] }[] = [];
  const rec = (name: string, ...args: unknown[]) => calls.push({ name, args });

  const gh: GitHubRepo = {
    getPr: async (n) => {
      rec("getPr", n);
      const found = prs.find((p) => p.number === n);
      if (!found) throw new Error(`GitHub GET /pulls/${n} → 404`);
      return found;
    },
    prFiles: async () => Object.keys(files).map((filename) => ({ filename, status: "added" })),
    fileAt: async (path) => files[path],
    commitMessage: async (sha) => { rec("commitMessage", sha); return world.commitMessages?.[sha] ?? "Draft weekly #009"; },
    checks: async () => { throw new Error("unexpected checks"); },
    commitFiles: async () => { throw new Error("unexpected commitFiles"); },
    merge: async () => { throw new Error("unexpected merge"); },
    close: async () => { throw new Error("unexpected close"); },
    deleteBranch: async () => { throw new Error("unexpected deleteBranch"); },
    comment: async () => { throw new Error("unexpected comment"); },
    listOpenDrafts: async () => prs.filter((p) => p.state === "open" && p.labels.includes("draft-post") && p.head.startsWith("draft/")),
    prsForSha: async (sha) => { rec("prsForSha", sha); return world.forSha?.[sha] ?? []; },
    previewUrl: async (sha) => { rec("previewUrl", sha); return world.previewUrl ?? null; },
    issue: async (n) => { rec("issue", n); return world.issue ?? { title: "t", body: "b" }; },
    closeIssue: async (n) => { rec("closeIssue", n); },
  };
  const tg: TelegramApi = {
    sendMessage: async (_chat, text, opts) => { sent.push({ text, opts }); },
    answerCallback: async () => { throw new Error("unexpected answerCallback"); },
    downloadFile: async () => { throw new Error("unexpected downloadFile"); },
  };
  const deps: NotifyDeps = { gh, tg, chatId: CHAT, now: NOW };
  return { deps, calls, sent, names: () => calls.map((c) => c.name) };
}

const preview = (over: Partial<DeploymentEvent> = {}): DeploymentEvent => ({
  environment: "Preview", state: "success", sha: "head21",
  environmentUrl: "https://p-21.vercel.app", targetUrl: "https://vercel.com/log/21", ...over,
});

test("a successful preview of a draft PR's head sends the draft with its buttons", async () => {
  const t = setup({ forSha: { head21: [21] } });
  await notifyDeployment(preview(), t.deps);
  assert.equal(t.sent.length, 1);
  assert.ok(t.sent[0].text.startsWith("Weekly #009 · PR #21\n"));
  assert.ok(t.sent[0].text.includes("Preview: https://p-21.vercel.app"));
  assert.deepEqual(t.sent[0].opts, { keyboard: draftKeyboard(21) });
});

test("a head commit made by the bot makes it an Updated message", async () => {
  const t = setup({ forSha: { head21: [21] }, commitMessages: { head21: "Cover for #21" } });
  await notifyDeployment(preview(), t.deps);
  assert.ok(t.sent[0].text.startsWith("Updated · Weekly #009 · PR #21\n"));
});

test("a failed or errored preview sends the build log link", async () => {
  for (const state of ["failure", "error"]) {
    const t = setup({ forSha: { head21: [21] } });
    await notifyDeployment(preview({ state }), t.deps);
    assert.deepEqual(t.sent.map((s) => s.text), ["Preview failed for PR #21: https://vercel.com/log/21"], state);
  }
});

test("a deployment still pending or in progress is skipped before any network call", async () => {
  for (const state of ["pending", "in_progress", "queued"]) {
    const t = setup({ forSha: { head21: [21] } });
    const line = await notifyDeployment(preview({ state }), t.deps);
    assert.equal(line, `skip: ${state}`);
    assert.deepEqual(t.calls, []);
    assert.deepEqual(t.sent, []);
  }
});

test("a preview that is not an open draft PR's head sends nothing (Review Focus 3)", async () => {
  const feature = setup({ prs: [pr({ labels: [], head: "feat/x" })], forSha: { head21: [21] } });
  await notifyDeployment(preview(), feature.deps);
  assert.deepEqual(feature.sent, []);

  const orphan = setup({ forSha: {} });
  await notifyDeployment(preview({ sha: "nopr" }), orphan.deps);
  assert.deepEqual(orphan.sent, []);

  const stale = setup({ prs: [pr({ headSha: "newer" })], forSha: { head21: [21] } });
  await notifyDeployment(preview(), stale.deps);
  assert.deepEqual(stale.sent, []);

  const closed = setup({ prs: [pr({ state: "closed" })], forSha: { head21: [21] } });
  await notifyDeployment(preview(), closed.deps);
  assert.deepEqual(closed.sent, []);
});

const production = (over: Partial<DeploymentEvent> = {}): DeploymentEvent => ({
  environment: "Production", state: "success", sha: "merge21",
  environmentUrl: "https://www.kumarp.in", targetUrl: null, ...over,
});
const mergedPr = (over: Partial<PrInfo> = {}) =>
  pr({ state: "closed", merged: true, mergeSha: "merge21", ...over });

test("the production deploy of a merged draft PR sends one Live line per post", async () => {
  const t = setup({
    prs: [mergedPr()], forSha: { merge21: [21] },
    files: { [PATH_9]: post("009"), [PATH_10]: post("010") },
  });
  await notifyDeployment(production(), t.deps);
  assert.deepEqual(t.sent.map((s) => s.text), [
    "Live: https://www.kumarp.in/weekly/009-salonjaa-nap\nLive: https://www.kumarp.in/weekly/010-brand-name",
  ]);
  assert.equal(t.sent[0].opts, undefined);
});

test("the production deploy of a merged non-draft PR sends nothing (Review Focus 3)", async () => {
  const t = setup({ prs: [mergedPr({ labels: [], head: "feat/x" })], forSha: { merge21: [21] } });
  await notifyDeployment(production(), t.deps);
  assert.deepEqual(t.sent, []);
});

test("a production deploy of some other commit, or a failed one, sends nothing", async () => {
  const other = setup({ prs: [mergedPr({ mergeSha: "somethingelse" })], forSha: { merge21: [21] } });
  await notifyDeployment(production(), other.deps);
  assert.deepEqual(other.sent, []);
  const failed = setup({ prs: [mergedPr()], forSha: { merge21: [21] } });
  await notifyDeployment(production({ state: "failure" }), failed.deps);
  assert.deepEqual(failed.sent, []);
});

test("an environment that is neither Preview nor Production sends nothing", async () => {
  const t = setup({ forSha: { head21: [21] } });
  await notifyDeployment(preview({ environment: "Staging" }), t.deps);
  assert.deepEqual(t.sent, []);
});

test("a draft open for 21 hours gets a reminder with its preview link and buttons", async () => {
  const t = setup({ prs: [pr({ createdAt: hoursAgo(21) })], previewUrl: "https://p-21.vercel.app" });
  await notifyReminders(t.deps);
  assert.equal(t.sent.length, 1);
  assert.ok(t.sent[0].text.startsWith("Still waiting: Weekly #009, PR #21, open 21 hours"));
  assert.ok(t.sent[0].text.includes("Preview: https://p-21.vercel.app"));
  assert.deepEqual(t.sent[0].opts, { keyboard: draftKeyboard(21) });
});

test("a draft open for 5 hours gets no reminder", async () => {
  const t = setup({ prs: [pr({ createdAt: hoursAgo(5) })] });
  await notifyReminders(t.deps);
  assert.deepEqual(t.sent, []);
});

// ---- LinkedIn (part c) ----

const LI_URL = (n: number) => `https://www.linkedin.com/feed/update/urn:li:share:${n}/`;
const liResult = (key: string, label: string, siteUrl: string, over: Partial<PostResult> = {}): PostResult => ({
  key, label, siteUrl, status: "posted", linkedinUrl: LI_URL(1), reason: null, retry: false, reconnect: false, ...over,
});
const SITE_9 = "https://www.kumarp.in/weekly/009-salonjaa-nap";
const SITE_10 = "https://www.kumarp.in/weekly/010-brand-name";
const KEY_9 = "weekly-009-salonjaa-nap";
const KEY_10 = "weekly-010-brand-name";

function fakeClient(over: Partial<LinkedInClient> = {}) {
  const posted: [number, string][] = [];
  const client: LinkedInClient = {
    post: async (n, sha) => {
      posted.push([n, sha]);
      return { results: [liResult(KEY_9, "Post 009", SITE_9), liResult(KEY_10, "Post 010", SITE_10, { linkedinUrl: LI_URL(2) })], connectUrl: null };
    },
    remind: async () => "not connected",
    ...over,
  };
  return { client, posted };
}
const liWorld = () => setup({ prs: [mergedPr()], forSha: { merge21: [21] }, files: { [PATH_9]: post("009"), [PATH_10]: post("010") } });

test("with LinkedIn set up, the live message shows both links per post and the log line counts them", async () => {
  const t = liWorld();
  const li = fakeClient();
  const line = await notifyDeployment(production(), { ...t.deps, linkedin: li.client });
  assert.deepEqual(t.sent.map((s) => s.text), [
    `Live: ${SITE_9}\nOn LinkedIn: ${LI_URL(1)}\n\nLive: ${SITE_10}\nOn LinkedIn: ${LI_URL(2)}`,
  ]);
  assert.equal(t.sent[0].opts, undefined);
  assert.deepEqual(li.posted, [[21, "merge21"]]);
  assert.equal(line, "sent: live PR #21 (LinkedIn: 2 posted, 0 skipped, 0 failed)");
});

test("a failed LinkedIn post is reported with the reconnect link and a Retry button", async () => {
  const t = liWorld();
  const li = fakeClient({
    post: async () => ({
      results: [
        liResult(KEY_9, "Post 009", SITE_9),
        liResult(KEY_10, "Post 010", SITE_10, { status: "failed", linkedinUrl: null, reason: "LinkedIn token expired", retry: true, reconnect: true }),
      ],
      connectUrl: "https://www.kumarp.in/api/linkedin/connect?state=ab",
    }),
  });
  const line = await notifyDeployment(production(), { ...t.deps, linkedin: li.client });
  assert.equal(t.sent[0].text,
    `Live: ${SITE_9}\nOn LinkedIn: ${LI_URL(1)}\n\nLive: ${SITE_10}\nLinkedIn failed for "Post 010": LinkedIn token expired` +
    "\n\nReconnect LinkedIn: https://www.kumarp.in/api/linkedin/connect?state=ab");
  assert.deepEqual(t.sent[0].opts, { keyboard: retryKeyboard(21) });
  assert.equal(line, "sent: live PR #21 (LinkedIn: 1 posted, 0 skipped, 1 failed)");
});

test("a replayed Publish says the posts are already on LinkedIn (Review Focus 2)", async () => {
  const t = liWorld();
  const li = fakeClient({
    post: async () => ({
      results: [
        liResult(KEY_9, "Post 009", SITE_9, { status: "skipped" }),
        liResult(KEY_10, "Post 010", SITE_10, { status: "skipped", linkedinUrl: LI_URL(2) }),
      ],
      connectUrl: null,
    }),
  });
  await notifyDeployment(production(), { ...t.deps, linkedin: li.client });
  assert.equal(t.sent[0].text,
    `Live: ${SITE_9}\nAlready on LinkedIn: ${LI_URL(1)}\n\nLive: ${SITE_10}\nAlready on LinkedIn: ${LI_URL(2)}`);
  assert.equal(t.sent[0].opts, undefined);
});

test("when the LinkedIn route cannot be reached the live message still goes out, with a Retry button", async () => {
  const t = liWorld();
  const li = fakeClient({ post: async () => { throw new Error("LinkedIn post route → 503"); } });
  await notifyDeployment(production(), { ...t.deps, linkedin: li.client });
  assert.ok(t.sent[0].text.startsWith(`Live: ${SITE_9}\nLinkedIn failed for "Post 009": LinkedIn request failed`));
  assert.ok(t.sent[0].text.includes(`Live: ${SITE_10}\nLinkedIn failed for "Post 010"`));
  assert.deepEqual(t.sent[0].opts, { keyboard: retryKeyboard(21) });
});

test("without a LinkedIn client the live message is the plain one", async () => {
  const t = liWorld();
  await notifyDeployment(production(), t.deps);
  assert.equal(t.sent[0].text, `Live: ${SITE_9}\nLive: ${SITE_10}`);
});

test("the daily reminders also ask the LinkedIn route, and report its note in the log line", async () => {
  const t = setup({ prs: [pr({ createdAt: hoursAgo(21) })], previewUrl: "https://p-21.vercel.app" });
  const line = await notifyReminders({ ...t.deps, linkedin: fakeClient().client });
  assert.equal(t.sent.length, 1);
  assert.equal(line, "sent: reminders for PR #21; LinkedIn: not connected");
  const none = setup({ prs: [pr({ createdAt: hoursAgo(5) })] });
  assert.equal(await notifyReminders({ ...none.deps, linkedin: fakeClient().client }), "skip: no draft waiting; LinkedIn: not connected");
});

test("a failing LinkedIn reminder call never costs the draft reminders", async () => {
  const t = setup({ prs: [pr({ createdAt: hoursAgo(21) })], previewUrl: "https://p-21.vercel.app" });
  const li = fakeClient({ remind: async () => { throw new Error("LinkedIn remind route → 500"); } });
  const line = await notifyReminders({ ...t.deps, linkedin: li.client });
  assert.equal(t.sent.length, 1);
  assert.equal(line, "sent: reminders for PR #21; LinkedIn remind failed: LinkedIn remind route → 500");
});

test("a log issue is sent as an escaped bold title and body, then closed", async () => {
  const t = setup({ issue: { title: "blog <run> & co: no PR", body: "A draft is already open." } });
  await notifyLogIssue(31, t.deps);
  assert.deepEqual(t.sent.map((s) => s.text), ["<b>blog &lt;run&gt; &amp; co: no PR</b>\nA draft is already open."]);
  assert.deepEqual(t.calls.filter((c) => c.name === "closeIssue").map((c) => c.args), [[31]]);
});

test("a log issue is only closed after it was sent", async () => {
  const t = setup();
  t.deps.tg.sendMessage = async () => { throw new Error("Telegram sendMessage → 500"); };
  await assert.rejects(notifyLogIssue(31, t.deps), { message: "Telegram sendMessage → 500" });
  assert.equal(t.calls.filter((c) => c.name === "closeIssue").length, 0);
});

test("an edit failure comment is forwarded with its PR", async () => {
  const t = setup();
  await notifyEditFailed(21, "Edit failed: check:content still fails", t.deps);
  assert.deepEqual(t.sent.map((s) => s.text), [REPLY.editFailed(21, "Edit failed: check:content still fails")]);
  assert.deepEqual(t.sent.map((s) => s.text), ["PR #21: Edit failed: check:content still fails"]);
});

test("an Edit failed comment on a PR that is not a draft is not forwarded", async () => {
  const t = setup({ prs: [pr({ labels: [], head: "feat/x" })] });
  await notifyEditFailed(21, "Edit failed: spam", t.deps);
  assert.deepEqual(t.sent, []);
});
