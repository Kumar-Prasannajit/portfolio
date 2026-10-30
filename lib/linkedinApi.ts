// LinkedIn's OAuth and REST calls and nothing else: no decisions, `fetch` injected so
// tests can fake it. A failed call becomes a LinkedInError whose message names the
// call and the status only. The access token, the client secret, the OAuth code and
// any URL are never put in a message (the underlying error may quote them).

export const LINKEDIN_VERSION = "202610";

const OAUTH = "https://www.linkedin.com/oauth/v2";
const API = "https://api.linkedin.com";

export class LinkedInError extends Error {
  kind: "auth" | "unavailable" | "rejected";
  constructor(message: string, kind: LinkedInError["kind"]) {
    super(message);
    this.name = "LinkedInError";
    this.kind = kind;
  }
}

export type LinkedInApi = {
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<{ accessToken: string; expiresIn: number }>;
  memberId(accessToken: string): Promise<string>; // userinfo "sub"
  uploadImage(a: { accessToken: string; personUrn: string; bytes: Uint8Array }): Promise<string>; // urn:li:image:…
  createPost(a: { accessToken: string; personUrn: string; commentary: string; imageUrn: string }): Promise<string>; // x-restli-id
};

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const kindOf = (status: number): LinkedInError["kind"] =>
  status === 401 || status === 403 ? "auth" : status === 429 || status >= 500 ? "unavailable" : "rejected";

export function linkedinApi(
  cfg: { clientId: string; clientSecret: string; redirectUri: string },
  fetchImpl: typeof fetch = fetch,
): LinkedInApi {
  async function call(name: string, url: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetchImpl(url, init);
    } catch {
      throw new LinkedInError(`LinkedIn ${name} failed`, "unavailable");
    }
    if (!res.ok) throw new LinkedInError(`LinkedIn ${name} → ${res.status}`, kindOf(res.status));
    return res;
  }

  async function body(name: string, res: Response): Promise<Json> {
    const j = await res.json().catch(() => null);
    if (typeof j !== "object" || j === null) throw new LinkedInError(`LinkedIn ${name} → unexpected response`, "rejected");
    return j as Json;
  }

  const rest = (accessToken: string) => ({
    authorization: `Bearer ${accessToken}`,
    "x-restli-protocol-version": "2.0.0",
    "linkedin-version": LINKEDIN_VERSION,
    "content-type": "application/json",
  });

  /** The token is only ever sent to LinkedIn's own hosts. */
  const isLinkedInUrl = (u: unknown): u is string => {
    if (typeof u !== "string") return false;
    try {
      const { protocol, hostname } = new URL(u);
      return protocol === "https:" && (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com"));
    } catch {
      return false;
    }
  };

  return {
    authorizeUrl(state) {
      const q = new URLSearchParams({
        response_type: "code",
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        state,
        scope: "openid profile w_member_social",
      });
      return `${OAUTH}/authorization?${q}`;
    },

    async exchangeCode(code) {
      const res = await call("token exchange", `${OAUTH}/accessToken`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.redirectUri,
        }).toString(),
      });
      const j = await body("token exchange", res);
      if (typeof j.access_token !== "string" || typeof j.expires_in !== "number") {
        throw new LinkedInError("LinkedIn token exchange → unexpected response", "rejected");
      }
      return { accessToken: j.access_token, expiresIn: j.expires_in };
    },

    async memberId(accessToken) {
      const res = await call("userinfo", `${API}/v2/userinfo`, { headers: { authorization: `Bearer ${accessToken}` } });
      const j = await body("userinfo", res);
      if (typeof j.sub !== "string" || j.sub === "") throw new LinkedInError("LinkedIn userinfo → unexpected response", "rejected");
      return j.sub;
    },

    async uploadImage({ accessToken, personUrn, bytes }) {
      const init = await call("image init", `${API}/rest/images?action=initializeUpload`, {
        method: "POST",
        headers: rest(accessToken),
        body: JSON.stringify({ initializeUploadRequest: { owner: personUrn } }),
      });
      const value = (await body("image init", init)).value as Json | undefined;
      if (!value || !isLinkedInUrl(value.uploadUrl) || typeof value.image !== "string") {
        throw new LinkedInError("LinkedIn image init → unexpected response", "rejected");
      }
      await call("image upload", value.uploadUrl, {
        method: "PUT",
        headers: { authorization: `Bearer ${accessToken}` },
        body: bytes as BodyInit,
      });
      return value.image;
    },

    async createPost({ accessToken, personUrn, commentary, imageUrn }) {
      const res = await call("createPost", `${API}/rest/posts`, {
        method: "POST",
        headers: rest(accessToken),
        body: JSON.stringify({
          author: personUrn,
          commentary,
          visibility: "PUBLIC",
          distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
          content: { media: { id: imageUrn } },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        }),
      });
      const id = res.headers.get("x-restli-id");
      if (!id) throw new LinkedInError("LinkedIn createPost → no post id", "rejected");
      return id;
    },
  };
}
