import test from "node:test";
import assert from "node:assert/strict";
import { LinkedInError } from "./linkedinApi.ts";
import { connectUrl } from "./linkedinDraft.ts";
import type { LinkedInCore } from "./linkedinDraft.ts";
import { handleCallback, handleConnect, handlePost, handleRemind } from "./linkedinHandlers.ts";
import {
  NOW, PATH_9, TOKEN_RECORD, fakeApi, fakeGitHub, fakeTelegram, memoryStore, mergedPr,
} from "./linkedinFakes.testutil.ts";
import { REPLY } from "./telegram.ts";

const SECRET = "shared-secret";
const CHAT = "4242";
const DAY = 86_400_000;
const STATE_1 = "0".repeat(31) + "1";

function setup(opts: { token?: Parameters<typeof memoryStore>[0]; api?: Parameters<typeof fakeApi>[0]; gh?: Parameters<typeof fakeGitHub>[0] } = {}) {
  const m = "token" in opts ? memoryStore(opts.token) : memoryStore();
  const a = fakeApi(opts.api);
  const g = fakeGitHub(opts.gh);
  const t = fakeTelegram();
  const core: LinkedInCore = { api: a.api, store: m.store, fetchCover: async () => new Uint8Array([1]), now: () => NOW };
  return { m, a, g, t, core };
}

const tokenIn = (ms: number) => ({ ...TOKEN_RECORD, expiresAt: new Date(NOW.getTime() + ms).toISOString() });
// `serverSecret` null means the secret is unset on the server.
const post = (s: ReturnType<typeof setup>, body: unknown, secretHeader: string | null = SECRET, serverSecret: string | null = SECRET) =>
  handlePost({ secretHeader, body }, { secret: serverSecret ?? undefined, gh: s.g.gh, core: s.core });

// ---- handlePost ----

test("handlePost rejects every call when the secret is unset on the server, whatever the header", async () => {
  for (const header of [null, "", SECRET]) {
    const s = setup();
    const res = await post(s, { pr: 21, sha: "abc1234" }, header, null);
    assert.equal(res.status, 401);
    assert.deepEqual(s.a.calls, []);
  }
  const s = setup();
  assert.equal((await post(s, { pr: 21, sha: "abc1234" }, "", "")).status, 401);
});

test("handlePost rejects a wrong or missing secret before reading anything", async () => {
  const s = setup();
  assert.equal((await post(s, { pr: 21, sha: "abc1234" }, "nope")).status, 401);
  assert.equal((await post(s, { pr: 21, sha: "abc1234" }, null)).status, 401);
  assert.deepEqual(s.g.reads, []);
  assert.deepEqual(s.a.calls, []);
});

test("handlePost rejects a malformed body", async () => {
  for (const body of [null, "x", {}, { pr: "21", sha: "abc1234" }, { pr: 0, sha: "abc1234" }, { pr: 21.5, sha: "abc1234" }, { pr: 21, sha: "zzzzzzz" }, { pr: 21, sha: "abc12" }]) {
    assert.equal((await post(setup(), body)).status, 400, JSON.stringify(body));
  }
});

test("handlePost refuses a PR that is not one of the bot's drafts", async () => {
  const s = setup({ gh: { prs: [mergedPr({ labels: [] })] } });
  assert.equal((await post(s, { pr: 21, sha: "abc1234" })).status, 403);
  assert.deepEqual(s.a.calls, []);
});

test("handlePost refuses an unmerged PR and a sha that is not the merge commit", async () => {
  const open = setup({ gh: { prs: [mergedPr({ merged: false, state: "open", mergeSha: null })] } });
  assert.equal((await post(open, { pr: 21, sha: "abc1234" })).status, 409);
  const other = setup();
  assert.equal((await post(other, { pr: 21, sha: "def5678" })).status, 409);
  assert.deepEqual(open.a.calls.concat(other.a.calls), []);
});

test("handlePost answers 502 when GitHub cannot be read", async () => {
  const s = setup({ gh: { failGetPr: true } });
  assert.equal((await post(s, { pr: 21, sha: "abc1234" })).status, 502);
});

test("handlePost posts the merged draft's posts, reading the files at the merge sha", async () => {
  const s = setup();
  const res = await post(s, { pr: 21, sha: "abc1234" });
  assert.equal(res.status, 200);
  const body = res.body as { results: { status: string }[]; connectUrl: string | null };
  assert.deepEqual(body.results.map((r) => r.status), ["posted"]);
  assert.equal(body.connectUrl, null);
  assert.deepEqual(s.g.reads, [`${PATH_9}@abc1234`]);
  assert.equal(s.a.created(), 1);
});

test("handlePost with no token answers 200 with failed results and a reconnect link", async () => {
  const s = setup({ token: null });
  const body = (await post(s, { pr: 21, sha: "abc1234" })).body as { results: { reconnect: boolean }[]; connectUrl: string | null };
  assert.equal(body.results[0].reconnect, true);
  assert.equal(body.connectUrl, connectUrl(STATE_1));
});

// ---- handleRemind ----

const remind = (s: ReturnType<typeof setup>, secretHeader: string | null = SECRET, serverSecret: string | null = SECRET) =>
  handleRemind({ secretHeader }, { secret: serverSecret ?? undefined, core: s.core, tg: s.t.tg, chatId: CHAT });

test("handleRemind rejects a wrong secret and an unset one", async () => {
  const s = setup();
  assert.equal((await remind(s, "nope")).status, 401);
  assert.equal((await remind(s, "", null)).status, 401);
  assert.equal((await remind(s, SECRET, null)).status, 401);
  assert.deepEqual(s.t.sent, []);
});

test("handleRemind stays quiet at 11 days and when LinkedIn was never connected", async () => {
  const far = setup({ token: tokenIn(11 * DAY) });
  assert.equal((await remind(far)).body.sent, false);
  const none = setup({ token: null });
  assert.equal((await remind(none)).body.sent, false);
  assert.deepEqual(far.t.sent.concat(none.t.sent), []);
});

test("handleRemind sends the reconnect message at 10 days, 3 days and 12 hours", async () => {
  for (const [ms, days] of [[10 * DAY, 10], [3 * DAY, 3], [DAY / 2, 1]] as const) {
    const s = setup({ token: tokenIn(ms) });
    const res = await remind(s);
    assert.equal(res.body.sent, true);
    assert.equal(s.t.sent[0].text, REPLY.linkedinReminder(days, connectUrl(STATE_1)));
    assert.ok(s.m.state.states.has(STATE_1));
  }
});

test("handleRemind says the token expired", async () => {
  const s = setup({ token: tokenIn(-1000) });
  assert.equal((await remind(s)).body.sent, true);
  assert.equal(s.t.sent[0].text, REPLY.linkedinExpired(connectUrl(STATE_1)));
});

// ---- handleConnect ----

test("handleConnect refuses a missing or unknown state", async () => {
  const s = setup();
  assert.deepEqual(await handleConnect(null, { store: s.m.store, api: s.a.api }), { status: 400 });
  assert.deepEqual(await handleConnect("f".repeat(32), { store: s.m.store, api: s.a.api }), { status: 400 });
});

test("handleConnect redirects a bot-issued state to LinkedIn and keeps the state for the callback", async () => {
  const s = setup();
  const state = await s.m.store.createState();
  assert.deepEqual(await handleConnect(state, { store: s.m.store, api: s.a.api }), { redirect: s.a.api.authorizeUrl(state) });
  assert.ok(s.m.state.states.has(state));
});

// ---- handleCallback ----

const callback = async (s: ReturnType<typeof setup>, q: { code?: string | null; state?: string | null; error?: string | null }) =>
  handleCallback({ code: "code123", state: null, error: null, ...q }, { store: s.m.store, api: s.a.api, tg: s.t.tg, chatId: CHAT, now: NOW });

test("handleCallback refuses a replayed or unknown state without exchanging the code", async () => {
  const s = setup({ token: null });
  const res = await callback(s, { state: "f".repeat(32) });
  assert.equal(res.status, 400);
  assert.match(res.html, /expired/);
  assert.deepEqual(s.a.calls, []);
  assert.equal(s.m.state.token, null);
});

test("handleCallback burns the state when LinkedIn reports an error", async () => {
  const s = setup({ token: null });
  const state = await s.m.store.createState();
  const res = await callback(s, { state, code: null, error: "user_cancelled_login" });
  assert.equal(res.status, 400);
  assert.ok(!s.m.state.states.has(state));
  assert.deepEqual(s.a.calls, []);
});

test("handleCallback stores the token with its expiry and tells the owner", async () => {
  const s = setup({ token: null });
  const state = await s.m.store.createState();
  const res = await callback(s, { state });
  assert.equal(res.status, 200);
  assert.match(res.html, /Connected/);
  assert.deepEqual(s.m.state.token, { accessToken: "new-token", expiresAt: "2026-12-29T10:00:00.000Z", personUrn: "urn:li:person:abc" });
  assert.equal(s.t.sent[0].text, REPLY.linkedinConnected("2026-12-29"));
  assert.ok(!s.m.state.states.has(state));
  // the same state cannot be used twice
  assert.equal((await callback(s, { state })).status, 400);
});

test("handleCallback renews the token for the same member", async () => {
  const s = setup();
  const state = await s.m.store.createState();
  assert.equal((await callback(s, { state })).status, 200);
  assert.equal(s.m.state.token?.accessToken, "new-token");
});

test("handleCallback refuses a different member and leaves the stored token alone", async () => {
  const s = setup({ api: { sub: "someone-else" } });
  const state = await s.m.store.createState();
  const res = await callback(s, { state });
  assert.equal(res.status, 409);
  assert.deepEqual(s.m.state.token, TOKEN_RECORD);
  assert.equal(s.t.sent[0].text, REPLY.linkedinDifferentAccount);
});

test("handleCallback answers 502 when the exchange fails, without a token or code in the page or message", async () => {
  const s = setup({ token: null, api: { exchangeFails: new LinkedInError("LinkedIn token exchange → 400", "rejected") } });
  const state = await s.m.store.createState();
  const res = await callback(s, { state });
  assert.equal(res.status, 502);
  assert.match(res.html, /Try again from the bot/);
  assert.equal(s.t.sent[0].text, "Failed: LinkedIn token exchange → 400");
  assert.ok(!/code123|new-token|at-secret/.test(res.html + s.t.sent[0].text));
  assert.equal(s.m.state.token, null);
});
