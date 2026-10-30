// Where the LinkedIn side keeps its state: the access token, a record per post
// already on LinkedIn, and the one-time OAuth state. Upstash Redis over its REST
// API (the same database lib/viewCount.ts uses), `fetch` injected so tests can fake
// it. Errors name the status only; the Redis token never reaches a message.

import { randomBytes } from "node:crypto";

export type TokenRecord = { accessToken: string; expiresAt: string; personUrn: string };
export type PostedRecord = { postUrn: string; url: string; at: string };

export type LinkedInStore = {
  getToken(): Promise<TokenRecord | null>;
  setToken(t: TokenRecord): Promise<void>;
  getPosted(key: string): Promise<PostedRecord | null>; // key = "<kind>-<slug>"
  setPosted(key: string, r: PostedRecord): Promise<void>;
  createState(): Promise<string>; // 32 hex chars, stored for 900 s
  hasState(s: string): Promise<boolean>;
  burnState(s: string): Promise<boolean>; // true only if it existed
};

const STATE_TTL_SECONDS = 900;

const isString = (v: unknown): v is string => typeof v === "string";

function parseJson(raw: unknown): Record<string, unknown> | null {
  if (!isString(raw)) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v === "object" && v !== null && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export function upstashStore(conn: { url: string; token: string }, fetchImpl: typeof fetch = fetch): LinkedInStore {
  const base = conn.url.replace(/\/$/, "");

  async function redis(command: string[]): Promise<unknown> {
    let res: Response;
    try {
      res = await fetchImpl(base, {
        method: "POST",
        headers: { authorization: `Bearer ${conn.token}`, "content-type": "application/json" },
        body: JSON.stringify(command),
        cache: "no-store",
      });
    } catch {
      throw new Error("Upstash request failed"); // the underlying error may quote the URL
    }
    if (!res.ok) throw new Error(`Upstash → ${res.status}`);
    const json = (await res.json().catch(() => null)) as { result?: unknown; error?: string } | null;
    if (!json || json.error) throw new Error("Upstash command failed");
    return json.result ?? null;
  }

  const posted = (key: string) => `linkedin:posted:${key}`;
  const state = (s: string) => `linkedin:state:${s}`;

  return {
    async getToken() {
      const v = parseJson(await redis(["GET", "linkedin:token"]));
      if (!v || !isString(v.accessToken) || !isString(v.expiresAt) || !isString(v.personUrn)) return null;
      return { accessToken: v.accessToken, expiresAt: v.expiresAt, personUrn: v.personUrn };
    },

    async setToken(t) {
      await redis(["SET", "linkedin:token", JSON.stringify(t)]);
    },

    async getPosted(key) {
      const v = parseJson(await redis(["GET", posted(key)]));
      if (!v || !isString(v.postUrn) || !isString(v.url) || !isString(v.at)) return null;
      return { postUrn: v.postUrn, url: v.url, at: v.at };
    },

    async setPosted(key, r) {
      await redis(["SET", posted(key), JSON.stringify(r)]);
    },

    async createState() {
      const s = randomBytes(16).toString("hex");
      await redis(["SET", state(s), "1", "EX", String(STATE_TTL_SECONDS)]);
      return s;
    },

    async hasState(s) {
      return Number(await redis(["EXISTS", state(s)])) === 1;
    },

    async burnState(s) {
      return Number(await redis(["DEL", state(s)])) === 1;
    },
  };
}

/** The store for this deployment, or null when Redis is not configured. */
export function storeFromEnv(env: Record<string, string | undefined> = process.env): LinkedInStore | null {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? upstashStore({ url, token }) : null;
}
