// Wires this deployment's env vars to the LinkedIn adapters, for the routes. null
// means LinkedIn is not set up here (no client id/secret, or no Redis), which the
// routes and the bot report as "not configured" instead of failing.

import { linkedinApi } from "./linkedinApi.ts";
import type { LinkedInApi } from "./linkedinApi.ts";
import type { LinkedInCore } from "./linkedinDraft.ts";
import { fetchCoverBytes } from "./linkedinPost.ts";
import { storeFromEnv } from "./linkedinStore.ts";
import type { LinkedInStore } from "./linkedinStore.ts";
import { SITE_URL } from "./site.ts";

export function linkedinFromEnv(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): { api: LinkedInApi; store: LinkedInStore; core: LinkedInCore } | null {
  const clientId = env.LINKEDIN_CLIENT_ID;
  const clientSecret = env.LINKEDIN_CLIENT_SECRET;
  const store = storeFromEnv(env);
  if (!clientId || !clientSecret || !store) return null;
  const api = linkedinApi({ clientId, clientSecret, redirectUri: `${SITE_URL}/api/linkedin/callback` }, fetchImpl);
  return {
    api,
    store,
    core: { api, store, fetchCover: (url) => fetchCoverBytes(url, fetchImpl), now: () => new Date() },
  };
}
