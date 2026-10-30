import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleUpdate, secretMatches } from "./telegramBot.ts";
import { REPLY, retryKeyboard } from "./telegram.ts";
import { LinkedInError } from "./linkedinApi.ts";
import { connectUrl } from "./linkedinDraft.ts";
import type { LinkedInCore } from "./linkedinDraft.ts";
import { NOW, TOKEN_RECORD, fakeApi, memoryStore } from "./linkedinFakes.testutil.ts";
import type { PrInfo } from "./draftPost.ts";
import type { GitHubRepo } from "./githubWrite.ts";
import type { TelegramApi } from "./telegramApi.ts";

const CHAT = "4242";
const WEEKLY_PATH = "content/weekly/009-salonjaa-nap.mdx";
const COVER_FILE = "public/covers/weekly-009-salonjaa-nap.jpg";
const WEEKLY_SRC = `---
title: "Salonjaa NAP fixes"
date: "2026-10-25"
summary: "A quiet week."
cover: "09"
linkedin: |
  Caption.
---

Body.
`;
const GREEN = {
  runs: [{ name: "check", conclusion: "success" as string | null }],
  statuses: [{ context: "Vercel", state: "success" }],
};
const PENDING = {
  runs: [{ name: "check", conclusion: null as string | null }],
  statuses: [{ context: "Vercel", state: "pending" }],
};

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../scripts/fixtures/telegram/${name}.json`, import.meta.url), "utf8"));

const pr = (over: Partial<PrInfo> = {}): PrInfo => ({
  number: 21, state: "open", merged: false, labels: ["draft-post"], head: "draft/weekly-009",
  headSha: "head21", body: "## Please check\n\n- one claim\n", createdAt: "2026-10-27T00:00:00Z",
  mergeSha: null, ...over,
});

type World = {
  prs?: PrInfo[];
  checks?: typeof GREEN;
  commits?: (string | null)[]; // what successive commitFiles calls return
  mergeError?: Error;
};
type Sent = { text: string; opts?: Parameters<TelegramApi["sendMessage"]>[2] };

function setup(world: World = {}) {
  const prs = world.prs ?? [pr()];
  const commits = [...(world.commits ?? [])];
  const calls: { name: string; args: unknown[] }[] = [];
  const sent: Sent[] = [];
  const answered: string[] = [];
  const downloads: string[] = [];
  const rec = (name: string, ...args: unknown[]) => calls.push({ name, args });
  const unexpected = (name: string) => async () => { throw new Error(`unexpected ${name}`); };

  const gh: GitHubRepo = {
    getPr: async (n) => {
      rec("getPr", n);
      const found = prs.find((p) => p.number === n);
      if (!found) throw new Error(`GitHub GET /pulls/${n} → 404`);
      return found;
    },
    prFiles: async () => [{ filename: WEEKLY_PATH, status: "added" }],
    fileAt: async () => WEEKLY_SRC,
    commitMessage: unexpected("commitMessage"),
    checks: async () => world.checks ?? GREEN,
    commitFiles: async (branch, files, message) => {
      rec("commitFiles", branch, files, message);
      return commits.length ? commits.shift()! : "newsha";
    },
    merge: async (n) => { rec("merge", n); if (world.mergeError) throw world.mergeError; },
    close: async (n) => { rec("close", n); },
    deleteBranch: async (b) => { rec("deleteBranch", b); },
    comment: async (n, body) => { rec("comment", n, body); },
    listOpenDrafts: async () => prs.filter((p) => p.state === "open" && p.labels.includes("draft-post") && p.head.startsWith("draft/")),
    prsForSha: unexpected("prsForSha"),
    previewUrl: unexpected("previewUrl"),
    issue: unexpected("issue"),
    closeIssue: unexpected("closeIssue"),
  };
  const tg: TelegramApi = {
    sendMessage: async (_chat, text, opts) => { sent.push({ text, opts }); },
    answerCallback: async (id) => { answered.push(id); },
    downloadFile: async (id) => { downloads.push(id); return { bytes: new Uint8Array([1, 2, 3]), filePath: "photos/f.jpg" }; },
  };
  const of = (name: string) => calls.filter((c) => c.name === name);
  return { deps: { gh, tg, chatId: CHAT }, calls, sent, answered, downloads, of, texts: () => sent.map((s) => s.text) };
}

const button = (data: string) => {
  const u = fixture("button-pub");
  u.callback_query.data = data;
  return u;
};

test("secretMatches compares the header to the secret", () => {
  assert.equal(secretMatches("s", "s"), true);
  assert.equal(secretMatches("x", "s"), false);
  assert.equal(secretMatches(null, "s"), false);
  assert.equal(secretMatches("s", undefined), false);
  assert.equal(secretMatches("", ""), false);
});

test("a stranger's update makes no GitHub or Telegram call", async () => {
  const t = setup();
  await handleUpdate(fixture("stranger"), t.deps);
  assert.deepEqual(t.calls, []);
  assert.deepEqual(t.sent, []);
  assert.deepEqual(t.answered, []);
});

test("a photo reply commits the cover and the coverImage frontmatter in one commit", async () => {
  const t = setup();
  await handleUpdate(fixture("photo-reply"), t.deps);
  const commits = t.of("commitFiles");
  assert.equal(commits.length, 1);
  const [branch, files, message] = commits[0].args as [string, { path: string; content: Uint8Array | string }[], string];
  assert.equal(branch, "draft/weekly-009");
  assert.equal(message, "Cover for #21");
  assert.deepEqual(files.map((f) => f.path), [COVER_FILE, WEEKLY_PATH]);
  assert.deepEqual([...(files[0].content as Uint8Array)], [1, 2, 3]);
  assert.ok((files[1].content as string).includes('coverImage: "/covers/weekly-009-salonjaa-nap.jpg"'));
  assert.deepEqual(t.texts(), [REPLY.coverAdded(21)]);
});

test("the same photo delivered twice makes no second cover (Review Focus 2)", async () => {
  const t = setup({ commits: ["commit1", null] });
  await handleUpdate(fixture("photo-reply"), t.deps);
  await handleUpdate(fixture("photo-reply"), t.deps);
  assert.deepEqual(t.texts(), [REPLY.coverAdded(21), REPLY.coverSame(21)]);
});

test("a photo that replies to nothing goes to the single open draft", async () => {
  const t = setup();
  await handleUpdate(fixture("photo-plain"), t.deps);
  assert.equal(t.of("commitFiles").length, 1);
  assert.deepEqual(t.texts(), [REPLY.coverAdded(21)]);
});

test("a photo with two open drafts and no reply asks which one", async () => {
  const t = setup({ prs: [pr(), pr({ number: 22, head: "draft/blog-x" })] });
  await handleUpdate(fixture("photo-plain"), t.deps);
  assert.deepEqual(t.texts(), [REPLY.twoDrafts]);
  assert.equal(t.of("commitFiles").length, 0);
});

test("a photo with no open draft says so", async () => {
  const t = setup({ prs: [] });
  await handleUpdate(fixture("photo-plain"), t.deps);
  assert.deepEqual(t.texts(), [REPLY.noDraft]);
  assert.equal(t.of("commitFiles").length, 0);
});

test("a GIF document asks for a photo and downloads nothing", async () => {
  const t = setup();
  await handleUpdate(fixture("document-gif"), t.deps);
  assert.deepEqual(t.texts(), [REPLY.resendPhoto]);
  assert.deepEqual(t.downloads, []);
  assert.equal(t.of("commitFiles").length, 0);
});

test("a document over 5 MB asks for a smaller one", async () => {
  const update = fixture("document-png");
  update.message.document.file_size = 5_000_001;
  const t = setup();
  await handleUpdate(update, t.deps);
  assert.deepEqual(t.texts(), [REPLY.resendPhoto]);
  assert.deepEqual(t.downloads, []);
});

test("a photo for a PR that is not a draft changes nothing", async () => {
  const t = setup({ prs: [pr({ number: 7, head: "feat/x", labels: [] })] });
  const update = fixture("photo-reply");
  update.message.reply_to_message.text = "Weekly #009 · PR #7";
  await handleUpdate(update, t.deps);
  assert.deepEqual(t.texts(), [REPLY.notOpen(7)]);
  assert.equal(t.of("commitFiles").length, 0);
});

test("Publish with checks pending does not merge", async () => {
  const t = setup({ checks: PENDING });
  await handleUpdate(button("pub:21"), t.deps);
  assert.deepEqual(t.answered, ["cb-1"]);
  assert.deepEqual(t.texts(), [REPLY.notGreen(21)]);
  assert.equal(t.of("merge").length, 0);
});

test("Publish with green checks merges and deletes the branch", async () => {
  const t = setup();
  await handleUpdate(button("pub:21"), t.deps);
  assert.deepEqual(t.of("merge").map((c) => c.args), [[21]]);
  assert.deepEqual(t.of("deleteBranch").map((c) => c.args), [["draft/weekly-009"]]);
  assert.deepEqual(t.texts(), [REPLY.merged(21)]);
});

test("a button on a merged PR never merges or closes it again (Review Focus 5)", async () => {
  const merged = pr({ state: "closed", merged: true, mergeSha: "m" });
  for (const data of ["pub:21", "rej:21", "edit:21"]) {
    const t = setup({ prs: [merged] });
    await handleUpdate(button(data), t.deps);
    assert.deepEqual(t.texts(), [REPLY.alreadyMerged(21)], data);
    assert.equal(t.of("merge").length + t.of("close").length + t.of("deleteBranch").length, 0, data);
  }
});

test("a button on a closed, unmerged PR says it is no longer open (Review Focus 5)", async () => {
  const closed = pr({ state: "closed" });
  for (const data of ["pub:21", "rej:21"]) {
    const t = setup({ prs: [closed] });
    await handleUpdate(button(data), t.deps);
    assert.deepEqual(t.texts(), [REPLY.notOpen(21)], data);
    assert.equal(t.of("merge").length + t.of("close").length, 0, data);
  }
});

test("a forged button naming a PR that is not a draft does nothing", async () => {
  const t = setup({ prs: [pr({ number: 7, head: "feat/x", labels: [] })] });
  await handleUpdate(button("pub:7"), t.deps);
  assert.deepEqual(t.texts(), [REPLY.notOpen(7)]);
  assert.equal(t.of("merge").length, 0);
});

test("Reject closes the PR and deletes its branch", async () => {
  const t = setup();
  await handleUpdate(button("rej:21"), t.deps);
  assert.deepEqual(t.of("close").map((c) => c.args), [[21]]);
  assert.deepEqual(t.of("deleteBranch").map((c) => c.args), [["draft/weekly-009"]]);
  assert.deepEqual(t.texts(), [REPLY.rejected(21)]);
});

test("Edit asks for the instruction with a forced reply, and the reply becomes an edit comment", async () => {
  const t = setup();
  await handleUpdate(button("edit:21"), t.deps);
  assert.deepEqual(t.sent, [{ text: REPLY.editAsk(21), opts: { forceReply: true } }]);

  const u = setup();
  await handleUpdate(fixture("edit-reply"), u.deps);
  assert.deepEqual(u.of("comment").map((c) => c.args), [[21, "edit: shorter intro"]]);
  assert.deepEqual(u.texts(), [REPLY.editQueued(21)]);
});

test("an edit instruction for a merged PR is not queued", async () => {
  const t = setup({ prs: [pr({ state: "closed", merged: true })] });
  await handleUpdate(fixture("edit-reply"), t.deps);
  assert.equal(t.of("comment").length, 0);
  assert.deepEqual(t.texts(), [REPLY.alreadyMerged(21)]);
});

test("plain text gets the help reply (Review Focus 4)", async () => {
  const t = setup();
  await handleUpdate(fixture("text-plain"), t.deps);
  assert.deepEqual(t.texts(), [REPLY.help]);
  assert.deepEqual(t.calls, []);
});

test("a GitHub failure becomes a one-line Failed reply", async () => {
  const t = setup({ mergeError: new Error("GitHub PUT /pulls/21/merge → 409") });
  await handleUpdate(button("pub:21"), t.deps);
  assert.deepEqual(t.texts(), ["Failed: GitHub PUT /pulls/21/merge → 409"]);
});

test("Failed carries only the first line of the error", async () => {
  const t = setup({ mergeError: new Error("first line\nsecond line") });
  await handleUpdate(button("pub:21"), t.deps);
  assert.deepEqual(t.texts(), ["Failed: first line"]);
});

// ---- LinkedIn (part c) ----

const merged = () => pr({ state: "closed", merged: true, mergeSha: "abc1234" });

function linkedin(opts: { token?: Parameters<typeof memoryStore>[0]; api?: Parameters<typeof fakeApi>[0] } = {}) {
  const m = "token" in opts ? memoryStore(opts.token) : memoryStore();
  const a = fakeApi(opts.api);
  const core: LinkedInCore = { api: a.api, store: m.store, fetchCover: async () => new Uint8Array([1]), now: () => NOW };
  return { core, m, a };
}
const withLi = (t: ReturnType<typeof setup>, li: ReturnType<typeof linkedin>) => ({ ...t.deps, linkedin: li.core });
const textMsg = (text: string) => {
  const u = fixture("text-plain");
  u.message.text = text;
  return u;
};
const FEED = (n: number) => `https://www.linkedin.com/feed/update/urn:li:share:${n}/`;

test("Retry LinkedIn on a merged draft posts what failed, never twice what succeeded", async () => {
  const t = setup({ prs: [merged()] });
  const li = linkedin({ api: { createFails: { 1: new LinkedInError("LinkedIn createPost → 503", "unavailable") } } });
  await handleUpdate(button("li:21"), withLi(t, li));
  await handleUpdate(button("li:21"), withLi(t, li));
  await handleUpdate(button("li:21"), withLi(t, li));
  assert.deepEqual(t.texts(), [
    'LinkedIn failed for "Salonjaa NAP fixes": LinkedIn createPost → 503',
    `On LinkedIn: ${FEED(2)}`,
    `Already on LinkedIn: ${FEED(2)}`,
  ]);
  assert.deepEqual(t.sent[0].opts, { keyboard: retryKeyboard(21) });
  assert.equal(t.sent[1].opts, undefined);
  assert.equal(li.a.created(), 2);
  assert.deepEqual(t.answered, ["cb-1", "cb-1", "cb-1"]);
});

test("Retry LinkedIn with a missing token attaches a reconnect link and the Retry button", async () => {
  const t = setup({ prs: [merged()] });
  const li = linkedin({ token: null });
  await handleUpdate(button("li:21"), withLi(t, li));
  assert.equal(t.sent[0].text,
    'LinkedIn failed for "Salonjaa NAP fixes": LinkedIn is not connected\n\n' +
    `Reconnect LinkedIn: ${connectUrl("0".repeat(31) + "1")}`);
  assert.deepEqual(t.sent[0].opts, { keyboard: retryKeyboard(21) });
  assert.equal(li.a.created(), 0);
});

test("Retry LinkedIn on a PR that is not merged says so and calls nothing", async () => {
  const t = setup();
  const li = linkedin();
  await handleUpdate(button("li:21"), withLi(t, li));
  assert.deepEqual(t.texts(), [REPLY.linkedinNotMerged(21)]);
  assert.deepEqual(li.a.calls, []);
});

test("Retry LinkedIn on a PR that is not a draft is refused", async () => {
  const t = setup({ prs: [{ ...merged(), labels: [] }] });
  const li = linkedin();
  await handleUpdate(button("li:21"), withLi(t, li));
  assert.deepEqual(t.texts(), [REPLY.notOpen(21)]);
  assert.deepEqual(li.a.calls, []);
});

test("Retry LinkedIn without LinkedIn configured says it is not set up", async () => {
  const t = setup({ prs: [merged()] });
  await handleUpdate(button("li:21"), t.deps);
  assert.deepEqual(t.texts(), [REPLY.linkedinOff]);
  assert.deepEqual(t.calls, []);
});

test("Retry LinkedIn with a GitHub failure ends in a Failed reply", async () => {
  const t = setup({ prs: [] });
  await handleUpdate(button("li:21"), withLi(t, linkedin()));
  assert.deepEqual(t.texts(), ["Failed: GitHub GET /pulls/21 → 404"]);
});

test("the word linkedin replies with the token status and a one-use connect link", async () => {
  const t = setup();
  const li = linkedin();
  await handleUpdate(textMsg("linkedin"), withLi(t, li));
  const state = "0".repeat(31) + "1";
  assert.deepEqual(t.texts(), [`LinkedIn: connected until ${TOKEN_RECORD.expiresAt.slice(0, 10)}.\nConnect LinkedIn: ${connectUrl(state)}`]);
  assert.ok(li.m.state.states.has(state));
});

test("the word linkedin says not connected when there is no token, and not set up without LinkedIn", async () => {
  const t = setup();
  await handleUpdate(textMsg("LinkedIn"), withLi(t, linkedin({ token: null })));
  assert.match(t.texts()[0], /^LinkedIn: not connected\.\nConnect LinkedIn: /);
  const bare = setup();
  await handleUpdate(textMsg("linkedin"), bare.deps);
  assert.deepEqual(bare.texts(), [REPLY.linkedinOff]);
});

test("linkedin as a reply to a draft message is still an edit instruction", async () => {
  const t = setup();
  const update = fixture("edit-reply");
  update.message.text = "linkedin";
  await handleUpdate(update, withLi(t, linkedin()));
  assert.deepEqual(t.of("comment").map((c) => c.args), [[21, "edit: linkedin"]]);
});
