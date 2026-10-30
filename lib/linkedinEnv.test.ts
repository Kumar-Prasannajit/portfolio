import test from "node:test";
import assert from "node:assert/strict";
import { linkedinFromEnv } from "./linkedinEnv.ts";

const REDIS = { UPSTASH_REDIS_REST_URL: "https://r.example", UPSTASH_REDIS_REST_TOKEN: "t" };
const CLIENT = { LINKEDIN_CLIENT_ID: "cid", LINKEDIN_CLIENT_SECRET: "csecret" };

test("linkedinFromEnv is null unless the client id, client secret and Redis are all set", () => {
  assert.equal(linkedinFromEnv({}), null);
  assert.equal(linkedinFromEnv({ ...REDIS }), null);
  assert.equal(linkedinFromEnv({ ...CLIENT }), null);
  assert.equal(linkedinFromEnv({ ...REDIS, LINKEDIN_CLIENT_ID: "cid" }), null);
  assert.equal(linkedinFromEnv({ ...REDIS, LINKEDIN_CLIENT_SECRET: "csecret" }), null);
});

test("linkedinFromEnv wires the site's callback URL and the client id", () => {
  const li = linkedinFromEnv({ ...REDIS, ...CLIENT });
  assert.ok(li);
  const url = new URL(li.api.authorizeUrl("s1"));
  assert.equal(url.searchParams.get("client_id"), "cid");
  assert.equal(url.searchParams.get("redirect_uri"), "https://www.kumarp.in/api/linkedin/callback");
  assert.equal(li.core.api, li.api);
  assert.equal(li.core.store, li.store);
  assert.ok(Math.abs(li.core.now().getTime() - Date.now()) < 5000);
});
