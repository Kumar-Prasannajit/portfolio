import test from "node:test";
import assert from "node:assert/strict";
import { postDraft } from "./draftPost.ts";
import type { DraftPr } from "./draftPost.ts";
import { connectUrl, postInputs, postMergedDraft } from "./linkedinDraft.ts";
import type { LinkedInCore } from "./linkedinDraft.ts";
import { NOW, PATH_9, PATH_10, fakeApi, memoryStore, mergedPr, postSource } from "./linkedinFakes.testutil.ts";

const draft = (...posts: ReturnType<typeof postDraft>[]): DraftPr => ({
  number: 21, branch: "draft/weekly-009", headSha: "head21", createdAt: "2026-10-29T06:08:04Z", checks: [], posts,
});

function core(token?: Parameters<typeof memoryStore>[0], apiOpts?: Parameters<typeof fakeApi>[0]) {
  const m = token === undefined ? memoryStore() : memoryStore(token);
  const a = fakeApi(apiOpts);
  const c: LinkedInCore = { api: a.api, store: m.store, fetchCover: async () => new Uint8Array([1]), now: () => NOW };
  return { c, m, a };
}

test("connectUrl points at the site's connect route with the state", () => {
  assert.equal(connectUrl("abc"), "https://www.kumarp.in/api/linkedin/connect?state=abc");
});

test("postInputs: key, label, caption and link per post; the generated OG image is the cover fallback", () => {
  assert.deepEqual(postInputs(draft(postDraft(PATH_9, postSource("009")))), [{
    key: "weekly-009-salonjaa-nap", label: "Post 009", caption: "Caption 009.",
    siteUrl: "https://www.kumarp.in/weekly/009-salonjaa-nap",
    coverUrl: "https://www.kumarp.in/weekly/009-salonjaa-nap/opengraph-image",
  }]);
});

test("postInputs uses the post's own coverImage when it has one, and handles a blog", () => {
  const weekly = postDraft(PATH_9, postSource("009", { coverImage: "/covers/weekly-009-salonjaa-nap.jpg" }));
  const blog = postDraft("content/blog/allowlist.mdx", postSource("B"));
  const [w, b] = postInputs(draft(weekly, blog));
  assert.equal(w.coverUrl, "https://www.kumarp.in/covers/weekly-009-salonjaa-nap.jpg");
  assert.equal(b.key, "blog-allowlist");
  assert.equal(b.siteUrl, "https://www.kumarp.in/blog/allowlist");
  assert.equal(b.coverUrl, "https://www.kumarp.in/blog/allowlist/opengraph-image");
});

test("postMergedDraft posts every post and asks for no reconnect when the token is fine", async () => {
  const t = core();
  const loaded = { pr: mergedPr(), draft: draft(postDraft(PATH_9, postSource("009")), postDraft(PATH_10, postSource("010"))) };
  const out = await postMergedDraft(loaded, t.c);
  assert.deepEqual(out.results.map((r) => r.status), ["posted", "posted"]);
  assert.equal(out.connectUrl, null);
  assert.equal(t.m.state.made, 0);
});

test("postMergedDraft attaches a reconnect link, with a live state, when the token is the problem", async () => {
  const t = core(null);
  const out = await postMergedDraft({ pr: mergedPr(), draft: draft(postDraft(PATH_9, postSource("009"))) }, t.c);
  assert.equal(out.results[0].reconnect, true);
  assert.equal(out.connectUrl, connectUrl("0".repeat(31) + "1"));
  assert.ok(t.m.state.states.has("0".repeat(31) + "1"));
});

test("postMergedDraft still answers when the reconnect state cannot be stored", async () => {
  const t = core(null);
  t.c.store.createState = async () => { throw new Error("Upstash → 500"); };
  const out = await postMergedDraft({ pr: mergedPr(), draft: draft(postDraft(PATH_9, postSource("009"))) }, t.c);
  assert.equal(out.connectUrl, null);
  assert.equal(out.results[0].status, "failed");
});
