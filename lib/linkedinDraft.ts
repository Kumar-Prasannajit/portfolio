// Turns a merged draft PR into LinkedIn posts and posts them. Shared by the post
// route (lib/linkedinHandlers.ts) and the bot's Retry button (lib/telegramBot.ts),
// so it imports neither of them.

import { postUrl } from "./draftPost.ts";
import type { DraftPr, PrInfo } from "./draftPost.ts";
import type { LinkedInApi } from "./linkedinApi.ts";
import { postToLinkedIn } from "./linkedinPost.ts";
import type { PostInput, PostResult } from "./linkedinPost.ts";
import type { LinkedInStore } from "./linkedinStore.ts";
import { SITE_URL } from "./site.ts";

export type LinkedInCore = {
  api: LinkedInApi;
  store: LinkedInStore;
  fetchCover(url: string): Promise<Uint8Array>;
  now(): Date;
};

/** The one-tap link that starts the OAuth flow for a state the bot issued. */
export const connectUrl = (state: string) => `${SITE_URL}/api/linkedin/connect?state=${state}`;

/** One LinkedIn post per post in the draft: its caption, its link, its cover (else the generated OG image). */
export function postInputs(draft: DraftPr): PostInput[] {
  return draft.posts.map((p) => ({
    key: `${p.kind}-${p.slug}`,
    label: p.title || p.slug,
    caption: p.linkedin,
    siteUrl: postUrl(p),
    coverUrl: p.coverImage ? `${SITE_URL}${p.coverImage}` : `${postUrl(p)}/opengraph-image`,
  }));
}

/** Posts a merged draft; when the token is the problem, also issues the reconnect link. */
export async function postMergedDraft(
  loaded: { pr: PrInfo; draft: DraftPr },
  core: LinkedInCore,
): Promise<{ results: PostResult[]; connectUrl: string | null }> {
  const results = await postToLinkedIn(postInputs(loaded.draft), {
    api: core.api,
    store: core.store,
    fetchCover: core.fetchCover,
    now: core.now(),
  });
  let link: string | null = null;
  if (results.some((r) => r.reconnect)) {
    try {
      link = connectUrl(await core.store.createState());
    } catch {
      link = null; // Redis is down too: the results still say what happened
    }
  }
  return { results, connectUrl: link };
}
