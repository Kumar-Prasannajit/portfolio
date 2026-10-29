# Telegram Review Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Review, edit, cover and publish part (a)'s `draft-post` PRs from Telegram, and hear about every routine run that makes no PR.

**Architecture:** GitHub Actions send (on `deployment_status`, `automation-log` issues, `Edit failed` comments and a daily schedule); a Next.js route `app/api/telegram` receives (photo, buttons, edit text) and acts through the GitHub REST API. Logic lives in plain `lib/*.ts` modules tested with `node --test`; network adapters are thin and injected, so the bot and the notifier are tested with fakes. Edits are applied by a third Claude Code routine fired by an `edit:` PR comment.

**Tech Stack:** Next.js 16.3 route handler, Node ≥ 22.18 native TypeScript, `node:test`, `gray-matter` (already a dependency), Telegram Bot API, GitHub REST API, GitHub Actions, Claude Code routines.

**Spec:** `docs/superpowers/specs/2026-10-29-telegram-review-bot-design.md`

## Global Constraints

- Everything free: no new paid service, **no new npm dependency** (use global `fetch`, `node:crypto`, `gray-matter`).
- `lib/*.ts` modules import each other with relative `./x.ts` paths, never `@/…`, so `node --test` and `scripts/*.mjs` can load them (existing pattern: `lib/contentCheck.test.ts`). `import type` is fine (erased). Only `app/` files may use `@/lib/…`.
- Repo constant: `Kumar-Prasannajit/portfolio`. The bot acts only on PRs labelled `draft-post` whose head branch starts `draft/`.
- Never log, return or put in an error message: `TELEGRAM_BOT_TOKEN`, `GITHUB_WRITE_TOKEN`, the Actions `GITHUB_TOKEN`, or any `api.telegram.org/file/bot…` URL.
- The webhook route always answers 200 (an empty body for rejected updates).
- Commit messages the bot and the edit routine make: `Cover for #<pr>` and `Edit #<pr>: <first 60 chars of the instruction>`. "Updated" detection depends on these prefixes.
- Every message the bot sends about a PR contains the text `PR #<n>`; replies are matched to PRs by it.
- Telegram messages use `parse_mode: "HTML"`, every inserted string escaped, at most 4,096 characters, link previews off.
- Commits follow the repo's Conventional Commits style (`feat(bot): …`, `docs(automation): …`).

## Review Focus

1. **Vercel preview links behind Deployment Protection** — the preview URL must open on the phone without a Vercel login wall. Owned by Task 9 (setup checks the setting; acceptance opens a link on the phone).
2. **Telegram delivers the same photo update twice** (a retry after a slow response) — the second must not make a second commit or preview. Owned by Task 5 (`commitFiles` returns `null` when the tree is unchanged) and Task 6 (reply `Cover already on PR #21.`).
3. **Deployments that aren't draft PRs** (a feature PR's preview, a production deploy of a non-draft merge) — no message at all. Owned by Task 7.
4. **A plain text message that isn't a reply** (the user types "publish") — a short help reply, not silence. Owned by Task 4 (`help` intent) and Task 6.
5. **An old message's button after the PR was merged or closed** — `PR #21 is already merged.` / `PR #21 is no longer open.`, never a second merge or an error. Owned by Task 6.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/contentCheck.ts` (modify) | `coverImage` rule; takes the set of existing `public/` paths |
| `scripts/check-content.mjs` (modify) | Builds that set from `public/covers` |
| `lib/content.ts` (modify) | `coverImage?: string` on both frontmatter types |
| `lib/draftPost.ts` | Pure: post fields from an MDX file, PR-body parsing, cover path, frontmatter edit, check gating; `loadDraft` |
| `lib/telegram.ts` | Pure: an update → an intent; all message text and keyboards |
| `lib/telegramApi.ts` | Adapter: Telegram Bot API calls |
| `lib/githubWrite.ts` | Adapter: GitHub REST calls for the one repo, token injected |
| `lib/telegramBot.ts` | `handleUpdate`, `secretMatches`: the webhook's behaviour, deps injected |
| `app/api/telegram/route.ts` | Thin `POST` wiring env vars to `handleUpdate` |
| `lib/telegramNotify.ts` | Deployment / reminder / log-issue / edit-failed notifications, deps injected |
| `scripts/notify-telegram.mjs` | CLI the workflow runs; wires env and the event payload to `lib/telegramNotify.ts` |
| `.github/workflows/telegram-notify.yml` | Events → `notify-telegram.mjs` subcommands |
| `automation/apply-edit.md` | Instructions for the `portfolio-draft-edit` routine |
| `automation/draft-posts.md` (modify) | §9: open an `automation-log` issue when no PR is made |
| `.env.example`, `docs/PROGRESS.md` (modify) | The new env vars and the part (b) record |

---

### Task 1: Find out how an `edit:` comment can start a routine

A spike: no product code. Its output is the **Decision** line below, used by Task 8.

**Files:**
- Modify: `docs/superpowers/plans/2026-10-29-telegram-review-bot.md` (this line only)

- [ ] **Step 1:** Read the `RemoteTrigger` tool's `create_webhook_trigger` contract (and the routines docs via the `claude-code-guide` agent if that is not enough). Answer: can a GitHub-event trigger fire a routine on `issue_comment` `created`, filtered to (a) body starting `edit:`, (b) author `Kumar-Prasannajit`, (c) a PR labelled `draft-post`? Does the fired run receive the comment body and PR number?
- [ ] **Step 2:** If the event is supported and the run receives the payload: **Path A** — whatever filters the trigger supports go in the trigger; `automation/apply-edit.md` re-checks all three conditions itself.
- [ ] **Step 3:** Otherwise: **Path B** — a job `edit` in `telegram-notify.yml` filters with `if:` and starts the routine through its API "run" endpoint, passing `PR #<n>` and the comment body as the run's message, authenticated by Actions secret `ROUTINE_TRIGGER_TOKEN`. Confirm the endpoint accepts a message and how it authenticates.
- [ ] **Step 4:** Fill in and commit `docs(plan): record how edit comments start the edit routine`.

**Decision:** **Path B.** The routines docs (research preview) list no `issue_comment` GitHub trigger and no comment-body or comment-author filter, and say nothing about a GitHub event payload reaching the run. So the `edit` job in `telegram-notify.yml` does the filtering with `if:` (PR comment, body starts `edit:`, author `Kumar-Prasannajit`, PR labelled `draft-post`) and starts the routine with `POST https://api.anthropic.com/v1/claude_code/routines/<trig_…>/fire`. Headers: `Authorization: Bearer $ROUTINE_TRIGGER_TOKEN` (an `sk-ant-oat01-…` token scoped to that one routine, generated once in the claude.ai UI: routine, Edit, + on the Trigger row, API, Generate token), `anthropic-version: 2023-06-01`, `anthropic-beta: experimental-cc-routine-2026-04-01`, `Content-Type: application/json`. Body: `{"text": "PR #<n>\n<comment body>"}` (max 65,536 chars, freeform). The run receives that text inside an untrusted `<routine-fire-payload>` block, so the routine prompt says to act on that block. No idempotency; 30 fires an hour per routine. `ROUTINE_TRIGGER_TOKEN` is added to Task 9 step 3.

---

### Task 2: `coverImage` frontmatter

**Files:**
- Modify: `lib/contentCheck.ts`, `lib/contentCheck.test.ts`, `scripts/check-content.mjs`, `lib/content.ts` (`BlogFrontmatter`, `WeeklyFrontmatter`)

**Interfaces:**
- Produces: `checkContent(files: ContentFile[], publicPaths?: ReadonlySet<string>): Problem[]`. `publicPaths` holds paths like `"/covers/weekly-009-x.jpg"`; when omitted, existence isn't checked (old callers and tests stay valid). `coverImage?: string` on both frontmatter types.

- [ ] **Step 1: Write the failing tests** in `lib/contentCheck.test.ts`:

```ts
const withCover = (coverImage: unknown) => blog({ data: { ...blog().data, coverImage } });
const SHAPE = "`coverImage` must be /covers/<name>.jpg, .jpeg or .png";
test("coverImage pointing at an existing cover passes", () => {
  assert.deepEqual(checkContent([withCover("/covers/blog-a.jpg")], new Set(["/covers/blog-a.jpg"])), []);
});
test("coverImage must be a /covers/ jpg, jpeg or png", () => {
  assert.deepEqual(messages([withCover("/images/a.jpg")]), [SHAPE]);
  assert.deepEqual(messages([withCover("/covers/a.gif")]), [SHAPE]);
  assert.deepEqual(messages([withCover(3)]), [SHAPE]);
});
test("coverImage naming a missing file fails when public paths are given", () => {
  assert.deepEqual(checkContent([withCover("/covers/blog-a.jpg")], new Set()).map((p) => p.message),
    ["`coverImage` file public/covers/blog-a.jpg does not exist"]);
});
```

- [ ] **Step 2: Run** `node --test lib/contentCheck.test.ts` — Expected: the three new tests FAIL.
- [ ] **Step 3: Implement.** In `fileProblems`, check a present `data.coverImage` against `/^\/covers\/[a-z0-9-]+\.(jpe?g|png)$/`; in `checkContent`, add the existence message when `publicPaths` is given and lacks it. `check-content.mjs` builds `publicPaths` from `public/covers/*` as `"/covers/<name>"` (empty set if the folder is missing) and passes it. Both frontmatter types get `coverImage?: string; // set by the Telegram bot; shown by part (d), used by part (c)`.
- [ ] **Step 4: Run** `npm test && npm run check:content` — Expected: PASS and `content ok: …`.
- [ ] **Step 5: Commit** `feat(content): allow an optional coverImage on posts`.

---

### Task 3: `lib/draftPost.ts`

**Files:**
- Create: `lib/draftPost.ts`, `lib/draftPost.test.ts`

**Interfaces:**
- Consumes: `SITE_URL` from `./site.ts`; `import type { GitHubRepo } from "./githubWrite.ts"` (Task 5; type only, tests use a fake).
- Produces:
  ```ts
  export type PostKind = "blog" | "weekly";
  export type PostDraft = { kind: PostKind; path: string; slug: string; number: string | null;
    title: string; summary: string; linkedin: string };
  export type DraftPr = { number: number; branch: string; headSha: string; createdAt: string;
    posts: PostDraft[]; checks: string[] };
  export type PrInfo = { number: number; state: "open" | "closed"; merged: boolean; labels: string[];
    head: string; headSha: string; body: string; createdAt: string; mergeSha: string | null };
  export function isDraftPr(pr: Pick<PrInfo, "labels" | "head">): boolean;
  export function postFiles(changed: { filename: string; status: string }[]): string[];
  export function postDraft(path: string, source: string): PostDraft;
  export function pleaseCheck(prBody: string): string[];
  export function coverPath(post: PostDraft, ext: "jpg" | "png"): { file: string; url: string };
  export function withCoverImage(source: string, url: string): string;
  export function requiredChecksGreen(runs: { name: string; conclusion: string | null }[],
    statuses: { context: string; state: string }[]): boolean;
  export function isBotCommit(message: string): boolean;
  export function postUrl(post: PostDraft): string;
  export function loadDraft(gh: Pick<GitHubRepo, "getPr" | "prFiles" | "fileAt">, n: number,
    ref?: string): Promise<{ pr: PrInfo; draft: DraftPr } | null>;
  ```

- [ ] **Step 1: Write the failing tests** (fixtures inline, modelled on `content/weekly/008-*.mdx` and PR #21's body):
  - `isDraftPr`: `{labels:["draft-post"], head:"draft/weekly-009"}` → true; no label → false; head `feat/x` → false.
  - `postFiles`: keeps `added`/`modified` `content/weekly/009-a.mdx` and `content/blog/b.mdx`; drops `removed` files, `content/ideas.md`, `public/x.jpg`.
  - `postDraft("content/weekly/009-salonjaa-nap.mdx", src)` → `{kind:"weekly", slug:"009-salonjaa-nap", number:"009", title, summary, linkedin}`; a blog takes `summary` from `excerpt` and has `number: null`.
  - `pleaseCheck` on PR #21's `## Please check` section → its three bullet texts without `- `; a section reading `nothing flagged` → `[]`; no section → `[]`.
  - `coverPath(weekly009, "jpg")` → `{ file: "public/covers/weekly-009-salonjaa-nap.jpg", url: "/covers/weekly-009-salonjaa-nap.jpg" }`.
  - `withCoverImage`: adds `coverImage: "/covers/x.jpg"` as the last frontmatter line; replaces an existing column-0 `coverImage:` line; leaves an indented `coverImage:` inside the `linkedin: |` block alone; the output minus that one line equals the input byte for byte.
  - `requiredChecksGreen`: true only when a run named `check` concluded `success` **and** a status with context `Vercel` is `success`; pending, failed or missing either → false.
  - `isBotCommit("Cover for #21")`, `isBotCommit("Edit #21: shorter intro")` → true; `"Draft weekly #009"` → false.
  - `postUrl(weekly009)` → `"https://www.kumarp.in/weekly/009-salonjaa-nap"`.
  - `loadDraft` with a fake `gh`: non-draft PR → `null`; draft PR → posts in file order and `checks` from the body.
- [ ] **Step 2: Run** `node --test lib/draftPost.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement.** `postDraft` parses with `gray-matter`. `pleaseCheck` reads from `## Please check` to the next `## `, keeping `- ` bullets. `withCoverImage` edits only the text between the first `---\n` and the next `\n---`. `loadDraft` reads files at `ref ?? pr.headSha`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(bot): parse draft PRs and their posts`.

---

### Task 4: `lib/telegram.ts`

**Files:**
- Create: `lib/telegram.ts`, `lib/telegram.test.ts`, `scripts/fixtures/telegram/{photo-reply,photo-plain,document-png,document-gif,button-pub,edit-reply,text-plain,stranger}.json`

**Interfaces:**
- Consumes: `DraftPr`, `PostDraft` (Task 3).
- Produces:
  ```ts
  export const TELEGRAM_MAX = 4096;
  export type Action = "pub" | "edit" | "rej";
  export type Intent =
    | { kind: "photo"; pr: number | null; fileId: string; ext: "jpg" | "png" | null; size: number | null }
    | { kind: "button"; action: Action; pr: number; callbackId: string }
    | { kind: "editText"; pr: number; text: string }
    | { kind: "help" }
    | { kind: "ignore" };
  export type Keyboard = { inline_keyboard: { text: string; callback_data: string }[][] };
  export function parseUpdate(update: unknown, chatId: string): Intent;
  export function prFromText(text: string | undefined): number | null;
  export function escapeHtml(s: string): string;
  export function draftKeyboard(pr: number): Keyboard;
  export function draftMessage(d: DraftPr, previewUrl: string, updated: boolean): string;
  export function reminderMessage(d: DraftPr, previewUrl: string | null, now: Date): string;
  export const REPLY: { /* Step 3 */ };
  ```

- [ ] **Step 1: Write the failing tests:**
  - `parseUpdate`: `photo-reply` (replying to a message containing `PR #21`) → `{kind:"photo", pr:21, fileId:<the largest size's file_id>, ext:"jpg"}`; `photo-plain` → `pr: null`; `document-png` → `ext:"png"` and `size` from the document; `document-gif` → `ext: null`; `button-pub` → `{kind:"button", action:"pub", pr:21}`; `edit-reply` (text replying to `What should change in PR #21?`) → `{kind:"editText", pr:21, text}`; text replying to a draft message → also `editText`; `text-plain` → `{kind:"help"}`; `stranger` (other `from.id`/`chat.id`) → `ignore`; `{}` and `null` → `ignore`.
  - `prFromText("Weekly #009 · PR #21\n…")` → 21 (not 9); no match → null.
  - `draftMessage`: contains `PR #21`, the title, the summary, each check as `• …` (or `• nothing flagged`), the caption and `Preview: <url>`; starts `Updated · ` when `updated`; a title `A <b> & c` appears as `A &lt;b&gt; &amp; c`; a two-post PR with two 3,000-char captions is ≤ 4,096 chars and each cut caption ends `… (full caption in the PR)`.
  - Header line: one weekly → `Weekly #009 · PR #21`; two → `Weekly #009–#010 · PR #21`; blog → `Blog · PR #19`.
  - `reminderMessage` for a PR created 50 h before `now` → contains `Still waiting: Weekly #009, PR #21, open 2 days`; 26 h → `open 1 day`.
  - `draftKeyboard(21)` → one row: `Publish`/`pub:21`, `Edit`/`edit:21`, `Reject`/`rej:21`.
- [ ] **Step 2: Run** `node --test lib/telegram.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** `REPLY` holds every fixed string, exact copy (functions of `pr` where shown):
  - `coverAdded` `Cover added to PR #${pr}, preview rebuilding.` · `coverSame` `Cover already on PR #${pr}.`
  - `twoDrafts` `Two drafts are open: reply to the one this photo is for.` · `noDraft` `No draft is open.`
  - `resendPhoto` `Send it as a photo (JPEG or PNG, under 5 MB).`
  - `editAsk` `What should change in PR #${pr}?` · `editQueued` `Edit queued for PR #${pr}.`
  - `notGreen` `Checks not green yet for PR #${pr}, try after the next message.`
  - `merged` `Merged PR #${pr}, deploying.` · `rejected` `Rejected PR #${pr}, branch deleted.`
  - `alreadyMerged` `PR #${pr} is already merged.` · `notOpen` `PR #${pr} is no longer open.`
  - `help` `Reply to a draft with a photo, or use its buttons.` · `failed` `Failed: ${oneLine}`
  - `previewFailed` `Preview failed for PR #${pr}: ${url}` · `live` `Live: ${url}` (one line per post) · `editFailed` `PR #${pr}: ${commentBody}`
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(bot): parse Telegram updates and build messages`.

---

### Task 5: Adapters

**Files:**
- Create: `lib/telegramApi.ts`, `lib/githubWrite.ts`, `lib/adapters.test.ts`

**Interfaces:**
- Consumes: `Keyboard` (Task 4), `PrInfo`, `isDraftPr` (Task 3).
- Produces:
  ```ts
  // lib/telegramApi.ts
  export type TelegramApi = {
    sendMessage(chatId: string, html: string, opts?: { keyboard?: Keyboard; forceReply?: boolean }): Promise<void>;
    answerCallback(id: string): Promise<void>;
    downloadFile(fileId: string): Promise<{ bytes: Uint8Array; filePath: string }>;
  };
  export function telegramApi(token: string, fetchImpl?: typeof fetch): TelegramApi;

  // lib/githubWrite.ts
  export const REPO = "Kumar-Prasannajit/portfolio";
  export type GitHubRepo = {
    getPr(n: number): Promise<PrInfo>;
    prFiles(n: number): Promise<{ filename: string; status: string }[]>;
    fileAt(path: string, ref: string): Promise<string>;
    commitMessage(sha: string): Promise<string>;
    checks(sha: string): Promise<{ runs: { name: string; conclusion: string | null }[];
      statuses: { context: string; state: string }[] }>;
    commitFiles(branch: string, files: { path: string; content: Uint8Array | string }[],
      message: string): Promise<string | null>;   // new sha, or null when the tree is unchanged
    merge(n: number): Promise<void>;               // merge_method "merge"
    close(n: number): Promise<void>;
    deleteBranch(branch: string): Promise<void>;   // 404/422 (already gone) counts as success
    comment(n: number, body: string): Promise<void>;
    listOpenDrafts(): Promise<PrInfo[]>;           // open PRs passing isDraftPr
    prsForSha(sha: string): Promise<number[]>;
    previewUrl(sha: string): Promise<string | null>; // newest Preview deployment's environment_url
    issue(n: number): Promise<{ title: string; body: string }>;
    closeIssue(n: number): Promise<void>;
  };
  export function githubRepo(token: string, fetchImpl?: typeof fetch): GitHubRepo;
  ```
- `commitFiles`: base64 blobs → tree with `base_tree` = the head commit's tree → if the new tree sha equals the base tree sha, return `null` → commit with the head as parent → `PATCH` the ref (not forced). Non-2xx GitHub responses throw `Error(\`GitHub ${method} ${pathAfterRepo} → ${status}\`)`.

- [ ] **Step 1: Write the failing tests** with a recording fake `fetch`:
  - `downloadFile` when the file download returns 500 rejects with a message containing neither the token nor `/file/bot`.
  - `sendMessage` posts `parse_mode: "HTML"`, `link_preview_options: { is_disabled: true }`, and `reply_markup` = the keyboard, or `{ force_reply: true }` with `forceReply`.
  - `commitFiles` returns `null` and makes no commit or ref call when the new tree sha equals the base tree sha (Review Focus 2).
  - `deleteBranch` resolves on 422.
  - Every GitHub request carries `Authorization: Bearer <token>` and targets `https://api.github.com/repos/Kumar-Prasannajit/portfolio/…`.
- [ ] **Step 2: Run** `node --test lib/adapters.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** both adapters.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(bot): add Telegram and GitHub adapters`.

---

### Task 6: The webhook

**Files:**
- Create: `lib/telegramBot.ts`, `lib/telegramBot.test.ts`, `app/api/telegram/route.ts`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces:
  ```ts
  export type BotDeps = { gh: GitHubRepo; tg: TelegramApi; chatId: string };
  export function secretMatches(header: string | null, secret: string | undefined): boolean; // timingSafeEqual; false if either is missing
  export async function handleUpdate(update: unknown, deps: BotDeps): Promise<void>;
  ```
- Behaviour (spec §1, §4, §6):
  - **photo:** PR from the reply, else the single open draft, else `twoDrafts` / `noDraft`. `ext: null` or `size > 5_000_000` → `resendPhoto`. Otherwise download, then `commitFiles(branch, [image at coverPath(first post).file, withCoverImage(first post source)], "Cover for #<pr>")` → `coverAdded`, or `coverSame` on `null`.
  - **button:** `answerCallback` first. `pub`: merged → `alreadyMerged`; closed → `notOpen`; `requiredChecksGreen` false → `notGreen`; else `merge`, `deleteBranch`, `merged`. `edit`: send `editAsk` with `forceReply`. `rej`: merged → `alreadyMerged`; closed → `notOpen`; else `close`, `deleteBranch`, `rejected`.
  - **editText:** `comment(pr, "edit: " + text)` → `editQueued`. **help:** `help`.
  - A PR failing `isDraftPr` → `notOpen` and nothing else. Any thrown error → `failed` with the error message's first line.
- Route (`@/lib/telegramBot` etc. allowed here): `export const dynamic = "force-dynamic"`; `POST(request)` returns `new Response(null, { status: 200 })` unless `secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)`; otherwise `await handleUpdate(await request.json(), deps from env)` in a try/catch that logs only `err.message`, then 200.

- [ ] **Step 1: Write the failing tests** with fake `gh`/`tg` recording calls:
  - `secretMatches("s","s")` true; `("x","s")`, `(null,"s")`, `("s",undefined)` false.
  - A stranger's update → no `gh` or `tg` call.
  - Photo reply on draft PR 21 → one `commitFiles` on `draft/weekly-009` with `public/covers/weekly-009-….jpg` and the post containing `coverImage: "/covers/weekly-009-….jpg"`, message `Cover for #21`; reply `coverAdded`.
  - The same photo twice, second `commitFiles` → `null` → `coverSame` (Review Focus 2).
  - Plain photo with two open drafts → `twoDrafts`, no commit; with none → `noDraft`.
  - GIF document → `resendPhoto`, no download.
  - `pub:21` with checks pending → `notGreen`, no merge; green → `merge(21)`, `deleteBranch("draft/weekly-009")`, `merged`.
  - `pub:21` and `rej:21` on a merged PR → `alreadyMerged`, no merge or close; on a closed unmerged PR → `notOpen` (Review Focus 5).
  - `pub:7` where PR 7 is `feat/x` without the label → `notOpen`, no merge.
  - `edit:21` → `editAsk` with `forceReply`; the edit text → `comment(21, "edit: shorter intro")`, `editQueued`.
  - Plain text → `help` (Review Focus 4).
  - `gh.merge` throws `Error("GitHub PUT /pulls/21/merge → 409")` → `Failed: GitHub PUT /pulls/21/merge → 409`.
- [ ] **Step 2: Run** `node --test lib/telegramBot.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `lib/telegramBot.ts` and the route.
- [ ] **Step 4: Run** `npm test && npx tsc --noEmit && npm run lint && npx next build --webpack` — Expected: all clean (local Turbopack builds fail on Google Fonts in this repo; `--webpack` is the local check).
- [ ] **Step 5: Commit** `feat(bot): handle Telegram updates at /api/telegram`.

---

### Task 7: Notifications and the workflow

**Files:**
- Create: `lib/telegramNotify.ts`, `lib/telegramNotify.test.ts`, `scripts/notify-telegram.mjs`, `scripts/fixtures/telegram/deployment-pending.json`, `.github/workflows/telegram-notify.yml`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces:
  ```ts
  export type NotifyDeps = { gh: GitHubRepo; tg: TelegramApi; chatId: string; now: Date };
  export type DeploymentEvent = { environment: string; state: string; sha: string;
    environmentUrl: string | null; targetUrl: string | null };
  export async function notifyDeployment(e: DeploymentEvent, deps: NotifyDeps): Promise<string>; // a log line
  export async function notifyReminders(deps: NotifyDeps): Promise<string>;
  export async function notifyLogIssue(issue: number, deps: NotifyDeps): Promise<string>;
  export async function notifyEditFailed(pr: number, body: string, deps: NotifyDeps): Promise<string>;
  ```
- `notifyDeployment`: a state other than `success`/`failure`/`error` returns `skip: <state>` before any network call. `Preview` → the spec's draft or preview-failed message; `Production` + `success` → `live` lines. (The spec's `preview` and `live` subcommands are one `deployment` subcommand, split by environment.)
- `scripts/notify-telegram.mjs <deployment|reminders|log-issue <n>|edit-failed>`: `assertNode()`, dynamic imports like `check-content.mjs`, reads `GITHUB_EVENT_PATH`, `GITHUB_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; prints the returned line; usage and exit 1 on an unknown subcommand.
- Workflow (Node 24 and `npm ci` as in `content-check.yml`; permissions `contents: read`, `pull-requests: read`, `issues: write`, `deployments: read`, `statuses: read`, `checks: read`; env from secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`):
  - `deployment_status` → `deployment`.
  - `issues: [opened]` with `if: contains(github.event.issue.labels.*.name, 'automation-log')` → `log-issue ${{ github.event.issue.number }}`.
  - `issue_comment: [created]` with `if: github.event.issue.pull_request && startsWith(github.event.comment.body, 'Edit failed')` → `edit-failed`.
  - `schedule: - cron: "30 4 * * *"` → `reminders`.

- [ ] **Step 1: Write the failing tests** with fakes:
  - Preview `success` for the head sha of open draft PR 21 → one draft message with the keyboard; head commit `Cover for #21` → it starts `Updated · `.
  - Preview `failure` → `Preview failed for PR #21: <targetUrl>`.
  - `pending` / `in_progress` → `skip: …`, no `gh` call.
  - Preview for a non-draft PR's sha, or a sha with no PR → nothing sent (Review Focus 3).
  - Production `success` for the merge sha of merged draft PR 21 with two posts → one message with two `Live: https://www.kumarp.in/weekly/…` lines; for a merged non-draft PR → nothing (Review Focus 3).
  - `notifyReminders`: a draft created 21 h before `now` → reminder with keyboard and preview URL; 5 h → none.
  - `notifyLogIssue(31)` → sends the escaped `<b>title</b>` and body, then `closeIssue(31)`.
  - `notifyEditFailed(21, "Edit failed: check:content still fails")` → `PR #21: Edit failed: check:content still fails`.
- [ ] **Step 2: Run** `node --test lib/telegramNotify.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the module, the script and the workflow.
- [ ] **Step 4: Run** `npm test`, then `GITHUB_EVENT_PATH=scripts/fixtures/telegram/deployment-pending.json GITHUB_TOKEN=x TELEGRAM_BOT_TOKEN=x TELEGRAM_CHAT_ID=1 node scripts/notify-telegram.mjs deployment` — Expected: prints `skip: pending`, exit 0.
- [ ] **Step 5: Commit** `feat(bot): send draft, reminder and log messages from Actions`.

---

### Task 8: Edit routine and `automation-log` issues

**Files:**
- Create: `automation/apply-edit.md`
- Modify: `automation/draft-posts.md` (§9 Finish); `.github/workflows/telegram-notify.yml` (Path B only)

**Interfaces:**
- Consumes: Task 1's **Decision**; the `Edit #<pr>:` commit prefix; the `Edit failed:` comment prefix.

- [ ] **Step 1:** Write `automation/apply-edit.md` in the voice and layout of `draft-posts.md`: (1) stop unless the comment starts `edit:`, its author is `Kumar-Prasannajit`, and PR `<n>` is open, labelled `draft-post`, head `draft/*`; (2) `npm ci`, check out the PR branch; (3) apply the instruction to that PR's `content/blog|weekly/*.mdx` files only, keeping `draft-posts.md`'s writing rules (voice, length, `linkedin` caption rules, employer rule); (4) `npm run check:content`, one fix attempt; (5) push one commit `Edit #<n>: <first 60 chars>`; (6) on any stop after step 1, push nothing and comment `Edit failed: <one-line reason>`; (7) end with one log line.
- [ ] **Step 2:** In `draft-posts.md` §9: a run that makes no PR (every stop case, including "draft already open") opens an issue labelled `automation-log` (create the label if missing, colour `808080`), titled `<mode> run <IST date>: no PR`, body the one-line reason. A run that opens a PR opens no issue.
- [ ] **Step 3:** Create the routine `portfolio-draft-edit` with `RemoteTrigger` `create`: environment `env_01VFHa7druHLyaLXQ9Z4xFaD` (`portfolio-routines`), model `claude-sonnet-5-5`, repo `Kumar-Prasannajit/portfolio`, no schedule, no connectors (clear them as part (a) did), prompt `Follow automation/apply-edit.md for this comment.` Then Path A: `create_webhook_trigger` per the Decision; or Path B: the `edit` job in the workflow and `ROUTINE_TRIGGER_TOKEN` added to Task 9's setup. Give the user the routine URL.
- [ ] **Step 4: Verify** on a throwaway draft PR: comment `edit: make the title shorter`. Expected: within minutes a commit `Edit #<n>: make the title shorter` on its branch with `content-check` green, and the run log shows step 1's three checks.
- [ ] **Step 5: Commit** `feat(automation): apply edit comments and report empty runs as issues`.

---

### Task 9: Setup, docs and acceptance

**Files:**
- Modify: `.env.example`, `docs/PROGRESS.md`

- [ ] **Step 1:** `.env.example`: a block headed `# Telegram review bot (docs/superpowers/specs/2026-10-29-telegram-review-bot-design.md)` with `TELEGRAM_BOT_TOKEN=`, `TELEGRAM_WEBHOOK_SECRET=`, `TELEGRAM_CHAT_ID=`, `GITHUB_WRITE_TOKEN=`, and the token's exact scope (only `Kumar-Prasannajit/portfolio`; Contents, Pull requests, Issues: read and write; nothing else).
- [ ] **Step 2:** `docs/PROGRESS.md`: a `## Post automation (part b)` section after part (a): status, the routine id, the workflow, the env vars, and the spec's decisions.
- [ ] **Step 3: User setup** (the user holds the secrets): the BotFather token; the chat id from `https://api.telegram.org/bot<token>/getUpdates`; the fine-grained token; the Vercel env vars and a redeploy; Actions secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (plus `ROUTINE_TRIGGER_TOKEN` on Path B); then:
  ```bash
  curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
    -d url=https://www.kumarp.in/api/telegram \
    -d secret_token="$TELEGRAM_WEBHOOK_SECRET" \
    --data-urlencode 'allowed_updates=["message","callback_query"]'
  curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
  ```
  Expected: `"ok":true`, then the `url` set and no `last_error_message`. In Vercel → Settings → Deployment Protection, make sure a preview link opens on the phone (Review Focus 1).
- [ ] **Step 4: Acceptance** — the spec's §7 list in order, on PR #21 if still open (an empty commit to its branch triggers a fresh preview message) and a throwaway draft for Reject; record each result in `docs/PROGRESS.md`.
- [ ] **Step 5: Commit** `docs(progress): record the Telegram review bot`, push the branch, open the PR.
