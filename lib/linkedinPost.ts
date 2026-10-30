// Posts a merged draft's posts to LinkedIn, one by one, oldest first, and tells
// how the token is doing. Adapters (LinkedIn, Redis, the cover download) are
// injected, so the tests run it with fakes. A post is recorded the moment it is
// created, so a replay or a Retry never posts it twice. No message built here holds
// a token or a URL with one.

import { LinkedInError } from "./linkedinApi.ts";
import type { LinkedInApi } from "./linkedinApi.ts";
import { linkedinText } from "./linkedinCaption.ts";
import type { LinkedInStore, TokenRecord } from "./linkedinStore.ts";

export type PostInput = { key: string; label: string; caption: string; siteUrl: string; coverUrl: string };

export type PostResult = {
  key: string;
  label: string;
  siteUrl: string;
  status: "posted" | "skipped" | "failed";
  linkedinUrl: string | null; // posted, skipped
  reason: string | null; // failed: short, no secret
  retry: boolean; // failed and worth another try
  reconnect: boolean; // failed because of the token
};

export type PostDeps = {
  api: LinkedInApi;
  store: LinkedInStore;
  fetchCover(url: string): Promise<Uint8Array>;
  now: Date;
};

export type TokenStatus =
  | { state: "none" }
  | { state: "expired" }
  | { state: "ok"; expiresAt: Date; daysLeft: number };

export const feedUrl = (urn: string) => `https://www.linkedin.com/feed/update/${urn}/`;

const DAY_MS = 86_400_000;
const REASON_MAX = 200;
const NOT_ATTEMPTED = "not attempted after an earlier failure";

const firstLine = (e: unknown) => (e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, REASON_MAX);

/** What is worth doing after an error: try again, and whether the token is the cause. */
function classify(e: unknown): { retry: boolean; reconnect: boolean } {
  if (e instanceof LinkedInError) {
    if (e.kind === "auth") return { retry: true, reconnect: true };
    return { retry: e.kind === "unavailable", reconnect: false };
  }
  return { retry: true, reconnect: false };
}

export async function postToLinkedIn(posts: PostInput[], deps: PostDeps): Promise<PostResult[]> {
  const { api, store, fetchCover, now } = deps;
  // Weekly slugs start with their number, so key order is oldest first.
  const ordered = [...posts].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  let token: TokenRecord | null = null;
  let tokenError: unknown = null;
  try {
    token = await store.getToken();
  } catch (e) {
    tokenError = e;
  }

  const failed = (p: PostInput, reason: string, flags: { retry: boolean; reconnect?: boolean }): PostResult => ({
    key: p.key, label: p.label, siteUrl: p.siteUrl, status: "failed", linkedinUrl: null,
    reason, retry: flags.retry, reconnect: flags.reconnect ?? false,
  });

  // A token that cannot be used fails every post that still needs posting, for that reason.
  const tokenProblem: { reason: string; reconnect: boolean } | null = tokenError
    ? { reason: firstLine(tokenError), reconnect: false }
    : !token
      ? { reason: "LinkedIn is not connected", reconnect: true }
      : !(Date.parse(token.expiresAt) > now.getTime())
        ? { reason: "LinkedIn token expired", reconnect: true }
        : null;

  async function create(p: PostInput, token: TokenRecord): Promise<PostResult> {
    let commentary: string;
    try {
      commentary = linkedinText(p.caption, p.siteUrl);
    } catch (e) {
      return failed(p, firstLine(e), { retry: false });
    }

    let bytes: Uint8Array;
    try {
      bytes = await fetchCover(p.coverUrl);
    } catch (e) {
      const reason = firstLine(e);
      return failed(p, reason.startsWith("cover") ? reason : `cover: ${reason}`, { retry: true });
    }

    let postUrn: string;
    try {
      const imageUrn = await api.uploadImage({ accessToken: token.accessToken, personUrn: token.personUrn, bytes });
      postUrn = await api.createPost({ accessToken: token.accessToken, personUrn: token.personUrn, commentary, imageUrn });
    } catch (e) {
      return failed(p, firstLine(e), classify(e));
    }

    const url = feedUrl(postUrn);
    try {
      await store.setPosted(p.key, { postUrn, url, at: now.toISOString() });
    } catch {
      return failed(p, "posted but not recorded", { retry: true });
    }
    return { key: p.key, label: p.label, siteUrl: p.siteUrl, status: "posted", linkedinUrl: url, reason: null, retry: false, reconnect: false };
  }

  const results: PostResult[] = [];
  let stopped = false;
  for (const p of ordered) {
    let prior;
    try {
      prior = await store.getPosted(p.key);
    } catch (e) {
      results.push(failed(p, firstLine(e), { retry: true }));
      stopped = true;
      continue;
    }
    if (prior) {
      results.push({ key: p.key, label: p.label, siteUrl: p.siteUrl, status: "skipped", linkedinUrl: prior.url, reason: null, retry: false, reconnect: false });
      continue;
    }
    if (tokenProblem || !token) {
      results.push(failed(p, tokenProblem?.reason ?? "LinkedIn is not connected", { retry: true, reconnect: tokenProblem?.reconnect ?? true }));
      continue;
    }
    if (stopped) {
      results.push(failed(p, NOT_ATTEMPTED, { retry: true }));
      continue;
    }
    const result = await create(p, token);
    results.push(result);
    // A retryable failure ends the run so LinkedIn never gets a later post before an earlier one.
    if (result.status === "failed" && result.retry) stopped = true;
  }
  return results;
}

export async function tokenStatus(store: Pick<LinkedInStore, "getToken">, now: Date): Promise<TokenStatus> {
  const token = await store.getToken();
  if (!token) return { state: "none" };
  const expires = Date.parse(token.expiresAt);
  if (!(expires > now.getTime())) return { state: "expired" };
  return { state: "ok", expiresAt: new Date(expires), daysLeft: Math.ceil((expires - now.getTime()) / DAY_MS) };
}

/** The bytes of a post's cover from the live site. Only JPEG and PNG are accepted. */
export async function fetchCoverBytes(url: string, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch {
    throw new Error("cover request failed");
  }
  if (!res.ok) throw new Error(`cover → ${res.status}`);
  if (!/^image\/(jpeg|png)/.test(res.headers.get("content-type") ?? "")) throw new Error("cover is not an image");
  return new Uint8Array(await res.arrayBuffer());
}
