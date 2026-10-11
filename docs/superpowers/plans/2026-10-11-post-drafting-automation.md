# Post Drafting Automation (part a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two Claude Code routines draft a blog post every Friday and a weekly devlog entry every Sunday from the user's allowed GitHub activity, and open a draft PR that has passed the content checks.

**Architecture:** The deterministic parts are plain Node scripts with pure, unit-tested cores in `lib/`:
- the activity collector reads only allowlisted repos;
- the content checker validates every post.

The writing is done by a Claude Code routine that follows a versioned instructions file. A GitHub Action reruns the content checker on every PR that touches `content/`.

**Tech Stack:** Node ≥ 22.18 (native TypeScript, `node --test`), gray-matter, `@mdx-js/mdx` 3, GitHub REST API, GitHub Actions, Claude Code routines.

**Spec:** `docs/superpowers/specs/2026-10-11-post-drafting-automation-design.md`

## Global Constraints

- **Allowlist:** only repos passing `isAllowedRepo(fullName, ALLOWED_OWNERS, ALLOWED_REPOS)` from `lib/githubTools.ts` are read. Nothing from `AIdeas-Tech-Solutions-Private-Limited`.
- **Commit author login:** `Kumar-Prasannajit`.
- **Timezone:** dates are `YYYY-MM-DD` in Asia/Kolkata (IST). A weekly window starts at 00:00 IST on the newest entry's date, inclusive. The blog window is the last 14 days.
- **Weekly file:** `content/weekly/<NNN>-<slug>.mdx`, with `NNN` zero-padded to 3. Frontmatter: `title`, `date`, `summary`, `cover: "NNN"`, `linkedin`.
- **Blog file:** `content/blog/<slug>.mdx`. Frontmatter: `title`, `date`, `tags` (1–3, lowercase), `excerpt`, `linkedin`.
- **`linkedin` caption:** 600–1,300 characters targeted, 3,000 maximum (enforced). Plain text, at most 3 hashtags, no link.
- **Lengths:** weekly about 250–500 words, blog about 600–1,000 words.
- **Employer term:** `aideas`, case-insensitive, must not appear in any post.
- **PRs:** branch `draft/weekly-NNN` or `draft/blog-<slug>`; title `Draft: Weekly #NNN — <title>` or `Draft: Blog — <title>`; label `draft-post`. Never auto-merged.
- **Schedules:** blog Friday 18:00 IST (`30 12 * * 5` UTC); weekly Sunday 18:00 IST (`30 12 * * 0` UTC).
- **No new runtime dependencies.** `@mdx-js/mdx@^3.1.1` becomes a devDependency (it is already installed through `next-mdx-remote`).
- **Don't add `engines` to `package.json`.** Vercel would use it to pick its Node version. The scripts guard the Node version themselves.

## Review Focus

1. **Unquoted YAML date** (`date: 2026-10-12`). gray-matter parses it as a JS `Date`, not a string. `check:content` must report "`date` must be a quoted YYYY-MM-DD string" (Task 2).
2. **`content/ideas.md` saved with CRLF line endings** (the user edits on Windows). `pickIdea` must still find the line, and `tickIdea` must keep `\r\n` endings (Task 1).
3. **A repo with 100 or more commits in the window.** The collector reads one page, so it must add a "may be truncated" warning to `errors` rather than silently undercounting (Task 1 `pageWarning`, used in Task 4).
4. **A weekly run on the same IST day as the newest entry** (for example the manual #004 run, then that Sunday's scheduled run). It must open no second entry: `alreadyPostedToday` returns true and the routine stops (Task 1, used in Task 5).
5. **An idea line with no `—` notes, or `- [ ]` with extra spaces.** `pickIdea` returns the topic with `notes: ""` and doesn't skip the line (Task 1).

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/activity.ts` (new) | Pure helpers: IST dates and windows, commit filtering and mapping, next weekly number, idea picking and ticking. No imports. |
| `lib/activity.test.ts` (new) | Tests for the above |
| `lib/contentCheck.ts` (new) | Pure content rules: frontmatter, dates, numbering, slugs, employer terms. No imports. |
| `lib/contentCheck.test.ts` (new) | Tests for the above |
| `lib/githubTools.ts` (modify) | Add `repoListUrl(owner, hasToken)`, shared by the site and the collector |
| `lib/githubActivity.ts` (modify) | Use `repoListUrl` instead of its private URL logic |
| `scripts/check-content.mjs` (new) | Reads `content/`, runs `contentCheck` plus the MDX compile, prints problems, sets the exit code |
| `scripts/check-content.test.mjs` (new) | Runs the script on fixture trees |
| `scripts/collect-activity.mjs` (new) | GitHub I/O: lists allowed repos and commits, prints the spec's JSON |
| `scripts/nodeVersion.mjs` (new) | `assertNode()`: exits 1 with a message on Node < 22.18 |
| `.github/workflows/content-check.yml` (new) | Runs `check:content` on PRs touching posts or the checker |
| `automation/draft-posts.md` (new) | The routines' instructions |
| `content/ideas.md` (new) | The blog idea backlog |
| `package.json` (modify) | Scripts `check:content` and `collect:activity`; `test` glob; devDependency |

---

### Task 1: Pure activity helpers

**Files:**
- Create: `lib/activity.ts`
- Test: `lib/activity.test.ts`

**Interfaces:**
- Consumes: nothing. The allowlist is passed in, so the module stays import-free.
- Produces:
  - `type Commit = { repo: string; sha: string; date: string; message: string; url: string }`. `sha` is the first 7 characters; `message` is the first line of the commit message.
  - `istDate(now: Date): string`: the `YYYY-MM-DD` date in Asia/Kolkata.
  - `istMidnightIso(date: string): string`: 00:00 IST of `date` as a UTC ISO string (`"2026-09-14"` → `"2026-09-13T18:30:00.000Z"`).
  - `addDays(date: string, days: number): string`: calendar-day arithmetic on `YYYY-MM-DD` (negative `days` allowed).
  - `weeklySince(entryDates: string[], runDate: string): string`: the newest of `entryDates`, or `runDate` minus 7 days if there are none.
  - `blogSince(runDate: string): string`: `runDate` minus 14 days.
  - `alreadyPostedToday(entryDates: string[], runDate: string): boolean`
  - `toCommits(raw: unknown, repo: string, author: string, allow: (fullName: string) => boolean): Commit[]`: drops items that aren't objects, merge commits (`parents.length > 1`), and commits whose `author.login` differs from `author` (case-insensitive). Drops everything if `allow(repo)` is false.
  - `pageWarning(repo: string, count: number, perPage: number): string | null`: returns `"<repo>: <count> commits, results may be truncated"` when `count >= perPage`.
  - `nextWeeklyNumber(filenames: string[]): string`: the highest `NNN-` prefix + 1, zero-padded to 3; `"001"` if there are none.
  - `pickIdea(markdown: string): { index: number; topic: string; notes: string } | null`: `index` is the 0-based line index of the first `- [ ]` line.
  - `tickIdea(markdown: string, index: number, slug: string): string`: that line becomes `- [x] <rest> → /blog/<slug>`. The original line endings are kept.

- [ ] **Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  istDate, istMidnightIso, addDays, weeklySince, blogSince, alreadyPostedToday,
  toCommits, pageWarning, nextWeeklyNumber, pickIdea, tickIdea,
} from "./activity.ts";

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-01-05", -14), "2025-12-22");
});

test("istDate uses Asia/Kolkata", () => {
  assert.equal(istDate(new Date("2026-10-11T19:00:00Z")), "2026-10-12");
  assert.equal(istDate(new Date("2026-10-11T18:00:00Z")), "2026-10-11");
});
test("istMidnightIso is 00:00 IST in UTC", () => {
  assert.equal(istMidnightIso("2026-09-14"), "2026-09-13T18:30:00.000Z");
});
test("weeklySince is the newest entry date, inclusive", () => {
  assert.equal(weeklySince(["2026-09-01", "2026-09-14", "2026-08-20"], "2026-10-11"), "2026-09-14");
  assert.equal(weeklySince([], "2026-10-11"), "2026-10-04");
});
test("blogSince is 14 days back", () => {
  assert.equal(blogSince("2026-10-16"), "2026-10-02");
});
test("alreadyPostedToday", () => {
  assert.equal(alreadyPostedToday(["2026-09-14", "2026-10-11"], "2026-10-11"), true);
  assert.equal(alreadyPostedToday(["2026-09-14"], "2026-10-11"), false);
});

const c = (over: object) => ({
  sha: "abcdef1234567", html_url: "https://github.com/o/r/commit/abcdef1",
  parents: [{}], author: { login: "Kumar-Prasannajit" },
  commit: { message: "feat: x\n\nbody", author: { date: "2026-10-01T10:00:00Z" } }, ...over,
});
const allowAll = () => true;
test("toCommits maps, keeps first line, short sha", () => {
  assert.deepEqual(toCommits([c({})], "o/r", "kumar-prasannajit", allowAll), [
    { repo: "o/r", sha: "abcdef1", date: "2026-10-01T10:00:00Z", message: "feat: x",
      url: "https://github.com/o/r/commit/abcdef1" },
  ]);
});
test("toCommits drops merges, other authors, non-allowed repos and junk", () => {
  assert.equal(toCommits([c({ parents: [{}, {}] })], "o/r", "Kumar-Prasannajit", allowAll).length, 0);
  assert.equal(toCommits([c({ author: { login: "someone" } })], "o/r", "Kumar-Prasannajit", allowAll).length, 0);
  assert.equal(toCommits([c({ author: null })], "o/r", "Kumar-Prasannajit", allowAll).length, 0);
  assert.equal(toCommits([c({})], "AIdeas-Tech-Solutions-Private-Limited/x", "Kumar-Prasannajit", () => false).length, 0);
  assert.equal(toCommits({ message: "Bad credentials" }, "o/r", "Kumar-Prasannajit", allowAll).length, 0);
});
test("pageWarning only at or above a full page", () => {
  assert.equal(pageWarning("o/r", 99, 100), null);
  assert.equal(pageWarning("o/r", 100, 100), "o/r: 100 commits, results may be truncated");
});
test("nextWeeklyNumber", () => {
  assert.equal(nextWeeklyNumber(["001-a.mdx", "003-c.mdx", "002-b.mdx"]), "004");
  assert.equal(nextWeeklyNumber([]), "001");
});
test("pickIdea finds the first unticked line, with or without notes", () => {
  const md = "# Blog ideas\n\n- [x] done → /blog/x\n-  [ ]  Stack story — the allowlist bit\n- [ ] Later\n";
  assert.deepEqual(pickIdea(md), { index: 3, topic: "Stack story", notes: "the allowlist bit" });
  assert.deepEqual(pickIdea("- [ ] Plain topic\n"), { index: 0, topic: "Plain topic", notes: "" });
  assert.equal(pickIdea("- [x] only done\n"), null);
});
test("pickIdea and tickIdea handle CRLF and keep it", () => {
  const md = "# Blog ideas\r\n- [ ] Topic — notes\r\n- [ ] Next\r\n";
  const pick = pickIdea(md)!;
  assert.equal(pick.topic, "Topic");
  assert.equal(
    tickIdea(md, pick.index, "topic"),
    "# Blog ideas\r\n- [x] Topic — notes → /blog/topic\r\n- [ ] Next\r\n",
  );
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `node --test lib/activity.test.ts`
Expected: FAIL, with "Cannot find module" for `./activity.ts`.

- [ ] **Step 3: Implement `lib/activity.ts` with the signatures in Interfaces**

Notes on choices the tests don't fix:
- Date arithmetic: do it on `Date.UTC(y, m - 1, d)` and format with `toISOString().slice(0, 10)`.
- `istDate`: use `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })`.
- `pickIdea` matches `/^\s*-\s*\[ \]\s*(.+?)\s*$/` on lines split by `/\r?\n/`. Topic and notes split on the first `—`, both trimmed.
- `tickIdea` splits on `/(\r?\n)/` so the separators are kept.

- [ ] **Step 4: Run it and check that it passes**

Run: `node --test lib/activity.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/activity.ts lib/activity.test.ts
git commit -m "feat(automation): pure helpers for activity windows, commits and ideas"
```

---

### Task 2: Pure content rules

**Files:**
- Create: `lib/contentCheck.ts`
- Test: `lib/contentCheck.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ContentFile = { kind: "blog" | "weekly"; path: string; filename: string; data: Record<string, unknown>; body: string }`. `data` is gray-matter's parsed frontmatter.
  - `type Problem = { path: string; message: string }`
  - `const EMPLOYER_TERMS: readonly string[] = ["aideas"]`
  - `checkContent(files: ContentFile[]): Problem[]`: runs every rule below and returns all problems in file order. The MDX compile is not part of this; it lives in Task 3.

**Rules (exact messages):**
- **Missing required field** (`undefined`, `null` or `""`): `` missing `<field>` ``. Blog requires `title`, `date`, `tags`, `excerpt`; weekly requires `title`, `date`, `summary`. A present-but-invalid `tags` (for example `[]`) is reported only by the tags rule, not as missing.
- **Bad tags:** `` `tags` must be a non-empty list of strings ``.
- **`date` or `updated` not a valid quoted date:** `` `<field>` must be a quoted YYYY-MM-DD string ``. This covers a JS `Date` from an unquoted YAML date, a wrong format, and an impossible date like `2026-02-30`.
- **`linkedin` not a string or over 3,000 characters:** `` `linkedin` must be text of at most 3000 characters ``.
- **Weekly numbering:** sort weekly files by `date` then filename. The i-th one (1-based) must have prefix `String(i).padStart(3, "0")`; otherwise `` expected number <NNN> from date order, file has <prefix or "none"> ``.
- **Duplicate slug in the same kind:** `duplicate slug "<slug>"`. The slug is the filename without `.mdx`/`.md`.
- **Employer term anywhere** in `JSON.stringify(data)` or `body`, case-insensitive: `` mentions "<term>" ``.

- [ ] **Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { checkContent, type ContentFile } from "./contentCheck.ts";

const blog = (over: Partial<ContentFile> = {}): ContentFile => ({
  kind: "blog", path: "content/blog/a.mdx", filename: "a.mdx", body: "Hello",
  data: { title: "A", date: "2026-10-16", tags: ["backend"], excerpt: "x" }, ...over,
});
const weekly = (n: string, date: string): ContentFile => ({
  kind: "weekly", path: `content/weekly/${n}-x.mdx`, filename: `${n}-x.mdx`, body: "Hi",
  data: { title: "W", date, summary: "s" },
});
const messages = (files: ContentFile[]) => checkContent(files).map((p) => p.message);

test("valid files pass", () => {
  assert.deepEqual(checkContent([blog(), weekly("001", "2026-09-01"), weekly("002", "2026-09-08")]), []);
});
test("missing fields and bad tags", () => {
  assert.deepEqual(messages([blog({ data: { title: "A", date: "2026-10-16", tags: [] } })]),
    ["missing `excerpt`", "`tags` must be a non-empty list of strings"]);
});
test("unquoted YAML date (a Date object) is rejected", () => {
  assert.deepEqual(messages([blog({ data: { ...blog().data, date: new Date("2026-10-16") } })]),
    ["`date` must be a quoted YYYY-MM-DD string"]);
});
test("impossible date is rejected", () => {
  assert.deepEqual(messages([blog({ data: { ...blog().data, date: "2026-02-30" } })]),
    ["`date` must be a quoted YYYY-MM-DD string"]);
});
test("linkedin over 3000 characters is rejected", () => {
  assert.deepEqual(messages([blog({ data: { ...blog().data, linkedin: "x".repeat(3001) } })]),
    ["`linkedin` must be text of at most 3000 characters"]);
});
test("weekly numbering gap is reported", () => {
  assert.deepEqual(messages([weekly("001", "2026-09-01"), weekly("003", "2026-09-08")]),
    ["expected number 002 from date order, file has 003"]);
});
test("duplicate slug", () => {
  assert.deepEqual(messages([blog(), blog()]), ['duplicate slug "a"']);
});
test("employer term in body or frontmatter, any case", () => {
  assert.deepEqual(messages([blog({ body: "At AIdeas we..." })]), ['mentions "aideas"']);
  assert.deepEqual(messages([blog({ data: { ...blog().data, linkedin: "aideas" } })]), ['mentions "aideas"']);
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `node --test lib/contentCheck.test.ts`
Expected: FAIL, with "Cannot find module".

- [ ] **Step 3: Implement `lib/contentCheck.ts`**

Use the rules and messages above. Per file, check in this order: required fields, `tags`, dates, `linkedin`, employer terms. Then run the cross-file checks: numbering, duplicates. For date validity, round-trip through `Date.UTC` and compare the formatted result.

- [ ] **Step 4: Run it and check that it passes**

Run: `node --test lib/contentCheck.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/contentCheck.ts lib/contentCheck.test.ts
git commit -m "feat(automation): pure content rules for blog and weekly posts"
```

---

### Task 3: `check:content` script and CI

**Files:**
- Create: `scripts/nodeVersion.mjs`, `scripts/check-content.mjs`, `scripts/check-content.test.mjs`, `.github/workflows/content-check.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: `checkContent`, `ContentFile` (Task 2).
- Produces:
  - `assertNode(): void` from `scripts/nodeVersion.mjs`. It exits 1 with `Node >= 22.18 required (found <version>)` when older.
  - The CLI `node scripts/check-content.mjs [--root <dir>]`:
    - `--root` defaults to the repo root and reads `<root>/content/blog` and `<root>/content/weekly`.
    - Prints one `<path>: <message>` line per problem.
    - On success prints `content ok: <n> files` and exits 0; otherwise exits 1.
    - MDX problems print as `<path>: MDX does not compile: <first line of the error>`.

- [ ] **Step 1: Write the failing script test**

`scripts/check-content.test.mjs`:
- Build fixture trees under `fs.mkdtempSync(os.tmpdir())` and run the script with `spawnSync(process.execPath, ["scripts/check-content.mjs", "--root", dir])`.
- Test `passes on a valid tree`: one blog and one weekly `001-…` file, both with quoted dates. Expect exit status 0 and stdout containing `content ok: 2 files`.
- Test `fails on MDX that does not compile`: a blog body of `<div>unclosed`. Expect exit status 1 and stdout matching `/a\.mdx: MDX does not compile: /`.
- Test `fails on a rule problem`: a weekly file with an unquoted `date: 2026-10-12`. Expect exit status 1 and stdout containing ``"`date` must be a quoted YYYY-MM-DD string"``.

- [ ] **Step 2: Run it and check that it fails**

Run: `node --test scripts/check-content.test.mjs`
Expected: FAIL, because the script doesn't exist.

- [ ] **Step 3: Implement**

- `scripts/nodeVersion.mjs`: `assertNode()` compares `process.versions.node` with 22.18.
- `scripts/check-content.mjs`:
  - Call `assertNode()` first.
  - Read files with `fs` and `gray-matter`, and build the `ContentFile`s.
  - Call `checkContent`.
  - Compile each body with `compile` from `@mdx-js/mdx` (default options, matching the site's `next-mdx-remote` use).
  - Print and exit as in Interfaces.
- `package.json`:
  - Add `"check:content": "node scripts/check-content.mjs"`.
  - Change `"test"` to `"node --test lib/*.test.ts scripts/*.test.mjs"`.
  - Add the devDependency with `npm install -D @mdx-js/mdx@^3.1.1`.
- `.github/workflows/content-check.yml`:
  - Trigger: `on: pull_request` with `paths: ["content/**", "lib/contentCheck.ts", "scripts/check-content.mjs"]`.
  - Job on `ubuntu-latest`: `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 24` and `cache: npm`, `npm ci`, `npm run check:content`.

- [ ] **Step 4: Run all checks**

Run `npm test`. Expected: every test passes, including the 3 script tests.

Run `npm run check:content`. Expected: `content ok: 6 files` and exit 0 on the current tree. The existing posts already quote their dates.

- [ ] **Step 5: Commit**

```bash
git add scripts/nodeVersion.mjs scripts/check-content.mjs scripts/check-content.test.mjs .github/workflows/content-check.yml package.json package-lock.json
git commit -m "feat(automation): check:content script and PR check for posts"
```

---

### Task 4: Activity collector

**Files:**
- Modify: `lib/githubTools.ts`, `lib/githubTools.test.ts`, `lib/githubActivity.ts`
- Create: `scripts/collect-activity.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes:
  - `ALLOWED_OWNERS`, `ALLOWED_REPOS`, `isAllowedRepo` (`lib/githubTools.ts`)
  - `githubHeaders(owner?)` (`lib/githubHeaders.ts`)
  - `istDate`, `istMidnightIso`, `addDays`, `toCommits`, `pageWarning`, `Commit` (Task 1)
- Produces:
  - `repoListUrl(owner: string, hasToken: boolean): string` in `lib/githubTools.ts`. For the user's account (`Kumar-Prasannajit`, case-insensitive) it returns `https://api.github.com/user/repos?affiliation=owner&sort=pushed&per_page=100` with a token, or `https://api.github.com/users/Kumar-Prasannajit/repos?sort=pushed&per_page=30` without. Any other owner gets `https://api.github.com/orgs/<owner>/repos?sort=pushed&per_page=100`.
  - The CLI `node scripts/collect-activity.mjs --since <YYYY-MM-DD> [--until <YYYY-MM-DD>]`:
    - `--until` defaults to `istDate(new Date())`.
    - Prints the spec's JSON: `{ since, until, commits: Commit[], errors: string[] }`, with commits sorted by date ascending.
    - Exits 1 if every repo or commit request failed; otherwise exits 0.

- [ ] **Step 1: Write the failing test for `repoListUrl`** in `lib/githubTools.test.ts`

```ts
test("repoListUrl: own account with/without token, orgs", () => {
  assert.equal(repoListUrl("kumar-prasannajit", true),
    "https://api.github.com/user/repos?affiliation=owner&sort=pushed&per_page=100");
  assert.equal(repoListUrl("Kumar-Prasannajit", false),
    "https://api.github.com/users/Kumar-Prasannajit/repos?sort=pushed&per_page=30");
  assert.equal(repoListUrl("salonjaa-digital-solution", true),
    "https://api.github.com/orgs/salonjaa-digital-solution/repos?sort=pushed&per_page=100");
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `node --test lib/githubTools.test.ts`
Expected: FAIL, because `repoListUrl` is not exported.

- [ ] **Step 3: Implement `repoListUrl`** in `lib/githubTools.ts`, and make `listRepos` in `lib/githubActivity.ts` call it (behaviour unchanged). Run `npm test` and expect everything to pass.

- [ ] **Step 4: Implement `scripts/collect-activity.mjs`**

1. Call `assertNode()` and parse the arguments.
2. List repos per allowed owner with `repoListUrl` and `githubHeaders(owner)`, and fetch each `ALLOWED_REPOS` entry from `/repos/<name>`.
3. Keep repos where `isAllowedRepo` is true and `pushed_at >= istMidnightIso(since)`.
4. For each repo, `GET /repos/<full_name>/commits?author=Kumar-Prasannajit&since=<istMidnightIso(since)>&until=<istMidnightIso(addDays(until, 1))>&per_page=100`. Map the result with `toCommits(json, full_name, "Kumar-Prasannajit", (n) => isAllowedRepo(n, ALLOWED_OWNERS, ALLOWED_REPOS))`.
5. Push `pageWarning(full_name, json.length, 100)` and any `"<url>: HTTP <status>"` failures into `errors`.

- [ ] **Step 5: Verify it live** (the shell needs `GITHUB_TOKEN`, and `GITHUB_TOKEN_SALONJAA` if available; locally `GITHUB_TOKEN=$(gh auth token)` works for a dry run)

Run: `node scripts/collect-activity.mjs --since 2026-09-14 | node -e "const j=JSON.parse(require('fs').readFileSync(0));console.log(j.commits.length, new Set(j.commits.map(c=>c.repo.split('/')[0])), j.errors)"`

Expected: a commit count above 0, owners only from `Kumar-Prasannajit`, `salonjaa-digital-solution`, `biraceyuva-GIET`, `navgyanpvt`, `OmkarPadhy`, and no `AIdeas…` owner.

- [ ] **Step 6: Commit**

Also add `"collect:activity": "node scripts/collect-activity.mjs"` to `package.json`.

```bash
git add lib/githubTools.ts lib/githubTools.test.ts lib/githubActivity.ts scripts/collect-activity.mjs package.json
git commit -m "feat(automation): allowlisted GitHub activity collector"
```

---

### Task 5: Routine instructions and ideas file

**Files:**
- Create: `automation/draft-posts.md`, `content/ideas.md`

**Interfaces:**
- Consumes: `npm run collect:activity`, `npm run check:content` (Tasks 3–4).
- Produces: the instructions file that both routines run. They are told: "Follow `automation/draft-posts.md` with mode: `weekly`" (or `blog`).

- [ ] **Step 1: Write `content/ideas.md`**

The file is a `# Blog ideas` heading, then an HTML comment explaining the format: `- [ ] topic — optional notes`, the first unticked line is used next, and drafted lines get ticked with a link. There are no seeded ideas.

- [ ] **Step 2: Write `automation/draft-posts.md`**

It is written as numbered steps for the agent, using the Global Constraints values and spec sections 4, 6 and 7 verbatim:

1. **Setup:**
   - `node --version` must be ≥ 22.18;
   - run `npm ci` if `node_modules` is missing;
   - work out the run date in IST.
2. **Duplicate guard:** if an open PR labelled `draft-post` has a branch starting `draft/<mode>-`, stop and log "draft already open: #<n>".
3. **Weekly mode:**
   - Read the dates of all `content/weekly` entries. If `alreadyPostedToday` holds (newest date == run date), stop and log it.
   - Run `npm run collect:activity -- --since <newest date>`. If it exits 1, stop and log `errors`. If `commits` is empty, stop and log "no activity since <date>".
   - Write `content/weekly/<nextWeeklyNumber>-<slug>.mdx`.
4. **Blog mode:**
   - Read `content/ideas.md`, then take the first unticked idea and use its notes. If there is none, run `collect:activity -- --since <run date − 14 days>` and pick the most substantial thread (a new integration, a tricky fix, a design decision with trade-offs); if nothing qualifies, stop and log it.
   - Write `content/blog/<slug>.mdx`. If an idea was used, tick it in `content/ideas.md` with `→ /blog/<slug>`.
5. **Voice:**
   - First read every file in `content/blog` and `content/weekly`.
   - The rules: first person, plain and specific; short paragraphs, `##` headings, bullets; no hype words, no emoji, no closing call-to-action. Lengths as in Global Constraints.
   - A weekly entry groups by project, not by commit.
6. **Truthfulness:**
   - Every claim must trace to the activity JSON, the repo files, or the idea's notes.
   - Put a `<!-- CHECK: … -->` comment at anything uncertain.
   - Never mention AIdeas or employer work.
7. **Frontmatter:**
   - Exactly the fields in Global Constraints. Dates are quoted `"YYYY-MM-DD"`.
   - The `linkedin` caption is a YAML `|` block: a 600–1,300 character hook-first post, plain text, at most 3 hashtags, no link.
8. **Check:** run `npm run check:content`. On failure, fix and rerun once. If it still fails, stop without a PR and log the output.
9. **PR:**
   - Branch, title and label as in Global Constraints.
   - The body has these sections in order: summary; **Sources** (commit links grouped by repo); **Please check** (each CHECK comment quoted, plus every collector `errors` line, or "nothing flagged"); **LinkedIn caption**; "Approve by reviewing the Vercel preview and merging."
   - Never merge.

- [ ] **Step 3: Verify**

Run `npm run check:content`. Expected: still `content ok: 6 files`. `ideas.md` sits outside the checked folders, and `lib/content.ts` doesn't read it.

- [ ] **Step 4: Commit**

```bash
git add automation/draft-posts.md content/ideas.md
git commit -m "feat(automation): routine instructions and blog idea backlog"
```

---

### Task 6: Ship, set up routines, acceptance run

This needs the user for the tokens and the routine setup. It runs after Tasks 1–5 are reviewed.

- [ ] **Step 1: Merge the code to `main`**

Push `feat/post-automation`, then open a PR. Merge it once `npm test`, `npx tsc --noEmit`, `npx eslint app components lib scripts` and the Vercel preview are green. The routines clone `main`, so the scripts must be there first.

- [ ] **Step 2: Create the label**

Run: `gh label create draft-post --color FF5757 --description "AI-drafted post awaiting approval"`

- [ ] **Step 3: The user creates the two read-only tokens**

These are the ones from `.env.example`, if not done yet. The user adds them to the routine's cloud environment as `GITHUB_TOKEN` and `GITHUB_TOKEN_SALONJAA`, with network level **Trusted**.

- [ ] **Step 4: Create the routines** with the `schedule` skill, on the repo `Kumar-Prasannajit/portfolio`:
  - `portfolio-weekly-draft`: cron `30 12 * * 0`, prompt "Follow automation/draft-posts.md with mode: weekly".
  - `portfolio-blog-draft`: cron `30 12 * * 5`, prompt "Follow automation/draft-posts.md with mode: blog".

- [ ] **Step 5: Acceptance run**

Use "Run now" on `portfolio-weekly-draft`.

Expected: a PR titled `Draft: Weekly #004 — …`, labelled `draft-post`, with a green `content-check` job and Vercel preview. Its sources must be real commits dated 2026-09-14 or later, and "aideas" must appear nowhere in the diff.

- [ ] **Step 6: Record it**

Add a "Post automation (part a)" entry to `docs/PROGRESS.md` covering the routine names, schedules, and the #004 PR link, then commit.
