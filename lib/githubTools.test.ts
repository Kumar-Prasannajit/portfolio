import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_OWNERS,
  ALLOWED_REPOS,
  isAllowedRepo,
  latestByTool,
  newestCommit,
  pickRecentRepos,
  repoListUrl,
  toolsFromLanguages,
  toolsFromPackageJson,
  type RepoSummary,
} from "./githubTools.ts";

const sorted = (xs: Iterable<string>) => [...xs].sort();

test("package.json deps map to the tag names used in lib/data.ts", () => {
  const tools = toolsFromPackageJson({
    dependencies: { next: "16", react: "19", lenis: "1", swiper: "11" },
    devDependencies: { tailwindcss: "4", typescript: "5" },
  });
  assert.deepEqual(
    sorted(tools),
    ["Lenis", "Next.js", "React", "Swiper.js", "Tailwind CSS", "TypeScript"],
  );
});

test("alias dependencies resolve to one tool", () => {
  assert.deepEqual(
    sorted(toolsFromPackageJson({ dependencies: { mongoose: "8" } })),
    ["MongoDB"],
  );
  assert.deepEqual(
    sorted(toolsFromPackageJson({ dependencies: { mongodb: "6" } })),
    ["MongoDB"],
  );
  assert.deepEqual(
    sorted(
      toolsFromPackageJson({ dependencies: { "@studio-freight/lenis": "1" } }),
    ),
    ["Lenis"],
  );
});

test("particles.js and tsparticles packages map to Particle.js", () => {
  for (const dep of ["particles.js", "tsparticles", "@tsparticles/engine"]) {
    assert.deepEqual(
      sorted(toolsFromPackageJson({ dependencies: { [dep]: "1" } })),
      ["Particle.js"],
      dep,
    );
  }
});

test("a server framework dependency implies Node.js", () => {
  assert.deepEqual(
    sorted(
      toolsFromPackageJson({ dependencies: { express: "5", jsonwebtoken: "9" } }),
    ),
    ["Express", "JWT", "Node.js"],
  );
  assert.ok(
    toolsFromPackageJson({ dependencies: { fastify: "5" } }).has("Node.js"),
  );
});

test("a node/nodemon start script implies Node.js", () => {
  assert.ok(
    toolsFromPackageJson({ scripts: { start: "node server.js" } }).has(
      "Node.js",
    ),
  );
  assert.ok(
    toolsFromPackageJson({ scripts: { dev: "nodemon src/index.js" } }).has(
      "Node.js",
    ),
  );
});

test("a Next.js app alone does not imply Node.js", () => {
  const tools = toolsFromPackageJson({
    dependencies: { next: "16", react: "19" },
    scripts: { dev: "next dev", start: "next start" },
  });
  assert.ok(!tools.has("Node.js"));
});

test("unknown dependencies and a malformed package.json yield nothing", () => {
  assert.equal(
    toolsFromPackageJson({ dependencies: { lodash: "4" } }).size,
    0,
  );
  assert.equal(toolsFromPackageJson(null).size, 0);
  assert.equal(toolsFromPackageJson("nope").size, 0);
  assert.equal(
    toolsFromPackageJson({ dependencies: "x", scripts: 3 }).size,
    0,
  );
});

test("languages map to tool names", () => {
  assert.deepEqual(
    sorted(
      toolsFromLanguages({
        TypeScript: 8000,
        JavaScript: 1500,
        HTML: 800,
        CSS: 2000,
        Shell: 10,
      }),
    ),
    ["CSS", "HTML", "JavaScript", "TypeScript"],
  );
});

test("a sliver of a language (config files) does not count as using it", () => {
  // A Next + TypeScript repo still carries eslint.config.mjs / postcss.config.mjs.
  const tools = toolsFromLanguages({ TypeScript: 95000, JavaScript: 600 });
  assert.deepEqual(sorted(tools), ["TypeScript"]);
});

test("malformed language data yields nothing", () => {
  assert.equal(toolsFromLanguages(null).size, 0);
  assert.equal(toolsFromLanguages({}).size, 0);
  assert.equal(toolsFromLanguages({ TypeScript: "lots" }).size, 0);
});

const repo = (over: Partial<RepoSummary> & { full_name: string }): RepoSummary => ({
  fork: false,
  archived: false,
  private: false,
  default_branch: "main",
  pushed_at: "2026-09-01T00:00:00Z",
  ...over,
});

test("pickRecentRepos skips forks, archived repos and the profile repo", () => {
  const picked = pickRecentRepos(
    [
      repo({ full_name: "Kumar-Prasannajit/keep" }),
      repo({ full_name: "Kumar-Prasannajit/forked", fork: true }),
      repo({ full_name: "Kumar-Prasannajit/old", archived: true }),
      repo({ full_name: "Kumar-Prasannajit/Kumar-Prasannajit" }),
      repo({ full_name: "kumar-prasannajit/kumar-prasannajit" }),
    ],
    15,
  );
  assert.deepEqual(
    picked.map((r) => r.full_name),
    ["Kumar-Prasannajit/keep"],
  );
});

test("isAllowedRepo: own account and Salonjaa yes, employer and others no", () => {
  assert.equal(isAllowedRepo("Kumar-Prasannajit/portfolio", ALLOWED_OWNERS), true);
  assert.equal(isAllowedRepo("salonjaa-digital-solution/crm", ALLOWED_OWNERS), true);
  assert.equal(isAllowedRepo("SALONJAA-DIGITAL-SOLUTION/crm", ALLOWED_OWNERS), true);
  assert.equal(
    isAllowedRepo("AIdeas-Tech-Solutions-Private-Limited/app", ALLOWED_OWNERS),
    false,
  );
  assert.equal(isAllowedRepo("biraceyuva-GIET/e-yuva", ALLOWED_OWNERS), false);
  assert.equal(isAllowedRepo("no-slash", ALLOWED_OWNERS), false);
});

test("isAllowedRepo: a named repo on someone else's account, but not their other repos", () => {
  const allowed = (name: string) => isAllowedRepo(name, ALLOWED_OWNERS, ALLOWED_REPOS);
  assert.equal(allowed("biraceyuva-GIET/giet-eyuva-center"), true);
  assert.equal(allowed("navgyanpvt/shrimp-disease-detection"), true);
  assert.equal(allowed("OmkarPadhy/E-Fiesta-2k25"), true);
  assert.equal(allowed("OmkarPadhy/some-other-repo"), false);
  assert.equal(allowed("AIdeas-Tech-Solutions-Private-Limited/app"), false);
});

test("pickRecentRepos keeps named repos alongside allowed owners", () => {
  const picked = pickRecentRepos(
    [
      repo({ full_name: "me/mine" }),
      repo({ full_name: "friend/built-together" }),
      repo({ full_name: "friend/not-mine" }),
    ],
    15,
    ["me"],
    ["friend/built-together"],
  );
  assert.deepEqual(
    picked.map((r) => r.full_name),
    ["me/mine", "friend/built-together"],
  );
});

test("pickRecentRepos keeps only allowed owners, ignoring case", () => {
  const picked = pickRecentRepos(
    [
      repo({ full_name: "Kumar-Prasannajit/mine" }),
      repo({ full_name: "Salonjaa-Digital-Solution/crm" }),
      repo({ full_name: "AIdeas-Tech-Solutions-Private-Limited/work" }),
      repo({ full_name: "someone-else/shared" }),
    ],
    15,
    ["kumar-prasannajit", "salonjaa-digital-solution"],
  );
  assert.deepEqual(
    picked.map((r) => r.full_name),
    ["Kumar-Prasannajit/mine", "Salonjaa-Digital-Solution/crm"],
  );
});

test("pickRecentRepos fills the limit from allowed owners only", () => {
  const picked = pickRecentRepos(
    [
      repo({ full_name: "blocked/a", pushed_at: "2026-09-30T00:00:00Z" }),
      repo({ full_name: "blocked/b", pushed_at: "2026-09-29T00:00:00Z" }),
      repo({ full_name: "me/x", pushed_at: "2026-01-01T00:00:00Z" }),
    ],
    1,
    ["me"],
  );
  assert.deepEqual(
    picked.map((r) => r.full_name),
    ["me/x"],
  );
});

test("pickRecentRepos returns the newest pushes first, capped at the limit", () => {
  const picked = pickRecentRepos(
    [
      repo({ full_name: "o/old", pushed_at: "2026-01-01T00:00:00Z" }),
      repo({ full_name: "o/new", pushed_at: "2026-09-29T00:00:00Z" }),
      repo({ full_name: "o/mid", pushed_at: "2026-05-01T00:00:00Z" }),
    ],
    2,
  );
  assert.deepEqual(
    picked.map((r) => r.full_name),
    ["o/new", "o/mid"],
  );
});

test("pickRecentRepos tolerates a non-array response", () => {
  assert.deepEqual(pickRecentRepos(null, 15), []);
  assert.deepEqual(pickRecentRepos({ message: "rate limited" }, 15), []);
});

test("latestByTool keeps the newest repo push per tool", () => {
  const map = latestByTool([
    { pushedAt: "2026-09-01T00:00:00Z", tools: new Set(["React", "Express"]) },
    { pushedAt: "2026-09-29T00:00:00Z", tools: new Set(["React"]) },
    { pushedAt: "2026-07-01T00:00:00Z", tools: new Set(["React", "HTML"]) },
  ]);
  assert.deepEqual(map, {
    React: "2026-09-29T00:00:00Z",
    Express: "2026-09-01T00:00:00Z",
    HTML: "2026-07-01T00:00:00Z",
  });
});

test("repoListUrl: own account with/without token, orgs", () => {
  assert.equal(repoListUrl("kumar-prasannajit", true),
    "https://api.github.com/user/repos?affiliation=owner&sort=pushed&per_page=100");
  assert.equal(repoListUrl("Kumar-Prasannajit", false),
    "https://api.github.com/users/Kumar-Prasannajit/repos?sort=pushed&per_page=30");
  assert.equal(repoListUrl("salonjaa-digital-solution", true),
    "https://api.github.com/orgs/salonjaa-digital-solution/repos?sort=pushed&per_page=100");
});

test("newestCommit picks the newest first commit across repos and skips error bodies", () => {
  const at = (date: string) => [{ commit: { committer: { date }, author: { date: "2000-01-01T00:00:00Z" } } }];
  assert.deepEqual(
    newestCommit([
      { repo: "me/a", commits: at("2026-10-11T10:00:00Z") },
      { repo: "org/b", commits: at("2026-10-11T12:00:00Z") },
      { repo: "me/c", commits: { message: "API rate limit exceeded" } },
      { repo: "me/d", commits: [] },
    ]),
    { repo: "org/b", committedAt: "2026-10-11T12:00:00Z" },
  );
  assert.deepEqual(
    newestCommit([{ repo: "me/a", commits: [{ commit: { author: { date: "2026-10-01T00:00:00Z" } } }] }]),
    { repo: "me/a", committedAt: "2026-10-01T00:00:00Z" },
  );
  assert.equal(newestCommit([{ repo: "me/a", commits: null }]), null);
});
