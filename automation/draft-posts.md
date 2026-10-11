# Drafting posts

Instructions for the two Claude Code routines that draft the site's posts. Each
routine is started with "Follow automation/draft-posts.md with mode: `weekly`"
or "... mode: `blog`". Follow the steps below in order. This file is versioned,
so edit it like code.

| Mode | Runs | Writes |
|---|---|---|
| `weekly` | Sunday 18:00 IST | `content/weekly/<NNN>-<slug>.mdx` |
| `blog` | Friday 18:00 IST | `content/blog/<slug>.mdx` |

You draft; the owner approves. **Never merge a PR, and never push to `main`.**

## Hard rules

- **Employer.** The owner works for AIdeas-Tech-Solutions-Private-Limited.
  Nothing from that company's repos may be read, used or written about, and a
  post must not mention the company or the owner's day-job work.
  `npm run check:content` rejects the company's name.
- **Allowlist.** Only the owner's own account, the `salonjaa-digital-solution`
  org, and three named repos (`ALLOWED_OWNERS` and `ALLOWED_REPOS` in
  `lib/githubTools.ts`) count. `npm run collect:activity` already enforces
  this. Don't browse, search or read any other repo, even to "add context".
  Salonjaa client projects may be named in posts.
- **Truthfulness.** Every factual claim must trace to the activity JSON, the
  files of an allowed repo, or the idea's notes. Don't invent numbers, dates,
  tools or motives. Where you are unsure, leave a marker at that spot:
  `{/* CHECK: what to verify */}`. (MDX has no HTML comments, so don't write
  `<!-- -->`. It would break the site build.)
- **Dates** are in Asia/Kolkata (IST), written as quoted `"YYYY-MM-DD"`.
- **Braces.** The site drops anything in `{…}` from the rendered post. Write
  `{` and `}` only inside backticks or code fences. The one exception is the
  CHECK marker, which belongs in the body, never in frontmatter.
- **No employer in the PR either.** The title, branch name, body and commit
  messages follow the same rule as the post. Don't copy a commit message that
  mentions the company; the collector already drops those.

## 1. Setup

1. `node --version` must be 22.18 or newer. If not, stop and log that.
2. If `node_modules` is missing, run `npm ci`.
3. Run `npm run check:content`. It must pass before you draft anything; if it
   doesn't, stop and log the output (an existing post is broken, and the dates
   used below would be wrong).
4. Work out the run date (IST):

   ```bash
   node --input-type=module -e 'import { istDate } from "./lib/activity.ts"; console.log(istDate(new Date()))'
   ```

## 2. Duplicate guard

List the open pull requests (use the GitHub tools; `gh` isn't available). If one
has a head branch starting `draft/<mode>-` (for example `draft/weekly-`), stop
and log "draft already open: #<number>". Make no new PR.

## 3. Weekly mode

**Get the facts** (run this block as it is, at the start of a line):

```bash
node --input-type=module <<'JS'
import fs from "node:fs";
import matter from "gray-matter";
import { istDate, weeklySince, alreadyPostedToday, nextWeeklyNumber } from "./lib/activity.ts";

const files = fs.readdirSync("content/weekly").filter((n) => /\.mdx?$/.test(n));
const dates = files.map((n) => matter(fs.readFileSync(`content/weekly/${n}`, "utf8")).data.date);
const runDate = istDate(new Date());
console.log(JSON.stringify({
  runDate,
  since: weeklySince(dates, runDate),
  alreadyPostedToday: alreadyPostedToday(dates, runDate),
  nextNumber: nextWeeklyNumber(files),
}));
JS
```

- If `alreadyPostedToday` is true, stop and log it. An entry already carries
  today's date, so a second one would double up.
- Run `npm run collect:activity -- --since <since>`. The window starts at 00:00
  IST on `since` and ends now.
  - Exit status 1 means every GitHub call failed: stop and log the `errors`.
  - No `commits`: stop and log "no activity since <since>", **followed by the
    `errors`**. A missing token or a failed owner listing can look like a quiet week.
  - Some `errors` but commits: carry on, and list the errors in the PR under
    **Please check**.
- Write `content/weekly/<nextNumber>-<slug>.mdx`, where `<slug>` is kebab-case
  from the title. If that file or the branch `draft/weekly-<nextNumber>` already
  exists (locally or on `origin`), stop and log it. Never overwrite.
  - **Length:** about 250 to 500 words.
  - **Content:** what shipped and why, in the owner's voice, **grouped by
    project, not by commit**. Read the changed files of an allowed repo when a
    commit message isn't enough to say what actually changed.

```yaml
---
title: "..."
date: "<runDate>"
summary: "One sentence for the index card."
cover: "<nextNumber>"
linkedin: |
  ...
---
```

## 4. Blog mode

**Pick the idea** (the first unticked line of `content/ideas.md`):

```bash
node --input-type=module -e 'import fs from "node:fs"; import { pickIdea } from "./lib/activity.ts"; console.log(JSON.stringify(pickIdea(fs.readFileSync("content/ideas.md", "utf8"))))'
```

- `index` is the line, `topic` is the subject, and `notes` (the text after `—`)
  is the owner's angle and **must be used**.
- If the result is `null`, there is no idea. Get the date 14 days back:

  ```bash
  node --input-type=module -e 'import { istDate, blogSince } from "./lib/activity.ts"; console.log(blogSince(istDate(new Date())))'
  ```

  Run `npm run collect:activity -- --since <that date>` (the collector's exit
  status and `errors` are handled as in weekly mode), then pick the most
  substantial thread: a new integration, a tricky fix, or a design decision with
  trade-offs. If nothing qualifies, stop and log that. Make no PR.
- Write `content/blog/<slug>.mdx` (kebab-case slug from the title). If that file
  or the branch `draft/blog-<slug>` already exists (locally or on `origin`),
  stop and log it. Never overwrite a post.
  - **Length:** about 600 to 1,000 words.
  - **Content:** one idea, argued with concrete details from the owner's own work.
- If an idea was used, tick it in the same commit (this keeps the file's line
  endings):

  ```bash
  SLUG=<slug> IDEA_INDEX=<index> node --input-type=module -e 'import fs from "node:fs"; import { tickIdea } from "./lib/activity.ts"; const md = fs.readFileSync("content/ideas.md", "utf8"); fs.writeFileSync("content/ideas.md", tickIdea(md, Number(process.env.IDEA_INDEX), process.env.SLUG))'
  ```

```yaml
---
title: "..."
date: "<run date>"
tags: ["one", "to-three", "lowercase"]
excerpt: "One or two sentences for the index and the search."
linkedin: |
  ...
---
```

## 5. Voice

Read **every** file in `content/blog` and `content/weekly` before writing, and
match them:

- First person, plain and specific.
- Short paragraphs, `##` headings, bullets for lists.
- No hype words, no emoji, no closing call to action.

## 6. The `linkedin` caption

A YAML `|` block of 600 to 1,300 characters (never over 3,000), plain text and
no markdown. It opens with a hook that works without the rest of the post, has
at most 3 hashtags, and **has no link**. A later step adds the link.

## 7. Check

Run `npm run check:content`. If it fails, fix the draft and run it once more. If
it still fails, **make no PR**: stop and log the full output.

## 8. The PR

1. Branch `draft/weekly-<NNN>` or `draft/blog-<slug>`, created from `main`.
   Commit the post (and `content/ideas.md` in blog mode), then push the branch.
2. Open a pull request against `main` (an ordinary one, not GitHub's "draft" state):
   - **Title:** `Draft: Weekly #<NNN> — <title>` or `Draft: Blog — <title>`.
   - **Label:** `draft-post`. Create the label first if it doesn't exist.
3. The body has these sections, in this order:
   1. A one-paragraph summary.
   2. **Sources:** the commits used, as links, grouped by repo.
   3. **Please check:** each `CHECK` marker quoted, plus every line of the
      collector's `errors`. If there are none, write "nothing flagged".
   4. **LinkedIn caption:** the `linkedin` text, for reading.
   5. "Approve by reviewing the Vercel preview and merging."

## 9. Finish

End with one line of log: the PR link, or why no PR was made (any of the stop
cases above). Then stop; leave the PR for the owner.
