import test from "node:test";
import assert from "node:assert/strict";
import {
  coverPath, isBotCommit, isDraftPr, loadDraft, pleaseCheck, postDraft, postFiles, postUrl,
  requiredChecksGreen, withCoverImage, type PostDraft, type PrInfo,
} from "./draftPost.ts";

const WEEKLY_PATH = "content/weekly/009-salonjaa-nap.mdx";
const WEEKLY_SRC = `---
title: "Salonjaa NAP fixes"
date: "2026-10-25"
summary: "A quiet week."
cover: "09"
linkedin: |
  A quiet week, but two fixes saved a bad evening.

  #buildinpublic
---

Body text.
`;
const BLOG_SRC = `---
title: "Allowlist, not denylist"
date: "2026-10-20"
tags: ["automation"]
excerpt: "Why the bot reads an allowlist."
linkedin: |
  Caption.
---

Body.
`;
const weekly009 = (): PostDraft => postDraft(WEEKLY_PATH, WEEKLY_SRC);

// PR #21's body, trimmed to the parts the parser reads.
const PR_BODY = `Two short weekly posts.

## Sources

- not a check item

## Please check

- #009: "the commit message doesn't say what changed in the markup."
- #010: "the same-entity reasoning is my inference."
- Collector errors: none.

## LinkedIn caption

### #009

A quiet week.
`;

test("isDraftPr needs the draft-post label and a draft/ head", () => {
  assert.equal(isDraftPr({ labels: ["draft-post"], head: "draft/weekly-009" }), true);
  assert.equal(isDraftPr({ labels: [], head: "draft/weekly-009" }), false);
  assert.equal(isDraftPr({ labels: ["draft-post"], head: "feat/x" }), false);
});

test("postFiles keeps added and modified posts only", () => {
  const changed = [
    { filename: "content/weekly/009-a.mdx", status: "added" },
    { filename: "content/blog/b.mdx", status: "modified" },
    { filename: "content/weekly/008-old.mdx", status: "removed" },
    { filename: "content/ideas.md", status: "modified" },
    { filename: "public/x.jpg", status: "added" },
  ];
  assert.deepEqual(postFiles(changed), ["content/weekly/009-a.mdx", "content/blog/b.mdx"]);
});

test("postDraft reads a weekly's fields from its file", () => {
  assert.deepEqual(weekly009(), {
    kind: "weekly", path: WEEKLY_PATH, slug: "009-salonjaa-nap", number: "009",
    title: "Salonjaa NAP fixes", summary: "A quiet week.",
    linkedin: "A quiet week, but two fixes saved a bad evening.\n\n#buildinpublic",
  });
});

test("postDraft takes a blog's summary from excerpt and has no number", () => {
  const post = postDraft("content/blog/allowlist.mdx", BLOG_SRC);
  assert.equal(post.kind, "blog");
  assert.equal(post.slug, "allowlist");
  assert.equal(post.number, null);
  assert.equal(post.summary, "Why the bot reads an allowlist.");
});

test("pleaseCheck returns the bullets of the Please check section", () => {
  assert.deepEqual(pleaseCheck(PR_BODY), [
    `#009: "the commit message doesn't say what changed in the markup."`,
    `#010: "the same-entity reasoning is my inference."`,
    "Collector errors: none.",
  ]);
});

test("pleaseCheck is empty for nothing flagged or no section", () => {
  assert.deepEqual(pleaseCheck("Intro\n\n## Please check\n\nnothing flagged\n\n## LinkedIn caption\n\n- x"), []);
  assert.deepEqual(pleaseCheck("Intro\n\n## Sources\n\n- a"), []);
});

test("coverPath names the file after kind and slug", () => {
  assert.deepEqual(coverPath(weekly009(), "jpg"), {
    file: "public/covers/weekly-009-salonjaa-nap.jpg",
    url: "/covers/weekly-009-salonjaa-nap.jpg",
  });
});

test("withCoverImage adds coverImage as the last frontmatter line", () => {
  const out = withCoverImage(WEEKLY_SRC, "/covers/x.jpg");
  assert.equal(out, WEEKLY_SRC.replace("\n---\n\nBody", '\ncoverImage: "/covers/x.jpg"\n---\n\nBody'));
});

test("withCoverImage replaces an existing column-0 coverImage line", () => {
  const first = withCoverImage(WEEKLY_SRC, "/covers/x.jpg");
  const second = withCoverImage(first, "/covers/y.png");
  assert.equal(second, withCoverImage(WEEKLY_SRC, "/covers/y.png"));
  assert.equal(second.match(/coverImage:/g)?.length, 1);
});

test("withCoverImage leaves an indented coverImage inside the linkedin block alone", () => {
  const src = WEEKLY_SRC.replace("  #buildinpublic", "  coverImage: not a field\n  #buildinpublic");
  const out = withCoverImage(src, "/covers/x.jpg");
  assert.ok(out.includes("  coverImage: not a field\n"));
  assert.equal(out.match(/^coverImage:/gm)?.length, 1);
});

test("withCoverImage changes nothing but that one line", () => {
  const out = withCoverImage(WEEKLY_SRC, "/covers/x.jpg");
  assert.equal(out.replace('coverImage: "/covers/x.jpg"\n', ""), WEEKLY_SRC);
  const replaced = withCoverImage(out, "/covers/y.png");
  assert.equal(replaced.replace('coverImage: "/covers/y.png"\n', ""), WEEKLY_SRC);
});

test("requiredChecksGreen needs the check run and the Vercel status both green", () => {
  const ok = [{ name: "check", conclusion: "success" }];
  const vercel = [{ context: "Vercel", state: "success" }];
  assert.equal(requiredChecksGreen(ok, vercel), true);
  assert.equal(requiredChecksGreen([{ name: "check", conclusion: null }], vercel), false);
  assert.equal(requiredChecksGreen([{ name: "check", conclusion: "failure" }], vercel), false);
  assert.equal(requiredChecksGreen([], vercel), false);
  assert.equal(requiredChecksGreen(ok, [{ context: "Vercel", state: "pending" }]), false);
  assert.equal(requiredChecksGreen(ok, []), false);
});

test("isBotCommit recognises the bot's and the edit routine's commits", () => {
  assert.equal(isBotCommit("Cover for #21"), true);
  assert.equal(isBotCommit("Edit #21: shorter intro"), true);
  assert.equal(isBotCommit("Draft weekly #009"), false);
});

test("postUrl is the live address of the post", () => {
  assert.equal(postUrl(weekly009()), "https://www.kumarp.in/weekly/009-salonjaa-nap");
  assert.equal(postUrl(postDraft("content/blog/allowlist.mdx", BLOG_SRC)), "https://www.kumarp.in/blog/allowlist");
});

const pr = (over: Partial<PrInfo> = {}): PrInfo => ({
  number: 21, state: "open", merged: false, labels: ["draft-post"], head: "draft/weekly-009",
  headSha: "abc123", body: PR_BODY, createdAt: "2026-10-29T04:00:00Z", mergeSha: null, ...over,
});
const fakeGh = (info: PrInfo, files: Record<string, string>) => {
  const reads: string[] = [];
  return {
    reads,
    gh: {
      getPr: async () => info,
      prFiles: async () => Object.keys(files).map((filename) => ({ filename, status: "added" })),
      fileAt: async (path: string, ref: string) => { reads.push(`${path}@${ref}`); return files[path]; },
    },
  };
};

test("loadDraft returns null for a PR that is not a draft", async () => {
  const { gh } = fakeGh(pr({ labels: [] }), {});
  assert.equal(await loadDraft(gh, 21), null);
});

test("loadDraft lists posts in file order with the checks from the body", async () => {
  const { gh, reads } = fakeGh(pr(), { [WEEKLY_PATH]: WEEKLY_SRC, "content/weekly/010-b.mdx": WEEKLY_SRC });
  const loaded = await loadDraft(gh, 21);
  assert.ok(loaded);
  assert.deepEqual(loaded.draft.posts.map((p) => p.path), [WEEKLY_PATH, "content/weekly/010-b.mdx"]);
  assert.equal(loaded.draft.checks.length, 3);
  assert.equal(loaded.draft.branch, "draft/weekly-009");
  assert.equal(loaded.draft.headSha, "abc123");
  assert.deepEqual(reads, [`${WEEKLY_PATH}@abc123`, "content/weekly/010-b.mdx@abc123"]);
});

test("loadDraft reads the files at a given ref", async () => {
  const { gh, reads } = fakeGh(pr(), { [WEEKLY_PATH]: WEEKLY_SRC });
  await loadDraft(gh, 21, "def456");
  assert.deepEqual(reads, [`${WEEKLY_PATH}@def456`]);
});
