import test from "node:test";
import assert from "node:assert/strict";
import { linkedinClient } from "./linkedinClient.ts";

const SECRET = "s3cret-value";

type Call = { url: string; method?: string; headers: Headers; body: unknown };

function fake(...responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const impl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method, headers: new Headers(init?.headers), body: init?.body });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next ?? new Response("{}", { status: 200 });
  };
  return { impl, calls };
}

const RESULT = {
  key: "weekly-009-a", label: "A", siteUrl: "https://www.kumarp.in/weekly/009-a", status: "posted",
  linkedinUrl: "https://www.linkedin.com/feed/update/urn:li:share:1/", reason: null, retry: false, reconnect: false,
};

test("post sends { pr, sha } with the secret header to the site's post route", async () => {
  const f = fake(Response.json({ results: [RESULT], connectUrl: null }));
  const out = await linkedinClient(SECRET, undefined, f.impl).post(21, "abc1234");
  assert.deepEqual(out, { results: [RESULT], connectUrl: null });
  const [call] = f.calls;
  assert.equal(call.url, "https://www.kumarp.in/api/linkedin/post");
  assert.equal(call.method, "POST");
  assert.equal(call.headers.get("x-linkedin-post-secret"), SECRET);
  assert.equal(call.headers.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(String(call.body)), { pr: 21, sha: "abc1234" });
});

test("post passes the reconnect link through", async () => {
  const f = fake(Response.json({ results: [RESULT], connectUrl: "https://www.kumarp.in/api/linkedin/connect?state=ab" }));
  const out = await linkedinClient(SECRET, undefined, f.impl).post(21, "abc1234");
  assert.equal(out.connectUrl, "https://www.kumarp.in/api/linkedin/connect?state=ab");
});

test("remind posts to the remind route and returns its note", async () => {
  const f = fake(Response.json({ sent: false, note: "not connected" }));
  assert.equal(await linkedinClient(SECRET, "https://example.test/", f.impl).remind(), "not connected");
  assert.equal(f.calls[0].url, "https://example.test/api/linkedin/remind");
  assert.equal(f.calls[0].headers.get("x-linkedin-post-secret"), SECRET);
});

test("a refusing route throws the status, never the secret", async () => {
  await assert.rejects(linkedinClient(SECRET, undefined, fake(new Response("no", { status: 401 })).impl).post(21, "abc1234"),
    { message: "LinkedIn post route → 401" });
  await assert.rejects(linkedinClient(SECRET, undefined, fake(new Response("no", { status: 500 })).impl).remind(),
    { message: "LinkedIn remind route → 500" });
});

test("a thrown fetch is reported without repeating its message", async () => {
  const f = fake(new Error(`connect ECONNREFUSED https://www.kumarp.in ${SECRET}`));
  await assert.rejects(linkedinClient(SECRET, undefined, f.impl).post(21, "abc1234"),
    (e: Error) => e.message === "LinkedIn post route failed" && !e.message.includes(SECRET));
});

test("an answer that is not the expected shape is an error", async () => {
  await assert.rejects(linkedinClient(SECRET, undefined, fake(Response.json({ nope: 1 })).impl).post(21, "abc1234"),
    { message: "LinkedIn post route → unexpected response" });
  await assert.rejects(linkedinClient(SECRET, undefined, fake(new Response("<html>")).impl).post(21, "abc1234"),
    { message: "LinkedIn post route → unexpected response" });
});
