import test from "node:test";
import assert from "node:assert/strict";
import { LINKEDIN_VERSION, LinkedInError, linkedinApi } from "./linkedinApi.ts";

const CFG = { clientId: "cid", clientSecret: "csecret", redirectUri: "https://www.kumarp.in/api/linkedin/callback" };
const TOKEN = "at-secret";
const PERSON = "urn:li:person:abc";

type Call = { url: string; method: string; headers: Headers; body: unknown };

/** A fetch that answers from `responses` in order (an Error is thrown) and records every request. */
function fake(...responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const impl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? "GET", headers: new Headers(init?.headers), body: init?.body });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next ?? new Response(null, { status: 500 });
  };
  return { impl, calls };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const kindOf = (e: unknown) => (e instanceof LinkedInError ? e.kind : "not a LinkedInError");

test("authorizeUrl asks for the code flow with the three scopes", () => {
  const url = new URL(linkedinApi(CFG, fake().impl).authorizeUrl("s1"));
  assert.equal(url.origin + url.pathname, "https://www.linkedin.com/oauth/v2/authorization");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "cid");
  assert.equal(url.searchParams.get("redirect_uri"), CFG.redirectUri);
  assert.equal(url.searchParams.get("state"), "s1");
  assert.equal(url.searchParams.get("scope"), "openid profile w_member_social");
});

test("exchangeCode posts the form and returns the token and its lifetime", async () => {
  const f = fake(json({ access_token: "at1", expires_in: 5184000 }));
  assert.deepEqual(await linkedinApi(CFG, f.impl).exchangeCode("c1"), { accessToken: "at1", expiresIn: 5184000 });
  const [call] = f.calls;
  assert.equal(call.url, "https://www.linkedin.com/oauth/v2/accessToken");
  assert.equal(call.method, "POST");
  assert.equal(call.headers.get("content-type"), "application/x-www-form-urlencoded");
  const form = new URLSearchParams(String(call.body));
  assert.deepEqual(Object.fromEntries(form), {
    grant_type: "authorization_code", code: "c1", client_id: "cid", client_secret: "csecret", redirect_uri: CFG.redirectUri,
  });
});

test("memberId reads the userinfo subject with the bearer token", async () => {
  const f = fake(json({ sub: "abc", name: "K" }));
  assert.equal(await linkedinApi(CFG, f.impl).memberId(TOKEN), "abc");
  assert.equal(f.calls[0].url, "https://api.linkedin.com/v2/userinfo");
  assert.equal(f.calls[0].headers.get("authorization"), `Bearer ${TOKEN}`);
});

test("uploadImage initialises the upload for the person, then PUTs the bytes", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const f = fake(
    json({ value: { uploadUrl: "https://www.linkedin.com/dms-uploads/x", image: "urn:li:image:I1", uploadUrlExpiresAt: 1 } }),
    new Response(null, { status: 201 }),
  );
  assert.equal(await linkedinApi(CFG, f.impl).uploadImage({ accessToken: TOKEN, personUrn: PERSON, bytes }), "urn:li:image:I1");
  const [init, put] = f.calls;
  assert.equal(init.url, "https://api.linkedin.com/rest/images?action=initializeUpload");
  assert.equal(init.method, "POST");
  assert.equal(init.headers.get("authorization"), `Bearer ${TOKEN}`);
  assert.equal(init.headers.get("x-restli-protocol-version"), "2.0.0");
  assert.equal(init.headers.get("linkedin-version"), LINKEDIN_VERSION);
  assert.deepEqual(JSON.parse(String(init.body)), { initializeUploadRequest: { owner: PERSON } });
  assert.equal(put.url, "https://www.linkedin.com/dms-uploads/x");
  assert.equal(put.method, "PUT");
  assert.equal(put.headers.get("authorization"), `Bearer ${TOKEN}`);
  assert.equal(put.headers.get("content-type"), null);
  assert.equal(put.body, bytes);
});

test("uploadImage never sends the token to an upload URL outside linkedin.com", async () => {
  const f = fake(json({ value: { uploadUrl: "https://evil.example/x", image: "urn:li:image:I1" } }));
  await assert.rejects(
    linkedinApi(CFG, f.impl).uploadImage({ accessToken: TOKEN, personUrn: PERSON, bytes: new Uint8Array(1) }),
    (e) => kindOf(e) === "rejected",
  );
  assert.equal(f.calls.length, 1);
});

test("uploadImage: a failing PUT is unavailable", async () => {
  const f = fake(
    json({ value: { uploadUrl: "https://www.linkedin.com/dms-uploads/x", image: "urn:li:image:I1" } }),
    new Response(null, { status: 500 }),
  );
  await assert.rejects(
    linkedinApi(CFG, f.impl).uploadImage({ accessToken: TOKEN, personUrn: PERSON, bytes: new Uint8Array(1) }),
    (e) => kindOf(e) === "unavailable" && (e as Error).message === "LinkedIn image upload → 500",
  );
});

test("createPost sends the image post and returns the post id header", async () => {
  const f = fake(new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:99" } }));
  const urn = await linkedinApi(CFG, f.impl).createPost({ accessToken: TOKEN, personUrn: PERSON, commentary: "Hi", imageUrn: "urn:li:image:I1" });
  assert.equal(urn, "urn:li:share:99");
  const [call] = f.calls;
  assert.equal(call.url, "https://api.linkedin.com/rest/posts");
  assert.equal(call.method, "POST");
  assert.equal(call.headers.get("authorization"), `Bearer ${TOKEN}`);
  assert.equal(call.headers.get("x-restli-protocol-version"), "2.0.0");
  assert.equal(call.headers.get("linkedin-version"), LINKEDIN_VERSION);
  assert.deepEqual(JSON.parse(String(call.body)), {
    author: PERSON,
    commentary: "Hi",
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    content: { media: { id: "urn:li:image:I1" } },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  });
});

test("createPost: a 201 without the post id header is rejected", async () => {
  const f = fake(new Response(null, { status: 201 }));
  await assert.rejects(
    linkedinApi(CFG, f.impl).createPost({ accessToken: TOKEN, personUrn: PERSON, commentary: "Hi", imageUrn: "urn:li:image:I1" }),
    (e) => kindOf(e) === "rejected",
  );
});

test("statuses map to auth, unavailable or rejected", async () => {
  const want: Record<number, string> = { 401: "auth", 403: "auth", 429: "unavailable", 500: "unavailable", 503: "unavailable", 400: "rejected", 422: "rejected" };
  for (const [status, kind] of Object.entries(want)) {
    const f = fake(new Response(null, { status: Number(status) }));
    await assert.rejects(
      linkedinApi(CFG, f.impl).createPost({ accessToken: TOKEN, personUrn: PERSON, commentary: "Hi", imageUrn: "urn:li:image:I1" }),
      (e) => kindOf(e) === kind && (e as Error).message === `LinkedIn createPost → ${status}`,
      `status ${status}`,
    );
  }
});

test("a thrown fetch is unavailable and its message is not repeated", async () => {
  const f = fake(new Error(`connect ECONNREFUSED https://api.linkedin.com Bearer ${TOKEN}`));
  await assert.rejects(
    linkedinApi(CFG, f.impl).createPost({ accessToken: TOKEN, personUrn: PERSON, commentary: "Hi", imageUrn: "urn:li:image:I1" }),
    (e) => kindOf(e) === "unavailable" && (e as Error).message === "LinkedIn createPost failed",
  );
});

test("no error message holds the token, the client secret or the code", async () => {
  const f = fake(new Response("denied csecret c1 at-secret", { status: 400 }));
  await assert.rejects(linkedinApi(CFG, f.impl).exchangeCode("c1"), (e) => {
    const m = (e as Error).message;
    return m === "LinkedIn token exchange → 400" && !/csecret|c1|at-secret/.test(m);
  });
});
