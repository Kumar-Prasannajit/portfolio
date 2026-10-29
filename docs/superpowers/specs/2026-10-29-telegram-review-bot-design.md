# Post automation, part (b): Telegram review bot (design spec)

Date: 2026-10-29 · Branch: `feat/telegram-review-bot` · Status: approved in chat, awaiting written-spec review

## Goal

Review and publish the drafts from part (a) from the phone, without opening GitHub. A draft opens on
Sunday, the user's phone gets the post with a preview link, the user sends one photo and taps
Publish, and a few minutes later the post is live on www.kumarp.in with that cover.

It also fixes the stall of 2026-10-18 to 2026-10-29: draft PRs #19 and #20 sat unmerged for over a
week, the duplicate guard in `automation/draft-posts.md` made the next blog and weekly runs no-ops,
and nothing told the user. Under (b), no run is silent and no open draft is forgotten.

## Where this sits

| Part | What it does | Status |
|---|---|---|
| (a) Drafting | Routines draft posts into `draft-post` PRs | live since 2026-10-11 |
| **(b) Telegram loop** | The bot sends each draft, takes a cover photo, edits, Publish and Reject | **this spec** |
| (c) LinkedIn | After the production deploy of a published draft, posts caption, cover and link to LinkedIn; warns before the ~60-day token expires | next spec; plugs into the `live` step (section 4) |
| (d) Site | Shows `coverImage` on blog and weekly posts; a "Discuss on LinkedIn" link | later spec |

## Decisions (made in chat, 2026-10-29)

1. **`edit:` is an AI rewrite.** The instruction is posted on the PR as a comment; a routine applies it
   and pushes.
2. **Publish is a button.** A photo only adds the cover. Merging happens on a tap of **Publish**,
   after the user has seen the preview with that cover.
3. **Reject closes the PR and deletes its branch.**
4. **The cover is optional.** Without one, the post falls back to the generated OG image
   (`lib/og.tsx`), on the site and on LinkedIn.
5. **Routine logs travel as short-lived GitHub issues** labelled `automation-log`. The repo is public,
   so these one-liners are visible after they are closed; they hold nothing the PR bodies don't.
6. **Publish also posts to LinkedIn** (one tap does both). Until (c) ships, the bot only reports that
   the post is live.
7. **Daily reminder at 10:00 IST** for every draft open longer than 20 hours.
8. **Architecture: GitHub Actions send, a Vercel route receives.** Rejected: everything in Vercel
   (repo webhooks, more public routes, no history in Actions), and an always-on long-polling bot on
   the VPS (an extra process beside the Salonjaa CRM for a twice-a-week job).

## Constraints

- **Free:** Telegram Bot API, GitHub Actions, Vercel Hobby, the user's Claude Code routines.
- **Human approval:** nothing merges without a tap of Publish by the user.
- **Allowlist unchanged:** the edit routine edits only the post on the draft branch; it reads no
  repos beyond what part (a) allows, and nothing from the user's employer.
- **No polling or waiting:** every step is started by an event GitHub or Telegram already sends, so
  Vercel's function time limit never matters.
- **Node ≥ 22.18**, as in part (a): scripts import `lib/*.ts` through Node's native TypeScript support.

## 1. Message flow

**One message per draft version.** Nothing is sent when a PR opens, since its preview isn't ready.
When Vercel's preview deployment for a `draft-post` PR succeeds, the user gets one message:

```
Weekly #009 · PR #21
<title>

<summary>

Please check:
• <each CHECK item, or "nothing flagged">

LinkedIn:
<the linkedin caption>

Preview: <preview url>
[ Publish ] [ Edit ] [ Reject ]
```

Each later push to the branch (a cover, an edit) rebuilds the preview, and the message comes again
headed **Updated**. Older messages' buttons still work and act on the PR as it is now. A PR with
several weekly posts (`Draft: Weekly #NNN–#MMM`) lists each post's title and caption in the same
message; a cover photo applies to the first post (section 3).

**User actions:**

| User does | Bot does | Bot replies |
|---|---|---|
| Sends a photo, replying to a draft message (or not replying, when exactly one draft is open) | Commits the cover and the `coverImage` frontmatter in one commit | "Cover added to #21, preview rebuilding." The Updated message follows |
| Sends a photo, not replying, with two or more drafts open | Nothing | "Two drafts are open: reply to the one this photo is for." |
| Taps **Edit** | Asks for the instruction | "What should change in #21?" (a forced reply) |
| Replies to that question | Comments `edit: <text>` on the PR | "Edit queued for #21." The Updated message follows when the routine pushes |
| Taps **Publish** | Merges the PR (merge commit, like every other PR in the repo) and deletes the branch | "Merged #21, deploying." Then the `live` message (section 4) |
| Taps **Reject** | Closes the PR and deletes the branch | "Rejected #21, branch deleted." |

**Other messages:**
- **Reminder**, daily at 10:00 IST, for each `draft-post` PR open longer than 20 hours: one line
  (`Still waiting: Weekly #009, PR #21, open 2 days`), the preview link, and the three buttons.
- **Routine log:** a routine run that makes no PR opens an `automation-log` issue; its title and body
  are sent and the issue is closed.
- **Preview failed:** a `draft-post` PR whose preview deployment fails sends the PR number and the
  link to the build log.
- **Edit failed:** the edit routine's failure comment on the PR (section 2) is forwarded.

**Length:** a Telegram message holds at most 4,096 characters. When a draft message would be longer
(a multi-week PR), each caption is cut at a sentence boundary and ends "… (full caption in the PR)".

**Matching a reply to its PR:** every message the bot sends carries `PR #<n>` in its text. A reply's
PR is read from the message it replies to (`reply_to_message.text`); button presses carry the PR in
their `callback_data` (`pub:21`, `edit:21`, `rej:21`). Nothing is stored.

## 2. Components

The logic is pure and tested; the network code makes no decisions, the same split as
`lib/activity.ts` and `scripts/collect-activity.mjs`.

**Pure (no network, `node --test`, added to `npm test`):**
- **`lib/telegram.ts`**
  - `parseUpdate(update, chatId)`: turns a Telegram update into one intent: `photo` (file id and
    PR, if replying), `button` (action and PR), `editText` (PR and text), or `ignore`. Anything not
    from `chatId` is `ignore`.
  - `prFromText(text)`: reads `PR #<n>` from a message.
  - `draftMessage(draft, previewUrl, { updated })`, `reminderMessage(…)`, `logMessage(…)`: Telegram
    HTML, with every inserted string escaped; `draftKeyboard(pr)`.
- **`lib/draftPost.ts`**
  - `postFiles(changedFiles)`: the `content/blog/*.mdx` or `content/weekly/*.mdx` files a PR adds.
  - `draftFromPost(source, prBody)`: title, kind, number, summary (weekly) or excerpt (blog), the
    `linkedin` caption, and the PR body's **Please check** items.
  - `coverPath(kind, slug, ext)`: `public/covers/<kind>-<slug>.<ext>`, served as `/covers/…`.
  - `withCoverImage(source, url)`: sets or replaces `coverImage` in the frontmatter, leaving every
    other byte of the file as it was.

**Adapters:**
- **`lib/telegramApi.ts`:** `sendMessage`, `answerCallbackQuery`, `downloadPhoto(fileId)` (via
  `getFile`; the file URL contains the bot token and is never logged or returned in an error).
- **`lib/githubWrite.ts`:** REST calls with `GITHUB_WRITE_TOKEN`:
  - `getDraftPr(n)`: the PR, refusing anything not labelled `draft-post` or whose head isn't
    `draft/*`; its changed files; its combined check status.
  - `commitFiles(branch, files, message)`: one commit through the Git Data API (blobs, tree,
    commit, ref update), so a cover is one commit and one preview build.
  - `merge(n)`, `close(n)`, `deleteBranch(ref)`, `comment(n, body)`, `listOpenDrafts()`,
    `prForSha(sha)`, `closeIssue(n)`.

**Entry points:**
- **`app/api/telegram/route.ts`** (`POST`, `dynamic = "force-dynamic"`): checks the secret header,
  parses the update, runs the action through the adapters, replies, and always returns 200.
- **`scripts/notify-telegram.mjs <preview|reminders|log-issue|live>`**, run by the workflow:
  - `preview`: reads the `deployment_status` payload; finds the PR for the deployment's sha; if it
    is an open `draft-post` PR, sends the draft message (success) or the failure message (failure
    or error). "Updated" when the head commit is one the bot or the edit routine made (its message
    starts `Cover for #` or `Edit #`), so a draft the routine pushed in several commits still
    arrives as new.
  - `reminders`: every open `draft-post` PR older than 20 hours gets a reminder.
  - `log-issue`: sends the issue's title and body, then closes it.
  - `live`: for a production deployment whose sha is the merge commit of a `draft-post` PR, sends
    "Live: <url of each post>". Part (c) adds the LinkedIn post here.
- **`.github/workflows/telegram-notify.yml`:**
  - `deployment_status` → `preview` (environment `Preview`) or `live` (environment `Production`,
    state `success`). Every other deployment is skipped by the script, not the workflow.
  - `issues: [opened]`, when labelled `automation-log` → `log-issue`.
  - `schedule: "30 4 * * *"` (10:00 IST) → `reminders`.
  - `issue_comment: [created]` on a `draft-post` PR, starting `Edit failed` → forward.
  - Permissions: `contents: read`, `pull-requests: read`, `issues: write` (to close log issues).

**Edit routine:** `portfolio-draft-edit`, a third routine in the `portfolio-routines` environment,
following new instructions in **`automation/apply-edit.md`**:
- It fires on an `issue_comment` that starts with `edit:`, on an open PR labelled `draft-post`,
  written by `Kumar-Prasannajit`.
- It checks out the PR's branch, applies the instruction to the post only (frontmatter and body;
  never other files), keeps the part (a) writing rules, runs `npm run check:content`, and pushes
  one commit `Edit #<pr>: <first 60 chars of the instruction>`.
- If it can't apply the edit, or `check:content` still fails after one fix, it pushes nothing and
  comments `Edit failed: <reason>` on the PR.
- **To verify first in the plan:** whether a routine's GitHub trigger can filter on these comment
  fields. If it can't, a small job in `telegram-notify.yml` fires on the same comment and starts
  the routine through its API trigger, with the PR number in the run's text.

**Changes to existing files:**
- **`automation/draft-posts.md` §9:** a run that makes no PR opens an issue labelled
  `automation-log` (creating the label if missing), titled `<mode> run <IST date>: no PR`, with the
  one-line reason as its body. This includes "draft already open".
- **`lib/contentCheck.ts`:** optional `coverImage`: a string starting with `/covers/`, ending in
  `.jpg`, `.jpeg` or `.png`, naming a file that exists under `public/`.
- **`lib/content.ts`:** `coverImage?: string` on both post types. Not rendered yet: part (d) shows
  it and part (c) uses it.

## 3. Covers

- Telegram sends the user's photo as several sizes; the bot takes the largest (Telegram caps it at
  1280px on the long side, JPEG). A photo sent as a file is accepted when it is JPEG or PNG under
  5 MB; anything else gets "Send it as a photo (JPEG or PNG, under 5 MB)."
- Saved at `public/covers/<kind>-<slug>.<ext>`, where `<slug>` is the post's file name without
  `.mdx` (for example `public/covers/weekly-009-phone-polish.jpg`). A second photo for the same post
  overwrites it and the frontmatter is unchanged, so the post keeps one cover.
- The commit adds the image and sets `coverImage: /covers/<kind>-<slug>.<ext>` in one commit:
  `Cover for #<pr>`.
- For a PR with several weekly posts, the photo goes on the first post; the others fall back to the
  OG image. (Per-post covers in a multi-week PR are not needed: since the per-week change, a normal
  Sunday run makes one post.)

## 4. Publish, and the hand-off to (c)

1. Publish reads the head commit's check runs and statuses. Unless `content-check` and the Vercel
   preview are both present and green (a missing one counts as not green), it replies "Checks not green yet for #21, try after the next message." and stops.
2. Otherwise it merges with a merge commit, deletes the branch and replies "Merged #21, deploying."
3. Vercel deploys `main` to production; its `deployment_status` (Production, success) runs `live`.
4. `live` finds the PR whose merge commit is the deployed sha and, if it is a `draft-post` PR, sends
   "Live: https://www.kumarp.in/weekly/<slug>" (one line per post).

Part (c) replaces step 4's message with: post to LinkedIn, then "Live, and on LinkedIn: <post url>".
Everything (c) needs is in the merged post: `linkedin`, `coverImage` (or the OG image URL) and the
post's URL.

## 5. Security

- **Webhook:** set with `setWebhook(url, secret_token = TELEGRAM_WEBHOOK_SECRET,
  allowed_updates = ["message", "callback_query"])`. The route compares the
  `X-Telegram-Bot-Api-Secret-Token` header in constant time; a mismatch, or any update not from
  `TELEGRAM_CHAT_ID`, gets an empty 200 and no reply.
- **Scope:** the bot acts only on PRs labelled `draft-post` with a `draft/*` head branch, in
  `Kumar-Prasannajit/portfolio`. A forged `callback_data` naming any other PR does nothing.
- **Tokens:**
  - Vercel: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_CHAT_ID`,
    `GITHUB_WRITE_TOKEN` (new fine-grained token, only `Kumar-Prasannajit/portfolio`; Contents,
    Pull requests and Issues read/write; nothing else).
  - GitHub Actions secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. The workflow uses its built-in
    `GITHUB_TOKEN` for GitHub.
  - Nothing logs a token or the Telegram file URL.
- **Edits:** the edit routine accepts only comments by `Kumar-Prasannajit`, on `draft-post` PRs, and
  changes only the post files of that PR.

## 6. Failure handling

| Situation | Result |
|---|---|
| Telegram resends an update (any non-200 is retried) | Every action is safe to repeat: merging a merged PR or closing a closed one replies "#21 is already merged / closed." |
| A GitHub call fails | One-line error reply; the user presses the button again |
| Publish with checks pending or failing | No merge; "Checks not green yet" |
| Photo too large or not an image | Asked to resend (section 3) |
| Photo with two drafts open and no reply | Asked which draft |
| Button or reply for a PR that is no longer open | "#21 is no longer open." |
| Edit routine can't apply the edit | `Edit failed: <reason>` comment, forwarded |
| Preview deployment fails | "Preview failed for #21" with the build log link |
| Scheduled workflow runs late | Fine; reminders aren't time-critical |
| A routine run makes no PR | `automation-log` issue, forwarded and closed |

## 7. Testing

**Unit tests** (`node --test`, in `npm test`), with saved Telegram update payloads as fixtures:
- `parseUpdate`: photo with and without a reply, each button, an edit reply, a stranger's message,
  a message in another chat.
- `prFromText`; the two-drafts-open case.
- Message builders escape `<`, `>` and `&` in titles, summaries and captions.
- `draftFromPost` for a blog, a weekly and a multi-week PR body; `withCoverImage` adds and replaces
  the field and leaves the rest of the file byte-identical.
- `contentCheck`: `coverImage` passes for an existing file, fails for a missing one or a path outside
  `/covers/`.

**Route test:** the handler with fake adapters: a wrong secret and a wrong chat id do nothing; a
non-draft PR is refused; a repeated Publish replies "already merged"; Publish with pending checks
doesn't merge.

**Acceptance** (on a real draft; the #009 PR from the 2026-10-29 rerun if still open):
1. The preview message arrives with the right title, caption and preview link.
2. A photo leads to "Cover added", then an Updated message; the preview has `coverImage` set.
3. Edit with a small instruction leads to "Edit queued", then an Updated message with the change.
4. Publish merges, and the `live` message arrives with the live URL.
5. A throwaway draft is rejected: the PR is closed and its branch is gone.
6. A blog run with a draft already open produces an `automation-log` message and a closed issue.
7. The next 10:00 IST reminder arrives for a draft left open.

## Setup (once, by the user)

1. Create the bot with @BotFather; note its token. Send it any message, and read the chat id from
   `getUpdates`.
2. Create the fine-grained `GITHUB_WRITE_TOKEN` (section 5).
3. Add the Vercel env vars and redeploy; add the two Actions secrets.
4. Call `setWebhook` once (a command in the plan) pointing at `https://www.kumarp.in/api/telegram`.
5. Create the `portfolio-draft-edit` routine and its trigger.

## Out of scope for (b)

- Posting to LinkedIn and the token renewal flow (c).
- Rendering `coverImage` on the site (d).
- More than one Telegram user, group chats, or commands beyond the four actions.
- Changing what part (a) drafts or when it runs, beyond the `automation-log` issue.
