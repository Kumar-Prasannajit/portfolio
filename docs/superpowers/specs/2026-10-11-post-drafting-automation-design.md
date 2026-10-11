# Post automation, part (a): drafting into PRs (design spec)

Date: 2026-10-11 · Branch: `feat/post-automation` · Status: approved in chat, awaiting written-spec review

## Goal

Keep the site's two writing streams alive without the user having to start from a blank page:

- **Blog:** one post every **Friday**.
- **Weekly devlog:** one entry every **Sunday**.

Every post is drafted by an AI and approved by the user before it publishes. Every post also goes to the user's LinkedIn.

## The whole system (for context; only (a) is specified here)

| Part | What it does | Status |
|---|---|---|
| **(a) Drafting** | A Claude Code routine reads the user's allowed GitHub activity and the ideas file, writes the post, and opens a draft PR | **this spec** |
| (b) Telegram loop | A bot sends the draft to the user; the user replies with an image (optionally `edit: ...` first); the post gets the image and the PR is merged | later spec |
| (c) LinkedIn | After deploy, the post is published to the user's LinkedIn with caption, image and link; the bot sends a re-authorize link before the ~60-day token expires | later spec |
| (d) Site | Cover images on blog and weekly posts; a "Discuss on LinkedIn" link | later spec |

Each part is usable on its own. (a) alone already gives the user a reviewed draft PR twice a week. Everything has to be free: Claude Code routines on the user's plan, GitHub Actions, Vercel Hobby, Telegram Bot API, LinkedIn self-serve API.

## Constraints

- **Allowlist.** Activity is read only from repos allowed by `ALLOWED_OWNERS` and `ALLOWED_REPOS` in `lib/githubTools.ts`: the user's account, `salonjaa-digital-solution`, and three named public repos. Nothing from `AIdeas-Tech-Solutions-Private-Limited` (the user's employer) may be read or written about. This is enforced in code, not only in the prompt.
- **Human approval.** Nothing is ever auto-merged by (a).
- **Public repo.** `Kumar-Prasannajit/portfolio` is public, so draft PRs and `content/ideas.md` are publicly visible before approval. The user accepted this.
- **Content format is unchanged.** Posts stay MDX with YAML frontmatter, read by `lib/content.ts` from `content/blog` and `content/weekly`. Salonjaa client projects may be named in posts.

## 1. Schedule and triggers

There are **two Claude Code routines**, both reading the same instructions file `automation/draft-posts.md`:

| Routine | Mode | Schedule |
|---|---|---|
| `portfolio-blog-draft` | `blog` | Friday 18:00 IST (cron `30 12 * * 5`, UTC) |
| `portfolio-weekly-draft` | `weekly` | Sunday 18:00 IST (cron `30 12 * * 0`, UTC) |

Either can be started with "Run now". The first weekly run is started by hand right after setup and produces the catch-up entry **#004**, covering 2026-09-14 to the run date.

**Environment:**
- Network level **Trusted**, which allows GitHub and the npm registry.
- `GITHUB_TOKEN` and `GITHUB_TOKEN_SALONJAA`: the same two read-only fine-grained tokens the site uses (Metadata + Contents read). They are stored in the routine's cloud environment. They only lift GitHub's 60/hour unauthenticated limit: the collector reads **public repos only** (decided 2026-10-11), because a private repo's commit messages would end up in a public PR and post.
- PRs are opened through the Claude GitHub App on the portfolio repo.
- **Node ≥ 22.18.** The scripts import the `lib/*.ts` modules directly through Node's native TypeScript support, as `npm test` already does. The setup checks `node --version` and stops with a clear message if it is older.

## 2. Gathering activity

**`scripts/collect-activity.mjs --since <YYYY-MM-DD> [--until <YYYY-MM-DD>]`** prints JSON to stdout. It is plain code, not AI.

```json
{
  "since": "2026-09-14",
  "until": "2026-10-11",
  "commits": [
    {
      "repo": "Kumar-Prasannajit/portfolio",
      "sha": "7fdd56a",
      "date": "2026-10-11T07:40:00Z",
      "message": "docs(progress): record brutal mode, ...",
      "url": "https://github.com/Kumar-Prasannajit/portfolio/commit/7fdd56a"
    }
  ],
  "errors": []
}
```

**How it works:**
- **Listing repos:** it lists repos per allowed owner the same way `lib/githubActivity.ts` does (`/user/repos?affiliation=owner`, `/orgs/<org>/repos`), plus the `ALLOWED_REPOS` by name. It keeps repos with `private: false` (a missing flag counts as private) and `pushed_at >= since`.
- **Commits:** for each repo it calls `GET /repos/{r}/commits?author=Kumar-Prasannajit&since=…&until=…`, with the token chosen by `githubHeaders(owner)`.
- **Filtering:** commits go through `isAllowedRepo`. Merge commits (those with more than one parent) are dropped.
- **Pure core:** the testable parts live in `lib/activity.ts`. They are the window computation, the commit filtering and mapping, the next weekly number, and choosing the next idea. They import nothing from Next and run under `node --test`, like `lib/githubTools.ts`.
- **Failures:** a failing API call is recorded in `errors` and doesn't throw. If every call fails, the script exits non-zero.

**Windows:**
- **Weekly:** `since` = the `date` of the newest entry in `content/weekly`, **inclusive** (from 00:00 IST that day), so work done after that entry on the same day isn't lost. `until` = the run time. A missed Sunday is therefore covered by the next run.
- All dates written into frontmatter, and "the run date", are in **Asia/Kolkata (IST)**.
- **Blog:** the last 14 days. This is only used when no idea is waiting (section 3).

## 3. Ideas file

**`content/ideas.md`** holds one topic per line:

```md
# Blog ideas

- [ ] Why the Stack section counts projects, not years — the allowlist story
- [x] Idempotent payments → /blog/idempotent-payments-lessons
```

**How the blog run picks a topic:**
- It takes the **first unticked** line. Text after `—` is the user's notes and must be used.
- In the same PR, it ticks that line and appends `→ /blog/<slug>`.
- With no unticked line, it picks the most substantial thread from the last 14 days of activity: a new integration, a tricky fix, a design decision with trade-offs. If nothing qualifies, it opens no PR that Friday.

`lib/content.ts` only reads `content/blog` and `content/weekly`, so `ideas.md` never renders on the site.

## 4. Writing rules (`automation/draft-posts.md`)

The instructions file is versioned in the repo, so the user can edit it like code. It tells the routine to do the following.

**Voice:** match the existing posts in `content/blog` and `content/weekly`, which the routine reads first:
- first person, plain and specific;
- short paragraphs, `##` headings, bullets for lists;
- no hype words, no emoji, no closing call-to-action.

**Length:**
- **Weekly:** about 250–500 words. It covers what shipped and why, in the user's words, grouped by project rather than by commit.
- **Blog:** about 600–1000 words. One idea, argued with concrete details from the user's own work.

**Truthfulness:**
- Every factual claim must trace to the activity JSON, the repo contents, or the idea's notes.
- Anything the model is unsure of gets a `<!-- CHECK: what to verify -->` comment at that spot.
- Never mention AIdeas or employer work.

**Weekly file:** `content/weekly/<NNN>-<slug>.mdx`, where `NNN` is the next number (zero-padded to 3) and `<slug>` is kebab-case from the title. Frontmatter is `title`, `date` (run date), `summary`, `cover` (`"NNN"`) and `linkedin`.

**Blog file:** `content/blog/<slug>.mdx`. Frontmatter is `title`, `date`, `tags` (1–3, lowercase), `excerpt` and `linkedin`.

**`linkedin` field:** a YAML block string holding a 600–1,300 character LinkedIn caption. It opens with a strong hook in plain text and has no markdown, at most 3 hashtags, and no link (part (c) adds the link). `lib/content.ts` doesn't render it; part (c) reads it.

**Before opening the PR:** run `npm ci` (if `node_modules` is missing) and `npm run check:content`. If the checks fail, fix the draft and rerun. If they still fail, open no PR and say why in the run log.

## 5. Content checks

**`npm run check:content`** runs `scripts/check-content.mjs`. The logic lives in a pure, tested `lib/contentCheck.ts`.

It checks every file in `content/blog` and `content/weekly` (not just new ones) for:

1. **Required frontmatter.**
   - Blog: `title`, `date`, `tags` (a non-empty array of strings) and `excerpt`.
   - Weekly: `title`, `date` and `summary`.
   - `linkedin`, if present, is a string of at most 3,000 characters (LinkedIn's post limit).
2. **Dates.** `date` (and `updated`, if present) is a real `YYYY-MM-DD` date.
3. **Weekly numbering.**
   - The `NNN-` prefixes, in date order, are exactly `001, 002, …` with no gaps or duplicates.
   - This matches how `withSequentialNumbers` in `lib/content.ts` numbers entries.
4. **Unique slugs** within each folder.
5. **MDX compiles.** Each body compiles with the MDX compiler `next-mdx-remote` already depends on, so a draft that would break the Vercel build fails here first.
6. **No employer terms.** The case-insensitive substring `aideas` must not appear in frontmatter or body. The term list is a constant in `lib/contentCheck.ts`, so more terms can be added.

The script prints `path: problem` lines and exits 1 on any problem.

**Where it runs:**
- in the routine before every PR;
- in a new GitHub Action, `.github/workflows/content-check.yml`, on `pull_request` with paths `content/**` (so the user's own edits are checked too);
- and, last, in the Vercel preview build, which compiles every post.

## 6. The PR

- **Branch:** `draft/weekly-NNN` or `draft/blog-<slug>`.
- **Title:** `Draft: Weekly #NNN — <title>` or `Draft: Blog — <title>`.
- **Label:** `draft-post`, created if missing.
- **Body, in this order:**
  1. A one-paragraph summary.
  2. **Sources:** the commits used, as links, grouped by repo.
  3. **Please check:** every `CHECK` comment, quoted.
  4. **LinkedIn caption:** the `linkedin` text, for reading.
  5. How to approve: review the Vercel preview and merge.
- **No duplicates:** if an open PR labelled `draft-post` already exists for the same mode (branch prefix `draft/weekly-` or `draft/blog-`), the run makes no new PR and says so in its log.

## 7. Failure handling

| Situation | Result |
|---|---|
| No allowed commits in the weekly window | No PR; the log says "no activity since <date>" |
| Blog run with no idea and nothing substantial | No PR; the log says so |
| Collector exits non-zero (all GitHub calls failed) | No PR; the log includes the errors |
| Some GitHub calls failed | Draft from what was collected; the PR body lists the failed repos under **Please check** |
| `check:content` still fails after one fix attempt | No PR; the log includes the failures |
| An open draft PR of the same mode already exists | No new PR |

In part (b) these log messages are sent to the user on Telegram.

## 8. Testing

**Unit tests** (`node --test`, added to `npm test`):
- **`lib/activity.ts`:**
  - the weekly `since` comes from the newest entry;
  - the blog window is 14 days;
  - commits outside the allowlist, by other authors, or merge commits are dropped;
  - the next weekly number is count + 1, zero-padded;
  - the first unticked idea is chosen, and ticking rewrites only that line.
- **`lib/contentCheck.ts`:** each rule, with a passing and a failing fixture, including the employer-term rule and a numbering gap.

**Script checks:**
- `npm run check:content` passes on the current `content/` tree.
- `scripts/collect-activity.mjs --since 2026-09-14` run locally returns commits only from allowed repos, with none from AIdeas.

**Acceptance:** after the routines are set up, a manual "Run now" of `portfolio-weekly-draft` opens a `Draft: Weekly #004 — …` PR. It must pass `check:content` and the Vercel preview, cite real commits from 2026-09-14 onward, and mention nothing from AIdeas.

## Out of scope for (a)

- Sending or receiving anything on Telegram (b).
- Posting to LinkedIn, and the token renewal flow (c).
- Rendering cover images or LinkedIn links on the site (d).
- Changing how posts render, the blog index, or RSS.
