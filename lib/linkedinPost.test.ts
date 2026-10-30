import test from "node:test";
import assert from "node:assert/strict";
import { LinkedInError } from "./linkedinApi.ts";
import type { LinkedInApi } from "./linkedinApi.ts";
import { linkedinText } from "./linkedinCaption.ts";
import { feedUrl, fetchCoverBytes, postToLinkedIn, tokenStatus } from "./linkedinPost.ts";
import type { PostInput } from "./linkedinPost.ts";
import type { LinkedInStore, PostedRecord, TokenRecord } from "./linkedinStore.ts";

const NOW = new Date("2026-10-30T10:00:00Z");
const TOKEN: TokenRecord = { accessToken: "at", expiresAt: "2026-12-28T10:00:00.000Z", personUrn: "urn:li:person:abc" };
const A = "weekly-009-a";
const B = "weekly-010-b";
const C = "weekly-011-c";

const post = (key: string, over: Partial<PostInput> = {}): PostInput => ({
  key, label: `Post ${key}`, caption: `Caption ${key}.`,
  siteUrl: `https://www.kumarp.in/weekly/${key}`, coverUrl: `https://www.kumarp.in/covers/${key}.jpg`, ...over,
});

type Opts = {
  token?: TokenRecord | null;
  createFails?: Record<number, Error>; // by 1-based createPost call
  coverFails?: Error;
  failSetPosted?: boolean;
};

function setup(opts: Opts = {}) {
  const calls: { name: string; arg?: any }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const posted = new Map<string, PostedRecord>();
  let created = 0;
  const token = "token" in opts ? opts.token : TOKEN;
  const unexpected = async () => { throw new Error("unexpected"); };

  const store: LinkedInStore = {
    getToken: async () => token ?? null,
    setToken: unexpected,
    getPosted: async (key) => posted.get(key) ?? null,
    setPosted: async (key, r) => {
      if (opts.failSetPosted) throw new Error("Upstash → 500");
      calls.push({ name: "setPosted", arg: key });
      posted.set(key, r);
    },
    createState: unexpected, hasState: unexpected, burnState: unexpected,
  };
  const api: LinkedInApi = {
    authorizeUrl: () => { throw new Error("unexpected"); },
    exchangeCode: unexpected, memberId: unexpected,
    uploadImage: async (arg) => { calls.push({ name: "uploadImage", arg }); return `urn:li:image:${calls.length}`; },
    createPost: async (arg) => {
      created += 1;
      calls.push({ name: "createPost", arg });
      const fail = opts.createFails?.[created];
      if (fail) throw fail;
      return `urn:li:share:${created}`;
    },
  };
  const covers: string[] = [];
  const fetchCover = async (url: string) => {
    covers.push(url);
    if (opts.coverFails) throw opts.coverFails;
    return new Uint8Array([9, 9]);
  };
  const deps = { api, store, fetchCover, now: NOW };
  const names = () => calls.map((c) => c.name);
  return { deps, calls, posted, covers, names };
}

const commentaries = (calls: { name: string; arg?: any }[]) => // eslint-disable-line @typescript-eslint/no-explicit-any
  calls.filter((c) => c.name === "createPost").map((c) => c.arg.commentary);

test("posts go to LinkedIn in key order whatever order they arrive in", async () => {
  const t = setup();
  const results = await postToLinkedIn([post(B), post(A)], t.deps);
  assert.deepEqual(results.map((r) => r.key), [A, B]);
  assert.deepEqual(commentaries(t.calls), [linkedinText(`Caption ${A}.`, post(A).siteUrl), linkedinText(`Caption ${B}.`, post(B).siteUrl)]);
});

test("a post already recorded is skipped with its stored url and touches nothing", async () => {
  const t = setup();
  t.posted.set(A, { postUrn: "urn:li:share:7", url: "https://www.linkedin.com/feed/update/urn:li:share:7/", at: "x" });
  const [r] = await postToLinkedIn([post(A)], t.deps);
  assert.equal(r.status, "skipped");
  assert.equal(r.linkedinUrl, "https://www.linkedin.com/feed/update/urn:li:share:7/");
  assert.deepEqual(t.names(), []);
  assert.deepEqual(t.covers, []);
});

test("a post is created from the cover and caption, then recorded", async () => {
  const t = setup();
  const [r] = await postToLinkedIn([post(A)], t.deps);
  assert.deepEqual(t.covers, [post(A).coverUrl]);
  const upload = t.calls.find((c) => c.name === "uploadImage")!.arg;
  assert.deepEqual(upload, { accessToken: "at", personUrn: "urn:li:person:abc", bytes: new Uint8Array([9, 9]) });
  const create = t.calls.find((c) => c.name === "createPost")!.arg;
  assert.equal(create.commentary, linkedinText(`Caption ${A}.`, post(A).siteUrl));
  assert.equal(create.imageUrn, "urn:li:image:1");
  assert.deepEqual(t.names(), ["uploadImage", "createPost", "setPosted"]);
  assert.deepEqual(t.posted.get(A), { postUrn: "urn:li:share:1", url: feedUrl("urn:li:share:1"), at: NOW.toISOString() });
  assert.equal(r.status, "posted");
  assert.equal(r.linkedinUrl, feedUrl("urn:li:share:1"));
});

test("no token, and an expired token, fail every post with a reconnect and no calls", async () => {
  for (const token of [null, { ...TOKEN, expiresAt: "2026-10-30T09:59:59.000Z" }]) {
    const t = setup({ token });
    const results = await postToLinkedIn([post(A), post(B)], t.deps);
    assert.deepEqual(results.map((r) => [r.status, r.retry, r.reconnect]), [["failed", true, true], ["failed", true, true]]);
    assert.deepEqual(t.names(), []);
    assert.deepEqual(t.covers, []);
  }
});

test("an empty caption fails by name, posts no bare link, and the next post still goes", async () => {
  const t = setup();
  const results = await postToLinkedIn([post(A, { caption: "  " }), post(B)], t.deps);
  assert.equal(results[0].status, "failed");
  assert.equal(results[0].retry, false);
  assert.equal(results[0].label, `Post ${A}`);
  assert.match(results[0].reason ?? "", /^no LinkedIn caption/);
  assert.equal(results[1].status, "posted");
  assert.equal(commentaries(t.calls).length, 1);
});

test("a caption over 3000 characters is a permanent failure that names the count", async () => {
  const t = setup();
  const [r] = await postToLinkedIn([post(A, { caption: "a".repeat(3000) })], t.deps);
  assert.equal(r.status, "failed");
  assert.equal(r.retry, false);
  assert.match(r.reason ?? "", /characters/);
  assert.deepEqual(t.names(), []);
});

test("LinkedIn refusing the token on the second post keeps the first and asks to reconnect", async () => {
  const t = setup({ createFails: { 2: new LinkedInError("LinkedIn createPost → 401", "auth") } });
  const results = await postToLinkedIn([post(A), post(B)], t.deps);
  assert.deepEqual(results.map((r) => r.status), ["posted", "failed"]);
  assert.equal(results[1].reconnect, true);
  assert.equal(results[1].retry, true);
  assert.equal(results[1].reason, "LinkedIn createPost → 401");
  assert.ok(t.posted.has(A));
  assert.ok(!t.posted.has(B));
});

test("after a retryable failure the later posts are not attempted, in order", async () => {
  const t = setup({ createFails: { 2: new LinkedInError("LinkedIn createPost → 401", "auth") } });
  const results = await postToLinkedIn([post(A), post(B), post(C)], t.deps);
  assert.deepEqual(results.map((r) => r.status), ["posted", "failed", "failed"]);
  assert.equal(results[2].reason, "not attempted after an earlier failure");
  assert.equal(results[2].retry, true);
  assert.equal(results[2].reconnect, false);
  assert.equal(commentaries(t.calls).length, 2);
});

test("an unavailable LinkedIn is retryable without a reconnect; a rejected post is not retryable", async () => {
  const down = setup({ createFails: { 1: new LinkedInError("LinkedIn createPost → 503", "unavailable") } });
  const [d] = await postToLinkedIn([post(A)], down.deps);
  assert.deepEqual([d.retry, d.reconnect], [true, false]);
  const bad = setup({ createFails: { 1: new LinkedInError("LinkedIn createPost → 422", "rejected") } });
  const [b] = await postToLinkedIn([post(A)], bad.deps);
  assert.deepEqual([b.retry, b.reconnect], [false, false]);
});

test("a cover that cannot be fetched fails the post and posts nothing", async () => {
  const t = setup({ coverFails: new Error("cover → 404") });
  const [r] = await postToLinkedIn([post(A)], t.deps);
  assert.equal(r.status, "failed");
  assert.match(r.reason ?? "", /^cover/);
  assert.equal(r.retry, true);
  assert.deepEqual(t.names(), []);
});

test("a post created but not recorded is reported, and may be retried", async () => {
  const t = setup({ failSetPosted: true });
  const [r] = await postToLinkedIn([post(A)], t.deps);
  assert.equal(r.status, "failed");
  assert.equal(r.reason, "posted but not recorded");
  assert.equal(r.retry, true);
  assert.equal(commentaries(t.calls).length, 1);
});

test("running the same posts twice creates each once; the replay is all skipped", async () => {
  const t = setup();
  await postToLinkedIn([post(A), post(B)], t.deps);
  const again = await postToLinkedIn([post(A), post(B)], t.deps);
  assert.deepEqual(again.map((r) => r.status), ["skipped", "skipped"]);
  assert.equal(commentaries(t.calls).length, 2);
});

test("a replay after the token expired still reports the recorded posts as on LinkedIn", async () => {
  const t = setup();
  await postToLinkedIn([post(A)], t.deps);
  const expired = { ...t.deps, store: { ...t.deps.store, getToken: async () => null } };
  const [r] = await postToLinkedIn([post(A)], expired);
  assert.equal(r.status, "skipped");
});

test("tokenStatus: none, expired, and the days left rounded up", async () => {
  const day = 86_400_000;
  const withExpiry = (ms: number) => ({ getToken: async () => ({ ...TOKEN, expiresAt: new Date(NOW.getTime() + ms).toISOString() }) });
  assert.deepEqual(await tokenStatus({ getToken: async () => null }, NOW), { state: "none" });
  assert.deepEqual(await tokenStatus(withExpiry(0), NOW), { state: "expired" });
  assert.deepEqual(await tokenStatus(withExpiry(-1000), NOW), { state: "expired" });
  for (const [ms, days] of [[11 * day, 11], [10 * day, 10], [day / 2, 1]] as const) {
    const s = await tokenStatus(withExpiry(ms), NOW);
    assert.equal(s.state === "ok" && s.daysLeft, days);
  }
});

test("fetchCoverBytes returns the bytes of a png or jpeg", async () => {
  const f: typeof fetch = async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } });
  assert.deepEqual(await fetchCoverBytes("https://x/y.png", f), new Uint8Array([1, 2, 3]));
});

test("fetchCoverBytes refuses a missing file and a page that is not an image", async () => {
  const missing: typeof fetch = async () => new Response("no", { status: 404 });
  await assert.rejects(fetchCoverBytes("https://x/y.png", missing), { message: "cover → 404" });
  const html: typeof fetch = async () => new Response("<p>", { status: 200, headers: { "content-type": "text/html" } });
  await assert.rejects(fetchCoverBytes("https://x/y.png", html), { message: "cover is not an image" });
});
