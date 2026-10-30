import test from "node:test";
import assert from "node:assert/strict";
import { storeFromEnv, upstashStore } from "./linkedinStore.ts";

const CONN = { url: "https://redis.example/", token: "tok-secret" };
const TOKEN = { accessToken: "at", expiresAt: "2026-12-28T10:00:00.000Z", personUrn: "urn:li:person:abc" };
const POSTED = { postUrn: "urn:li:share:1", url: "https://www.linkedin.com/feed/update/urn:li:share:1/", at: "2026-10-30T10:00:00.000Z" };

/** A fetch that answers `{ result }` from `results`, in order, and records every request. */
function fake(results: unknown[] = [], status = 200) {
  const requests: { url: string; method?: string; auth: string | null; command: unknown[] }[] = [];
  const impl: typeof fetch = async (url, init) => {
    const headers = new Headers(init?.headers);
    requests.push({ url: String(url), method: init?.method, auth: headers.get("authorization"), command: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ result: results.length ? results.shift() : null }), { status });
  };
  return { impl, requests };
}

test("getToken reads linkedin:token and parses it", async () => {
  const f = fake([JSON.stringify(TOKEN)]);
  assert.deepEqual(await upstashStore(CONN, f.impl).getToken(), TOKEN);
  assert.deepEqual(f.requests[0].command, ["GET", "linkedin:token"]);
});

test("getToken is null for a missing, malformed or incomplete value", async () => {
  assert.equal(await upstashStore(CONN, fake([null]).impl).getToken(), null);
  assert.equal(await upstashStore(CONN, fake(["{nope"]).impl).getToken(), null);
  assert.equal(await upstashStore(CONN, fake([JSON.stringify({ accessToken: "at" })]).impl).getToken(), null);
});

test("setToken and setPosted write JSON under their keys", async () => {
  const f = fake();
  const store = upstashStore(CONN, f.impl);
  await store.setToken(TOKEN);
  await store.setPosted("weekly-009-a", POSTED);
  assert.deepEqual(f.requests[0].command, ["SET", "linkedin:token", JSON.stringify(TOKEN)]);
  assert.deepEqual(f.requests[1].command, ["SET", "linkedin:posted:weekly-009-a", JSON.stringify(POSTED)]);
});

test("getPosted reads linkedin:posted:<key>", async () => {
  const f = fake([JSON.stringify(POSTED)]);
  assert.deepEqual(await upstashStore(CONN, f.impl).getPosted("weekly-009-a"), POSTED);
  assert.deepEqual(f.requests[0].command, ["GET", "linkedin:posted:weekly-009-a"]);
});

test("createState stores a random 32-hex state for 900 seconds", async () => {
  const f = fake();
  const store = upstashStore(CONN, f.impl);
  const a = await store.createState();
  const b = await store.createState();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
  assert.deepEqual(f.requests[0].command, ["SET", `linkedin:state:${a}`, "1", "EX", "900"]);
});

test("hasState and burnState answer from EXISTS and DEL", async () => {
  const f = fake([1, 0, 1, 0]);
  const store = upstashStore(CONN, f.impl);
  assert.equal(await store.hasState("s1"), true);
  assert.equal(await store.hasState("s1"), false);
  assert.equal(await store.burnState("s1"), true);
  assert.equal(await store.burnState("s1"), false);
  assert.deepEqual(f.requests.map((r) => r.command), [
    ["EXISTS", "linkedin:state:s1"], ["EXISTS", "linkedin:state:s1"], ["DEL", "linkedin:state:s1"], ["DEL", "linkedin:state:s1"],
  ]);
});

test("every request is a bearer POST to the base URL without its trailing slash", async () => {
  const f = fake();
  await upstashStore(CONN, f.impl).setToken(TOKEN);
  assert.equal(f.requests[0].url, "https://redis.example");
  assert.equal(f.requests[0].method, "POST");
  assert.equal(f.requests[0].auth, "Bearer tok-secret");
});

test("errors name the status only, never the token", async () => {
  await assert.rejects(upstashStore(CONN, fake([], 500).impl).getToken(), (e: Error) => e.message === "Upstash → 500");
  const boom: typeof fetch = async () => { throw new Error("connect ECONNREFUSED https://redis.example tok-secret"); };
  await assert.rejects(upstashStore(CONN, boom).getToken(), (e: Error) => !e.message.includes("tok-secret") && !e.message.includes("redis.example"));
});

test("storeFromEnv needs a URL and a token, from either spelling", () => {
  assert.equal(storeFromEnv({}), null);
  assert.equal(storeFromEnv({ UPSTASH_REDIS_REST_URL: "https://r" }), null);
  assert.notEqual(storeFromEnv({ UPSTASH_REDIS_REST_URL: "https://r", UPSTASH_REDIS_REST_TOKEN: "t" }), null);
  assert.notEqual(storeFromEnv({ KV_REST_API_URL: "https://r", KV_REST_API_TOKEN: "t" }), null);
});
