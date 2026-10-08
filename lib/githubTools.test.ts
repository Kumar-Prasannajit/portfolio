import test from "node:test";
import assert from "node:assert/strict";
import {
  latestByTool,
  pickRecentRepos,
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
