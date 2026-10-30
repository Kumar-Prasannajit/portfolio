# Post automation, part (c): LinkedIn posting (design spec)

Date: 2026-10-29 · Branch: `feat/linkedin-posting` · Status: design approved in chat, awaiting written-spec review

## Goal

When the user taps **Publish** in the Telegram bot (part b) and the post goes live, the same post
appears on the user's personal LinkedIn profile without another tap: the post's `linkedin` caption,
its cover image and a link to the post. The user never pastes a token; once every ~50 days the bot
sends a one-tap "Reconnect LinkedIn" link instead.

## Where this sits

| Part | What it does | Status |
|---|---|---|
| (a) Drafting | Routines draft posts into `draft-post` PRs | live |
| (b) Telegram loop | Preview, cover photo, edit, Publish, Reject, reminders | live (#22, #25) |
| **(c) LinkedIn** | After the production deploy of a published draft, posts to LinkedIn | **this spec** |
| (d) Site | Shows `coverImage`; a "Discuss on LinkedIn" link | later spec |

(c) plugs into the `live` step of (b): `notifyDeployment` in `lib/telegramNotify.ts`, which today sends
"Live: <url>" for a merged `draft-post` PR whose merge sha is the deployed sha.

## Decisions (made in chat, 2026-10-29)

1. **Automatic.** Publish posts to LinkedIn with no extra tap.
2. **Personal profile**, not a company page.
3. **Format: an image post with the post link as the last line of the text.** The caption is the post's
   `linkedin` field, then a blank line, then the post URL. Rejected: a link card (the API does not
   scrape, so title, description and thumbnail would be set by hand and the image is small) and the
   link in a first comment (an extra call; reach is not worth the complexity for now).
4. **Several posts in one PR: one LinkedIn post per post, oldest first**, each with its own caption
   and link.
5. **On failure** the bot says so and offers a **Retry LinkedIn** button. A reconnect link is added
   when the token is the cause. Retry never posts a post twice.
6. **No automatic token renewal exists for this kind of app** (see "What LinkedIn allows"). The
   replacement is a one-tap reconnect link, sent daily from 10 days before expiry.
7. **Architecture: everything that touches LinkedIn or the token runs on Vercel.** Considered and
   rejected: posting from the Actions `live` step with Redis credentials as Actions secrets (a
   `deployment_status` workflow runs the deployed branch's copy of the workflow file, so any branch
   author could read those secrets and with them a token that posts as the user for 60 days), and
   keeping the token in a GitHub secret (writing secrets needs libsodium and a powerful write token).

## Constraints

- **Free:** LinkedIn's self-serve "Share on LinkedIn" product, Vercel Hobby, the Upstash Redis the site
  already uses for the viewers counter (`UPSTASH_REDIS_REST_URL` and `_TOKEN`, see `.env.example`).
- **No new npm dependency.** Upstash and LinkedIn are called with `fetch`.
- **The LinkedIn token and client secret stay on Vercel.** Actions holds only a shared secret that can
  trigger a post of an already merged draft.
- **Same rules as (b):** `lib/*.ts` import each other with relative `./x.ts` paths; no token in a log,
  an error, a message or a commit.

## What LinkedIn allows (from Microsoft Learn's LinkedIn docs, read 2026-10-29)

- **Product and scope.** The self-serve product "Share on LinkedIn" grants `w_member_social` (post on
  behalf of the authenticated member). "Sign In with LinkedIn using OpenID Connect" provides the
  member id (`sub`) used to build the author `urn:li:person:<id>`. Scopes requested: `openid profile
  w_member_social`.
- **Token life.** Access tokens last 60 days (`expires_in` ≈ 5,184,000 s). Programmatic refresh tokens
  are for "a limited set of partners" (approved Marketing Developer Platform partners); a self-serve
  app gets none. The documented renewal is to run the authorization again: if the member is still
  logged in to linkedin.com and the old token has not expired, LinkedIn skips the consent screen and
  redirects straight back. That is what the reconnect link does.
- **Posting.** `POST https://api.linkedin.com/rest/posts` with headers `Authorization: Bearer`,
  `X-Restli-Protocol-Version: 2.0.0` and `Linkedin-Version: YYYYMM`; body with `author`, `commentary`,
  `visibility: "PUBLIC"`, `distribution.feedDistribution: "MAIN_FEED"`, `lifecycleState: "PUBLISHED"`
  and `content.media.id: "urn:li:image:<id>"`. A `201` returns the post id in the `x-restli-id` header
  (`urn:li:share:…` or `urn:li:ugcPost:…`); the post is at
  `https://www.linkedin.com/feed/update/<urn>/`.
- **Image.** Uploaded first through the Images API (initialise an upload for the person, `PUT` the
  bytes to the returned URL, use the returned `urn:li:image:…`). The exact request shape is read from
  the Images API page when the plan is written.
- **Quota.** 150 requests per member per day; a post needs about 3.
- **Redirect URL.** Must be an absolute HTTPS URL registered in the app, without a fragment.
- **Commentary escaping.** `commentary` uses LinkedIn's "little" text format; some characters are
  markup and must be backslash-escaped, while `#word` is a live hashtag. The plan pins the exact list
  from the little text format page.

Facts the docs did not state and the plan must confirm before relying on them: that a developer app
must be associated with a LinkedIn Company Page, and which `Linkedin-Version` values are currently
supported (versions are sunset after about a year).

## 1. Pieces

| File | Responsibility |
|---|---|
| `lib/linkedinApi.ts` | Adapter, `fetch` injected: `authorizeUrl`, `exchangeCode`, `memberId` (`/v2/userinfo`), `uploadImage`, `createPost`. One pinned `LINKEDIN_VERSION`. Errors say the call and the status, never a token or URL with one. |
| `lib/linkedinCaption.ts` | Pure: `linkedinText(post, url)` = caption, blank line, URL; `escapeCommentary`; refuses text over 3,000 characters (never truncates). |
| `lib/linkedinStore.ts` | Adapter: Upstash REST over `fetch`, with typed accessors for the token, the posted records and the one-time state. |
| `lib/linkedinPost.ts` | Core: `postToLinkedIn(posts, deps)` and `tokenStatus(store, now)`. Posts oldest first, skips a post already recorded, loads the cover, uploads, creates the post, records it, and returns one result per post. |
| `app/api/linkedin/connect/route.ts` | `GET`: accepts only a bot-issued state, redirects to LinkedIn. |
| `app/api/linkedin/callback/route.ts` | `GET`: checks and burns the state, exchanges the code, stores the token, tells the owner in Telegram. |
| `app/api/linkedin/post/route.ts` | `POST`, `maxDuration = 60`: called by the `live` step with a shared secret; re-checks the PR; posts. |
| `app/api/linkedin/remind/route.ts` | `POST`: called by the daily reminder job with the shared secret; reads the token's age and, when 10 days or fewer are left (or it has expired), sends the owner the reconnect message itself. |
| `lib/telegramNotify.ts` (modify) | `live` calls the `post` route and sends the result; the daily reminder job also calls the `remind` route. |
| `lib/telegram.ts`, `lib/telegramBot.ts` (modify) | New intents and copy: `Retry LinkedIn` button, a `linkedin` text for status and a connect link. |
| `scripts/notify-telegram.mjs`, `.github/workflows/telegram-notify.yml` (modify) | Pass `LINKEDIN_POST_SECRET` and the route URL to the live and reminder steps. |
| `.env.example`, `docs/PROGRESS.md` (modify) | The new env vars and the part (c) record. |

## 2. Flows

**Connect (first time, and every ~50 days).**
1. The owner sends the bot the text `linkedin`, or a reminder arrives. Either way the bot creates a
   state (random, single use, 15 minutes) in Redis and sends
   `https://www.kumarp.in/api/linkedin/connect?state=<s>`.
2. `connect` returns an error unless `<s>` exists in Redis; otherwise it redirects to LinkedIn's
   authorization page with `scope=openid profile w_member_social` and the same state.
3. LinkedIn redirects to `/api/linkedin/callback?code=…&state=…`. `callback` deletes the state (a
   second use fails), exchanges the code, reads the member id, and stores
   `{ accessToken, expiresAt, personUrn }`. If a token is already stored for a different `personUrn`
   it refuses and says so.
4. It sends the owner "LinkedIn connected until <date>" and shows a short "you can close this" page.

**Publish.**
1. Publish merges the PR (part b). Vercel deploys `main`; the `live` step finds the merged draft PR
   whose merge sha is the deployed sha, exactly as today.
2. It calls `POST /api/linkedin/post` with the shared secret in a header and `{ pr, sha }`.
3. The route verifies the secret (constant-time), reads the PR with `GITHUB_WRITE_TOKEN`, and
   checks it is a merged `draft-post` PR from a `draft/*` branch whose `mergeSha` equals `sha`. It
   loads the posts at that sha, then calls `postToLinkedIn`.
4. For each post, oldest first: skip if `linkedin:posted:<kind>-<slug>` exists; otherwise fetch the
   cover (`coverImage` from the live site, else the post's generated OG image), upload it, create
   the post, record it at once.
5. The route returns one result per post; the `live` step sends "Live, and on LinkedIn:" with both
   URLs per post, or the failure message below.

**Reminder.** After its own reminders, the existing 10:00 IST job calls `POST /api/linkedin/remind` with
the shared secret. The route reads the token: 10 days or fewer left sends a message with a fresh
connect link, daily until reconnected; expired says so; "not connected" is not nagged (the owner
starts that with the `linkedin` text). Actions never sees the token or Redis.

**Retry.** The button's callback data names the PR. The webhook route re-runs `postToLinkedIn` for
that merged PR's posts; recorded posts are skipped, so only the failed ones are retried.

## 3. Data (Upstash Redis, JSON strings)

| Key | Value | TTL |
|---|---|---|
| `linkedin:token` | `{ "accessToken": "…", "expiresAt": "2026-12-28T10:00:00Z", "personUrn": "urn:li:person:abc123" }` | none |
| `linkedin:posted:<kind>-<slug>` | `{ "postUrn": "urn:li:share:…", "url": "https://www.linkedin.com/feed/update/…", "at": "…" }` | none |
| `linkedin:state:<s>` | `"1"` | 900 s |

## 4. Failure handling

| Case | Result |
|---|---|
| No token, or `expiresAt` passed | "LinkedIn not connected / expired" with a connect link; nothing is posted |
| LinkedIn 401 or 403 | Treated as a token problem: reconnect link |
| LinkedIn 429 or 5xx, network error | "LinkedIn is unavailable" and **Retry LinkedIn** |
| Cover cannot be fetched or uploaded | Failure for that post and Retry; no silent image-less post |
| Text over 3,000 characters | Failure naming the post; the caption is never cut |
| Post created, Redis write fails | The failure is reported; a Retry may duplicate that one post (accepted, documented) |
| One post of several fails | The ones already posted stay recorded; the message lists each result |

Every failure message names the post and a short reason with no token, no stack trace and no URL
containing a secret. The site is already live when LinkedIn fails; the message starts with the live
URL.

## 5. Security

- **Credentials by place.** Vercel: LinkedIn client id and secret, Redis URL and token,
  `LINKEDIN_POST_SECRET`, plus (b)'s existing tokens. Actions: `LINKEDIN_POST_SECRET` only, added to
  the existing `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ROUTINE_TRIGGER_TOKEN`.
- **What the shared secret can do.** Ask the `post` route to post a draft that is already merged,
  whose merge sha is the deployed sha, and which is not recorded as posted; or ask the `remind`
  route to send the owner a reconnect message. It cannot post arbitrary text or read the token.
- **OAuth.** The state is random, single use and expires; `connect` refuses without a stored state, so
  a stranger cannot start the flow; `callback` checks the state before exchanging the code; a
  different member id than the stored one is refused.
- **Open limit.** A branch author can still read the secrets Actions holds (known from (b)); (c)
  deliberately adds no token that posts as the user to that set.
- Captions reach LinkedIn only through `JSON.stringify` of a request body, never through a shell.

## 6. Testing

Unit tests (`node --test`), with a fake `fetch` and an in-memory store:
- `linkedinText` and `escapeCommentary`: hashtags stay live, markup characters are escaped, the
  3,000-character refusal, no truncation.
- `postToLinkedIn`: order, the already-posted skip, each row of the failure table, the cover
  fallback, record-after-create.
- `linkedinApi`: request shape and headers for each call, status mapping, no token in errors.
- Routes: wrong or missing secret, a PR that is not a merged draft, a wrong sha, a replayed state, a
  different member id, the expired-token path, and `remind` at 11, 10, 3 and 0 days left, expired and
  not connected.
- `telegramNotify` and `telegramBot`: the new messages, the Retry button, the token reminder.

**Acceptance** (needs the owner's LinkedIn app and a real post; the first real post is the owner's
call): connect and see the confirmation; publish a throwaway draft and see the post on the profile
with image, caption and link; tap Retry after a deliberate failure and confirm no duplicate; check the
reminder text at 10 days.

## Setup (once, by the user)

1. Create a LinkedIn developer app at linkedin.com/developers (it may need a Company Page to be
   associated with it). Add the products **Share on LinkedIn** and **Sign In with LinkedIn using
   OpenID Connect**. Add the redirect URL `https://www.kumarp.in/api/linkedin/callback`.
2. Add to Vercel (and redeploy): `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
   `LINKEDIN_POST_SECRET` (any long random string); check the existing `UPSTASH_REDIS_REST_URL` and
   `_TOKEN` are set for Production.
3. Add the Actions secret `LINKEDIN_POST_SECRET` (the same value).
4. Send the bot `linkedin`, tap the link, approve.

## Out of scope for (c)

- Company pages, scheduling, comments, reactions, analytics, or editing a post after it is on LinkedIn.
- Rendering `coverImage` or a LinkedIn link on the site (d).
- Programmatic token refresh (not available to this kind of app).
- More than one LinkedIn account.
