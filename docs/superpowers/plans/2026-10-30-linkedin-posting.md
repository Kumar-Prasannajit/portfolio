# LinkedIn Posting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Publish makes a draft live, post each of its posts to the owner's LinkedIn profile (caption, cover image, link), with a Retry button on failure and a one-tap reconnect link before the 60-day token expires.

**Architecture:** Everything that touches LinkedIn, the token or Redis runs on Vercel: four route handlers over a testable core in `lib/`. The Actions `live` step and the daily reminder job only call two of those routes with a shared secret and send what comes back to Telegram. Adapters (`fetch`, Upstash, Telegram, GitHub) are injected, so every module is tested with fakes, as in part (b).

**Tech Stack:** Next.js 16.3 route handlers, Node ≥ 22.18 native TypeScript, `node:test`, LinkedIn REST API, Upstash Redis REST, Telegram Bot API, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-29-linkedin-posting-design.md`

## Global Constraints

- **No new npm dependency.** LinkedIn, Upstash and the site are called with global `fetch`; random values come from `node:crypto`.
- `lib/*.ts` import each other with relative `./x.ts` paths, never `@/…`; `import type` is fine. Only `app/` files use `@/lib/…`.
- **Node's type stripping only:** no `enum`, no `namespace`, no constructor parameter properties (`constructor(readonly x)`). Declare class fields explicitly.
- Never log, return or put in an error, a Telegram message or a commit: the LinkedIn access token, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_POST_SECRET`, the Redis token, the OAuth `code`. Errors name the call and the status only.
- The LinkedIn token, client secret and Redis credentials exist on Vercel only. Actions holds `LINKEDIN_POST_SECRET` and nothing else new.
- Every Telegram message uses HTML parse mode, every inserted string escaped, at most 4,096 characters.
- Shared-secret header: `x-linkedin-post-secret`. Redis keys: `linkedin:token`, `linkedin:posted:<kind>-<slug>`, `linkedin:state:<s>` (TTL 900 s).
- Commits follow the repo's Conventional Commits style (`feat(linkedin): …`). Tests sit beside code as `lib/*.test.ts`, run by `npm test` (`node --test lib/*.test.ts scripts/*.test.mjs`).
- Stop and ask before `git push`, a PR, a merge, any GitHub comment, and before anything that posts to the real LinkedIn profile.

## Confirmed against LinkedIn's docs (read 2026-10-30)

The spec listed these as open; the plan fixes them:
- **`Linkedin-Version: 202610`** (the latest listed). Versions live at least a year; 202511 sunsets 2026-11-16. One constant, `LINKEDIN_VERSION`.
- **Escape set** for `commentary`: `| { } @ [ ] ( ) < > # \ * _ ~`, each with a backslash. A plain `#word` is a hashtag element, so `#` is left alone only when it starts a hashtag.
- **Images API:** `POST https://api.linkedin.com/rest/images?action=initializeUpload`, body `{"initializeUploadRequest":{"owner":"urn:li:person:<id>"}}`, response `{"value":{"uploadUrl","image":"urn:li:image:…","uploadUrlExpiresAt"}}`. Then `PUT <uploadUrl>` with the raw bytes and `Authorization: Bearer` (no content type is documented; send none), answered `201`. JPG, PNG, GIF under 36,152,320 pixels; no byte limit is stated.
- **No image-status polling:** `GET /rest/images/…` is refused for a token with only `w_member_social` (write-only). A bad image shows up as `createPost` failing with a 4xx, which the failure table already covers.
- **Post body** (the docs' video/organization example, generalised): `author`, `commentary`, `visibility: "PUBLIC"`, `distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }`, `content: { media: { id } }`, `lifecycleState: "PUBLISHED"`, `isReshareDisabledByAuthor: false`. Success is `201` with `x-restli-id`.
- **Not stated by the docs, settled at acceptance (Task 10):** whether the developer app needs a Company Page; the commentary length limit (the plan keeps the spec's 3,000); the content type of the image `PUT`. The OAuth endpoints (`/oauth/v2/authorization`, `/oauth/v2/accessToken`, `/v2/userinfo`) are LinkedIn's standard 3-legged flow and were not re-read.

## File Structure

| File | Task | Responsibility |
|---|---|---|
| `lib/linkedinCaption.ts` | 1 | pure: escaping, final text, length refusal |
| `lib/linkedinStore.ts` | 2 | Upstash REST adapter, typed accessors |
| `lib/linkedinApi.ts` | 3 | LinkedIn REST/OAuth adapter, `fetch` injected |
| `lib/linkedinPost.ts` | 4 | `postToLinkedIn`, `tokenStatus`, `fetchCoverBytes` |
| `lib/telegram.ts` (modify) | 5 | `li` button, `linkedin` intent, Retry keyboard, message copy |
| `lib/draftPost.ts` (modify) | 6 | `PostDraft.coverImage` |
| `lib/linkedinHandlers.ts`, `lib/linkedinEnv.ts` | 6 | the logic of the four routes; env wiring |
| `app/api/linkedin/{connect,callback,post,remind}/route.ts` | 6 | thin wrappers |
| `lib/telegramBot.ts`, `app/api/telegram/route.ts` (modify) | 7 | Retry button, `linkedin` text |
| `lib/linkedinClient.ts`, `lib/telegramNotify.ts`, `scripts/notify-telegram.mjs`, `.github/workflows/telegram-notify.yml` (modify) | 8 | Actions side |
| `.env.example`, `docs/PROGRESS.md` (modify) | 9 | env vars, part (c) record |

`lib/linkedinHandlers.ts` is not in the spec's table: the routes' logic must live in `lib/` to be testable with `node --test`, the same split as `lib/telegramBot.ts` and `app/api/telegram/route.ts`.

## Review Focus

1. **A post with an empty `linkedin` field** must fail by name and never post a bare link. Task 4.
2. **A replayed Publish** (Actions re-run of the deployment event) must not post twice; the message says "Already on LinkedIn". Tasks 4 and 8.
3. **Token rejected by LinkedIn mid-batch** (401/403 on the second of two posts): the first stays recorded, the rest are "not attempted", a reconnect link is attached, nothing is posted out of order. Task 4.
4. **Caption text that is markup to LinkedIn** (`(v2)`, `@name`, `C#`, `a_b`, a lone `#`) arrives as plain text; a real `#hashtag` stays live. Task 1.
5. **`LINKEDIN_POST_SECRET` unset on Vercel** must reject every call, never accept an empty header. Task 6.

---

### Task 1: Caption text

**Files:**
- Create: `lib/linkedinCaption.ts`
- Test: `lib/linkedinCaption.test.ts`

**Interfaces:**
- Produces: `LINKEDIN_MAX = 3000`; `escapeCommentary(text: string): string`; `linkedinText(caption: string, url: string): string`, which returns the escaped `caption`, a blank line, the escaped `url`, and **throws** `Error` (message starts `no LinkedIn caption` or `caption is <n> characters`) for an empty caption or more than `LINKEDIN_MAX` characters of unescaped text. Never truncates.

- [ ] **Step 1: Write the failing tests**

```ts
test("escapeCommentary escapes every reserved character", () => {
  assert.equal(
    escapeCommentary("a|b {c} @d [e] (f) <g> h\\i *j* k_l ~m"),
    "a\\|b \\{c\\} \\@d \\[e\\] \\(f\\) \\<g\\> h\\\\i \\*j\\* k\\_l \\~m",
  );
});
test("escapeCommentary keeps #hashtag live and escapes a # that starts none", () => {
  assert.equal(escapeCommentary("Shipped #buildinpublic today"), "Shipped #buildinpublic today");
  assert.equal(escapeCommentary("C# and issue#12 and # 1"), "C\\# and issue\\#12 and \\# 1");
  assert.equal(escapeCommentary("(#tag)"), "\\(#tag\\)");
});
test("linkedinText is caption, blank line, url, all escaped", () => {
  assert.equal(linkedinText("Hi (v2) #dev", "https://www.kumarp.in/weekly/009-a_b"), "Hi \\(v2\\) #dev\n\nhttps://www.kumarp.in/weekly/009-a\\_b");
});
test("linkedinText refuses an empty caption and over 3000 characters, exactly 3000 passes", () => {
  assert.throws(() => linkedinText("  \n", "https://x.in/a"), /^Error: no LinkedIn caption/);
  const url = "https://x.in/a";
  assert.throws(() => linkedinText("a".repeat(3000 - url.length - 1), url), /caption is 3001 characters/);
  assert.equal(linkedinText("a".repeat(3000 - url.length - 2), url).endsWith(url), true);
});
```

- [ ] **Step 2: Run** `node --test lib/linkedinCaption.test.ts`. Expected: FAIL, cannot find `./linkedinCaption.ts`.
- [ ] **Step 3: Implement** both functions. `escapeCommentary` walks the string: `#` is kept only when the next character is a letter or digit (`\p{L}`/`\p{N}`) and the previous one is not; every other reserved character gets a backslash. The length check counts the unescaped `caption.trim()` + `"\n\n"` + `url`.
- [ ] **Step 4: Run** the same command. Expected: 4 pass.
- [ ] **Step 5: Commit**

```bash
git add lib/linkedinCaption.ts lib/linkedinCaption.test.ts
git commit -m "feat(linkedin): caption text and commentary escaping"
```

### Task 2: Redis store

**Files:**
- Create: `lib/linkedinStore.ts`
- Test: `lib/linkedinStore.test.ts`

**Interfaces:**
- Produces:
```ts
export type TokenRecord = { accessToken: string; expiresAt: string; personUrn: string };
export type PostedRecord = { postUrn: string; url: string; at: string };
export type LinkedInStore = {
  getToken(): Promise<TokenRecord | null>;
  setToken(t: TokenRecord): Promise<void>;
  getPosted(key: string): Promise<PostedRecord | null>;   // key = "<kind>-<slug>"
  setPosted(key: string, r: PostedRecord): Promise<void>;
  createState(): Promise<string>;                          // 32 hex chars, stored 900 s
  hasState(s: string): Promise<boolean>;
  burnState(s: string): Promise<boolean>;                  // true only if it existed
};
export function upstashStore(conn: { url: string; token: string }, fetchImpl?: typeof fetch): LinkedInStore;
export function storeFromEnv(env?: Record<string, string | undefined>): LinkedInStore | null;
```
`storeFromEnv` reads `UPSTASH_REDIS_REST_URL`/`_TOKEN`, falling back to `KV_REST_API_URL`/`_TOKEN` (as `lib/viewCount.ts` does); `null` if either is missing.

- [ ] **Step 1: Write the failing tests** with a fake `fetch` that records each request body (a JSON command array) and answers `{ result }`:
  - `getToken` sends `["GET","linkedin:token"]`, parses the JSON; a malformed or missing value gives `null`.
  - `setToken` sends `["SET","linkedin:token","<json>"]`; `setPosted("weekly-009-a", r)` uses key `linkedin:posted:weekly-009-a`.
  - `createState` sends `["SET","linkedin:state:<s>","1","EX","900"]`, `<s>` matches `/^[0-9a-f]{32}$/`, two calls differ.
  - `hasState` sends `["EXISTS", …]` and is true for `1`; `burnState` sends `["DEL", …]` and is true for `1`, false for `0`.
  - Every request carries `Authorization: Bearer <token>` and `POST`s to the base URL (trailing slash stripped); a non-2xx throws `Upstash → 500`, and neither that message nor a thrown `fetch` error's message contains the token.
  - `storeFromEnv({})` is `null`; with the `KV_` pair it is not.
- [ ] **Step 2: Run** `node --test lib/linkedinStore.test.ts`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement** with one private `redis(command)` helper like `lib/viewCount.ts`'s, wrapping `fetch` errors so they never quote the URL or token. State from `randomBytes(16).toString("hex")`.
- [ ] **Step 4: Run** the same command. Expected: all pass.
- [ ] **Step 5: Commit** `feat(linkedin): Redis store for the token, posted records and OAuth state`

### Task 3: LinkedIn API adapter

**Files:**
- Create: `lib/linkedinApi.ts`
- Test: `lib/linkedinApi.test.ts`

**Interfaces:**
- Produces:
```ts
export const LINKEDIN_VERSION = "202610";
export class LinkedInError extends Error { kind: "auth" | "unavailable" | "rejected"; constructor(message: string, kind: LinkedInError["kind"]); }
export type LinkedInApi = {
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<{ accessToken: string; expiresIn: number }>;
  memberId(accessToken: string): Promise<string>;                       // userinfo "sub"
  uploadImage(a: { accessToken: string; personUrn: string; bytes: Uint8Array }): Promise<string>;  // urn:li:image:…
  createPost(a: { accessToken: string; personUrn: string; commentary: string; imageUrn: string }): Promise<string>; // x-restli-id
};
export function linkedinApi(cfg: { clientId: string; clientSecret: string; redirectUri: string }, fetchImpl?: typeof fetch): LinkedInApi;
```
Status mapping: 401, 403 → `auth`; 429, 5xx and a thrown `fetch` → `unavailable`; any other non-2xx, or a success without the data needed → `rejected`. Messages are `LinkedIn <call> → <status>` or `LinkedIn <call> failed`; the call names are `token exchange`, `userinfo`, `image init`, `image upload`, `createPost`.

- [ ] **Step 1: Write the failing tests** with a recording fake `fetch`:
  - `authorizeUrl("s1")`: origin+path `https://www.linkedin.com/oauth/v2/authorization`; params `response_type=code`, `client_id`, `redirect_uri`, `state=s1`, `scope=openid profile w_member_social`.
  - `exchangeCode("c1")`: `POST https://www.linkedin.com/oauth/v2/accessToken`, `application/x-www-form-urlencoded`, body has `grant_type=authorization_code`, `code`, `client_id`, `client_secret`, `redirect_uri`; returns `{ accessToken, expiresIn: 5184000 }` from `access_token`/`expires_in`.
  - `memberId`: `GET https://api.linkedin.com/v2/userinfo` with the bearer; returns `sub`.
  - `uploadImage`: first `POST https://api.linkedin.com/rest/images?action=initializeUpload` with `Authorization`, `X-Restli-Protocol-Version: 2.0.0`, `Linkedin-Version: 202610`, body `{"initializeUploadRequest":{"owner":"urn:li:person:abc"}}`; then `PUT` the returned `uploadUrl` with the bytes and a bearer; returns the `image` urn; a `PUT` answering 500 throws `unavailable`.
  - `createPost`: `POST https://api.linkedin.com/rest/posts`, the same three headers, body equals the post body in "Confirmed" above with the given `author`, `commentary`, `imageUrn`; returns the `x-restli-id` header; a `201` without it throws `rejected`.
  - Status table: 401 and 403 → `auth`; 429, 500, 503 → `unavailable`; 400 and 422 → `rejected`; `fetch` throwing an error whose message holds the token → `unavailable`, message equal to `LinkedIn createPost failed`.
  - No error message in any case contains the token, the client secret or the `code`.
- [ ] **Step 2: Run** `node --test lib/linkedinApi.test.ts`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement** with a private `call(name, url, init)` that wraps `fetch`, maps the status to `LinkedInError`, and never reads a response body into a message.
- [ ] **Step 4: Run** the same command. Expected: all pass.
- [ ] **Step 5: Commit** `feat(linkedin): LinkedIn REST and OAuth adapter`

### Task 4: Posting core

**Files:**
- Create: `lib/linkedinPost.ts`
- Test: `lib/linkedinPost.test.ts`

**Interfaces:**
- Consumes: `linkedinText` (Task 1), `LinkedInStore` (Task 2), `LinkedInApi`, `LinkedInError` (Task 3).
- Produces:
```ts
export type PostInput = { key: string; label: string; caption: string; siteUrl: string; coverUrl: string };
export type PostResult = {
  key: string; label: string; siteUrl: string;
  status: "posted" | "skipped" | "failed";
  linkedinUrl: string | null;   // posted, skipped
  reason: string | null;        // failed: short, no secret
  retry: boolean;               // failed and worth another try
  reconnect: boolean;           // failed because of the token
};
export type PostDeps = { api: LinkedInApi; store: LinkedInStore; fetchCover(url: string): Promise<Uint8Array>; now: Date };
export function postToLinkedIn(posts: PostInput[], deps: PostDeps): Promise<PostResult[]>;
export type TokenStatus = { state: "none" } | { state: "expired" } | { state: "ok"; expiresAt: Date; daysLeft: number };
export function tokenStatus(store: Pick<LinkedInStore, "getToken">, now: Date): Promise<TokenStatus>;
export function fetchCoverBytes(url: string, fetchImpl?: typeof fetch): Promise<Uint8Array>;
export const feedUrl = (urn: string) => `https://www.linkedin.com/feed/update/${urn}/`;
```
Rules: results come back in `key` order (weekly slugs start with their number, so this is oldest first). A token missing or past `expiresAt` fails every post with `reconnect: true, retry: true` before any network call. Per post: skip if `getPosted(key)`; else `linkedinText` (a throw is a permanent failure, `retry: false`), `fetchCover`, `uploadImage`, `createPost`, then `setPosted` at once. After a failure with `retry: true` the remaining posts are not attempted (`status: "failed"`, `reason: "not attempted after an earlier failure"`, `retry: true`), which keeps LinkedIn in order; a permanent failure does not stop the others. `daysLeft` is `Math.ceil` of the remaining days. `fetchCoverBytes` throws `cover → <status>` for a non-2xx and `cover is not an image` unless `content-type` starts `image/jpeg` or `image/png`.

- [ ] **Step 1: Write the failing tests** (in-memory store, fake api recording calls, fixed `now`):
  - posts given as `[010, 009]` are created `009` then `010`.
  - a recorded key is `skipped` with its stored url and triggers no `fetchCover`, `uploadImage` or `createPost`.
  - happy path: `fetchCover` gets `coverUrl`; `uploadImage` gets token, `personUrn`, bytes; `createPost` gets `commentary === linkedinText(caption, siteUrl)` and the image urn; the record `{ postUrn, url: feedUrl(postUrn), at }` exists afterwards; result `posted` with that url.
  - no token and an expired token: every result `failed`, `reconnect && retry`, and no api or cover calls.
  - **empty caption** (`"  "`): `failed`, `retry: false`, reason starts `no LinkedIn caption`, no network call, and the next post is still posted.
  - caption over 3,000: `failed`, `retry: false`, reason names the count.
  - **auth failure on post 2 of 2**: post 1 `posted` and recorded; post 2 `failed` with `reconnect: true`; with three posts the third is `not attempted`.
  - `unavailable` from `createPost` → `retry: true, reconnect: false`; `fetchCover` throwing → `failed`, reason starts `cover`, no `createPost`.
  - `setPosted` throwing after a successful `createPost` → `failed`, reason `posted but not recorded`, `retry: true`.
  - **replay:** running the same list twice makes `createPost` run once; the second run is all `skipped`.
  - `tokenStatus`: `none`; `expired` at `expiresAt <= now`; `ok` with `daysLeft` 11, 10, 1 for expiry in 11 days, 10 days, 12 hours.
  - `fetchCoverBytes`: returns bytes for a `image/png` 200; throws for 404 and for `text/html`.
- [ ] **Step 2: Run** `node --test lib/linkedinPost.test.ts`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement.** Map errors: `LinkedInError.kind` `auth` → reconnect + retry, `unavailable` → retry, `rejected` → no retry; any other error → `retry: true` with a one-line message cut at 200 characters.
- [ ] **Step 4: Run** the same command. Expected: all pass.
- [ ] **Step 5: Commit** `feat(linkedin): post a merged draft's posts to LinkedIn, token status`

### Task 5: Telegram copy and intents

**Files:**
- Modify: `lib/telegram.ts` (Action, Intent, `parseUpdate`, `REPLY`; new `retryKeyboard`, `linkedinMessage`)
- Test: `lib/telegram.test.ts`

**Interfaces:**
- Consumes: `PostResult`, `TokenStatus` (types, Task 4).
- Produces: `Action` gains `"li"`; `Intent` gains `{ kind: "linkedin" }`; `retryKeyboard(pr: number): Keyboard`; `linkedinMessage(results: PostResult[], connectUrl: string | null, opts: { withLive: boolean }): string`; `REPLY` gains `linkedinOff`, `linkedinNotMerged(pr)`, `linkedinConnected(until: string)`, `linkedinDifferentAccount`, `linkedinStatus(s: TokenStatus, connectUrl: string)`, `linkedinReminder(daysLeft: number, connectUrl: string)`, `linkedinExpired(connectUrl: string)`.

Exact copy (each inserted value escaped):
- `linkedinOff` = `LinkedIn is not set up on the site yet.`
- `linkedinNotMerged(21)` = `PR #21 is not merged yet.`
- `linkedinConnected("2026-12-28")` = `LinkedIn connected until 2026-12-28.`
- `linkedinDifferentAccount` = `That is a different LinkedIn account from the one already connected. Nothing was changed.`
- `linkedinStatus`: `LinkedIn: not connected.` / `LinkedIn: token expired.` / `LinkedIn: connected until <YYYY-MM-DD>.`, then a newline and `Connect LinkedIn: <url>`.
- `linkedinReminder(3, url)` = `LinkedIn token expires in 3 days.\nReconnect LinkedIn: <url>` (`1 day` for 1); `linkedinExpired(url)` = `LinkedIn token expired.\nReconnect LinkedIn: <url>`.
- `linkedinMessage`: one block per result, blocks joined by a blank line. Posted: `[Live: <siteUrl>\n]On LinkedIn: <url>`; skipped: `[Live: <siteUrl>\n]Already on LinkedIn: <url>`; failed: `[Live: <siteUrl>\n]LinkedIn failed for "<label cut at 80>": <reason cut at 200>`. The `Live:` line only when `withLive`. Then, if `connectUrl`, a final blank line and `Reconnect LinkedIn: <url>`. Cut at the last line end if over 4,096.

- [ ] **Step 1: Write the failing tests:** `parseUpdate` maps a callback `li:21` from the owner to `{ kind: "button", action: "li", pr: 21, callbackId }` and ignores `li:x`; text `LinkedIn ` (not a reply) → `{ kind: "linkedin" }`; the same text as a reply to a `PR #21` message → `editText`; other loose text → `help`; `retryKeyboard(21)` is one button `Retry LinkedIn` with `li:21`; `linkedinMessage` exact output for posted+live, skipped without live, failed with a connect link, and a result list whose text exceeds 4,096 characters stays within it.
- [ ] **Step 2: Run** `node --test lib/telegram.test.ts`. Expected: new tests FAIL, old ones pass.
- [ ] **Step 3: Implement.** Extend the callback regex to `^(pub|edit|rej|li):(\d+)$`; put the `linkedin` check after the `editText` branch and before the `help` return.
- [ ] **Step 4: Run** `npm test`. Expected: all pass (183 old + new).
- [ ] **Step 5: Commit** `feat(linkedin): Telegram intents, Retry button and message copy`

### Task 6: Route logic and routes

**Files:**
- Modify: `lib/draftPost.ts` (`PostDraft.coverImage: string | null`, set from frontmatter `coverImage`, else `null`), `lib/draftPost.test.ts` (the `weekly009()` deepEqual at line 73 gains `coverImage: null`; add one test where a post with `coverImage: "/covers/weekly-009-a.jpg"` reads it)
- Create: `lib/linkedinHandlers.ts`, `lib/linkedinEnv.ts`, `app/api/linkedin/connect/route.ts`, `app/api/linkedin/callback/route.ts`, `app/api/linkedin/post/route.ts`, `app/api/linkedin/remind/route.ts`
- Test: `lib/linkedinHandlers.test.ts`, `lib/linkedinEnv.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5; `secretMatches` from `lib/telegramBot.ts`; `loadDraft`, `postUrl`, `DraftPr`, `PrInfo` from `lib/draftPost.ts`; `GitHubRepo`; `TelegramApi`; `SITE_URL`.
- Produces:
```ts
export type LinkedInCore = { api: LinkedInApi; store: LinkedInStore; fetchCover(url: string): Promise<Uint8Array>; now(): Date };
export const connectUrl = (state: string) => `${SITE_URL}/api/linkedin/connect?state=${state}`;
export function postInputs(draft: DraftPr): PostInput[];       // key `${kind}-${slug}`, label title, siteUrl postUrl(p), coverUrl: coverImage ? SITE_URL+coverImage : `${SITE_URL}/${kind}/${slug}/opengraph-image`
export function postMergedDraft(loaded: { pr: PrInfo; draft: DraftPr }, core: LinkedInCore): Promise<{ results: PostResult[]; connectUrl: string | null }>; // connectUrl via store.createState() only if a result has reconnect
export function handlePost(req: { secretHeader: string | null; body: unknown }, deps: { secret: string | undefined; gh: GitHubRepo; core: LinkedInCore }): Promise<{ status: number; body: object }>;
export function handleRemind(req: { secretHeader: string | null }, deps: { secret: string | undefined; core: LinkedInCore; tg: TelegramApi; chatId: string }): Promise<{ status: number; body: { sent: boolean; note: string } }>;
export function handleConnect(state: string | null, deps: { store: LinkedInStore; api: LinkedInApi }): Promise<{ redirect: string } | { status: number }>;
export function handleCallback(q: { code: string | null; state: string | null; error: string | null }, deps: { store: LinkedInStore; api: LinkedInApi; tg: TelegramApi; chatId: string; now: Date }): Promise<{ status: number; html: string }>;
export function linkedinFromEnv(env?: Record<string, string | undefined>, fetchImpl?: typeof fetch): { api: LinkedInApi; store: LinkedInStore; core: LinkedInCore } | null; // in lib/linkedinEnv.ts
```
Behaviour:
- `handlePost` body is `{ pr: number, sha: string }`. Order of checks: secret (via `secretMatches`; an unset secret never matches) → 401 `{ error: "unauthorized" }`; malformed body (`pr` not a positive integer, `sha` not 7–40 hex) → 400; `loadDraft(gh, pr, sha)` null → 403; PR not merged or `mergeSha !== sha` → 409; else 200 `{ results, connectUrl }`.
- `handleRemind`: wrong secret → 401. Else `tokenStatus`: `none` or `daysLeft > 10` → `{ sent: false }`; `daysLeft <= 10` → creates a state and sends `REPLY.linkedinReminder`; `expired` → `REPLY.linkedinExpired`. Both send to `chatId` with the connect link and return `{ sent: true }`.
- `handleConnect`: no `state` or `!hasState` → `{ status: 400 }`; else `{ redirect: api.authorizeUrl(state) }` (the state is not burned here).
- `handleCallback`: `burnState` first (false → 400 "This link has expired. Send the bot the word linkedin again." page, no exchange); `error` set → 400 page; then `exchangeCode`, `memberId`; a stored token with another `personUrn` → 409, token untouched, `REPLY.linkedinDifferentAccount` sent; else `setToken({ accessToken, expiresAt: now + expiresIn seconds (ISO), personUrn: "urn:li:person:" + sub })`, send `REPLY.linkedinConnected(<expiresAt date, YYYY-MM-DD>)`, 200 page "Connected. You can close this tab." Any thrown error → 502 page "Could not connect LinkedIn. Try again from the bot." and `REPLY.failed(<first line>)` to Telegram. Pages are small escaped HTML strings; never print a token or code.
- `linkedinFromEnv` needs `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` and `storeFromEnv`; redirect URI `${SITE_URL}/api/linkedin/callback`; `fetchCover` is `fetchCoverBytes`; `now` is `() => new Date()`. Otherwise `null`.
- Routes (`export const dynamic = "force-dynamic"`, `@/lib/…` imports, `post` also `export const maxDuration = 60`): `connect` and `callback` are `GET` (`302` redirect / HTML `Response` with `content-type: text/html; charset=utf-8`), `post` and `remind` are `POST` reading header `x-linkedin-post-secret` and `process.env.LINKEDIN_POST_SECRET`, answering JSON with `cache-control: no-store`. When `linkedinFromEnv()` is `null`, or `GITHUB_WRITE_TOKEN`, `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is missing, answer `503 { error: "not configured" }` (HTML page for `callback`/`connect`) and log which variable names are missing, never values.

- [ ] **Step 1: Write the failing tests** (fakes as in `lib/telegramNotify.test.ts`): `postInputs` keys, covers (site cover vs OG fallback) and order; `handlePost` — **secret `undefined` with an empty or missing header is 401**, wrong secret 401, bad body 400, a non-draft PR 403, an unmerged PR and a wrong sha 409 (no LinkedIn call in any of these), success 200 with one result per post and `connectUrl` set only when the token is missing; `handleRemind` at 11 days (not sent), 10, 3 and 12 hours left (sent, text `…in 10 days`, `…in 3 days`, `…in 1 day`), expired (sent, `token expired`), not connected (not sent); `handleConnect` with no/unknown state (400) and a known one (redirect, state still present afterwards); `handleCallback` — replayed state (400, `exchangeCode` not called), `error=access_denied`, first connect stores the record and sends `connected until`, a second member id is 409 and leaves the stored token, a thrown exchange gives 502 and no token in the page or message; `linkedinFromEnv` null without client id/secret/Redis, non-null with all.
- [ ] **Step 2: Run** `node --test lib/linkedinHandlers.test.ts lib/linkedinEnv.test.ts lib/draftPost.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `draftPost.ts` first (update the existing deepEqual), then the handlers, env module and four routes.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: all pass; fix every `PostDraft` literal in older tests that `tsc` flags by adding `coverImage: null`.
- [ ] **Step 5: Commit** `feat(linkedin): connect, callback, post and remind routes`

### Task 7: The bot's Retry button and `linkedin` text

**Files:**
- Modify: `lib/telegramBot.ts` (`BotDeps` gains `linkedin?: LinkedInCore`), `app/api/telegram/route.ts` (pass `linkedinFromEnv()?.core`)
- Test: `lib/telegramBot.test.ts` (use its existing fake setup)

**Interfaces:**
- Consumes: `postMergedDraft`, `connectUrl` (Task 6), `linkedinMessage`, `retryKeyboard`, `REPLY.*` (Task 5), `tokenStatus` (Task 4).

Behaviour: in the `button` case, `li` is handled **before** `openDraft` (that helper refuses merged PRs). After `answerCallback`: no `linkedin` deps → `REPLY.linkedinOff`; `gh.getPr(n)` then `loadDraft(gh, n, pr.mergeSha ?? undefined)`; null → `REPLY.notOpen`; not merged → `REPLY.linkedinNotMerged`; else `postMergedDraft` and send `linkedinMessage(results, connectUrl, { withLive: false })` with `retryKeyboard(n)` when any result has `retry`. The `linkedin` intent replies `REPLY.linkedinStatus(await tokenStatus(core.store, core.now()), connectUrl(await core.store.createState()))`, or `linkedinOff` without deps.

- [ ] **Step 1: Write the failing tests:** `li:21` on a merged draft whose first post failed `unavailable` and second succeeded → one message listing both, with the Retry keyboard, and only the failed post re-posted (the recorded one `skipped`); all posted → no keyboard; an open (unmerged) PR → `PR #21 is not merged yet.` and no LinkedIn call; a non-draft PR → `notOpen`; no LinkedIn deps → `linkedinOff`; text `linkedin` → status line plus a connect link whose state exists in the store; a `linkedin` reply to a draft message is still an edit; a thrown error still ends in `REPLY.failed`.
- [ ] **Step 2: Run** `node --test lib/telegramBot.test.ts`. Expected: new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(linkedin): Retry LinkedIn button and the linkedin text in the bot`

### Task 8: Actions side

**Files:**
- Create: `lib/linkedinClient.ts`
- Modify: `lib/telegramNotify.ts`, `scripts/notify-telegram.mjs`, `.github/workflows/telegram-notify.yml`
- Test: `lib/linkedinClient.test.ts`, `lib/telegramNotify.test.ts`

**Interfaces:**
- Produces:
```ts
export type LinkedInClient = {
  post(pr: number, sha: string): Promise<{ results: PostResult[]; connectUrl: string | null }>;
  remind(): Promise<string>;   // the route's note, for the Actions log
};
export function linkedinClient(secret: string, baseUrl?: string, fetchImpl?: typeof fetch): LinkedInClient; // baseUrl defaults to SITE_URL
```
`NotifyDeps` gains `linkedin?: LinkedInClient`. The client `POST`s JSON to `<base>/api/linkedin/post` (`{ pr, sha }`) and `/remind`, header `x-linkedin-post-secret`, `signal: AbortSignal.timeout(65_000)`; a non-2xx throws `LinkedIn <post|remind> route → <status>`, never the secret.

Behaviour: in `notifyDeployment` (Production branch), when `deps.linkedin` is set, call `post(pr.number, e.sha)`; a thrown error becomes one failed result per post (`reason: "LinkedIn request failed"`, `retry: true`, `reconnect: false`); send `linkedinMessage(results, connectUrl, { withLive: true })`, with `retryKeyboard(pr.number)` if any result has `retry`; the log line is `sent: live PR #21 (LinkedIn: 2 posted, 0 skipped, 0 failed)`. Without `deps.linkedin` the existing `Live:` message and log line are unchanged. `notifyReminders` appends `; LinkedIn: <note>` after calling `remind()` (a throw appends `; LinkedIn remind failed: <first line>`) and never skips the draft reminders because of it. The script passes `linkedin: process.env.LINKEDIN_POST_SECRET ? linkedinClient(...) : undefined` to `deps`; the workflow's `notify` job `env` gains `LINKEDIN_POST_SECRET: ${{ secrets.LINKEDIN_POST_SECRET }}`.

- [ ] **Step 1: Write the failing tests.** `linkedinClient`: request URL, method, header, JSON body; 401 throws with no secret in the message; `remind` returns the note. `notifyDeployment` with a fake client: posted → one message with both URLs and no keyboard; one failed with `retry` → message with the failure and `retryKeyboard(21)`; **a second call whose client answers `skipped` → "Already on LinkedIn"**; client throws → message still starts with `Live: <url>` and has the Retry button; no client → the exact old output. `notifyReminders` with a client: log line ends `; LinkedIn: <note>`, and a throwing `remind` still sends the draft reminder.
- [ ] **Step 2: Run** `node --test lib/linkedinClient.test.ts lib/telegramNotify.test.ts`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** the client, the `notify` changes, the script wiring and the one workflow line. Update the script's header comment to mention `LINKEDIN_POST_SECRET` (optional).
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(linkedin): post to LinkedIn from the live step and check the token daily`

### Task 9: Docs and whole-branch checks

**Files:**
- Modify: `.env.example` (after the Telegram block: `LINKEDIN_CLIENT_ID=`, `LINKEDIN_CLIENT_SECRET=`, `LINKEDIN_POST_SECRET=` with the comment text: where each comes from, that `LINKEDIN_POST_SECRET` is any long random string and the same value goes in the Actions secret of that name, and the redirect URL `https://www.kumarp.in/api/linkedin/callback`), `docs/PROGRESS.md` (a "Post automation (part c)" section before "Phase 10": what shipped, the facts confirmed above, the failure table summary, setup steps from the spec, and the acceptance list from Task 10 unchecked)

- [ ] **Step 1: Edit both files** as described.
- [ ] **Step 2: Run** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npx next build --webpack`. Expected: tests pass, lint and tsc clean, build succeeds with `/api/linkedin/*` listed as dynamic routes. If `AGENTS.md` or `CLAUDE.md` shows as modified, include it in the commit.
- [ ] **Step 3: Commit** `docs(progress): record LinkedIn posting (part c)`
- [ ] **Step 4: Stop.** Report the branch state and ask before pushing, opening the PR and merging.

### Task 10: Acceptance (the owner drives; nothing here is automated)

Needs the owner's LinkedIn app, so the executor stops and asks before each live step and never posts to the profile unprompted.

- [ ] Owner: create the LinkedIn app (note whether it demanded a Company Page), add the two products and the redirect URL; set the Vercel env vars and the Actions secret `LINKEDIN_POST_SECRET`; redeploy.
- [ ] Send the bot `linkedin`; open the link; see "LinkedIn connected until …". Note whether the consent screen appears and whether `/v2/userinfo` returns `sub`.
- [ ] Publish a throwaway draft (a cover photo set); the Telegram message shows both URLs; the profile shows image, caption (hashtag live) and link. Record whether the image `PUT` needed a content type.
- [ ] Re-run the `deployment_status` job: the message says "Already on LinkedIn" and the profile has no duplicate.
- [ ] Make the token look expired by editing `expiresAt` in Redis: the failure message and reconnect link appear; reconnect; tap **Retry LinkedIn**; exactly one post results.
- [ ] Reminder: set `expiresAt` to 9 days ahead in Redis, wait for the 10:00 IST job (it also needs the schedule to fire, still open from part b), read the reminder text.
- [ ] Record each result, and any doc fact that turned out different, in `docs/PROGRESS.md`; fix what differs in a follow-up commit.
