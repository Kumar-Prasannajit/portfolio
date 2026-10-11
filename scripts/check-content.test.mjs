import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./check-content.mjs", import.meta.url));

/** Builds a content/ tree from { "blog/a.mdx": "file text" } and runs the checker on it. */
function run(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-content-"));
  try {
    for (const [rel, text] of Object.entries(files)) {
      const file = path.join(root, "content", rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    }
    return spawnSync(process.execPath, [script, "--root", root], { encoding: "utf8" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const blogFile = (body) =>
  `---\ntitle: "A"\ndate: "2026-10-16"\ntags: ["backend"]\nexcerpt: "x"\n---\n\n${body}\n`;
const weeklyFile = (date) =>
  `---\ntitle: "W"\ndate: ${date}\nsummary: "s"\n---\n\nHi\n`;

test("passes on a valid tree", () => {
  const res = run({
    "blog/a.mdx": blogFile("Hello"),
    "weekly/001-x.mdx": weeklyFile('"2026-09-01"'),
  });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /content ok: 2 files/);
});

test("fails on MDX that does not compile", () => {
  const res = run({ "blog/a.mdx": blogFile("<div>unclosed") });
  assert.equal(res.status, 1);
  assert.match(res.stdout, /a\.mdx: MDX does not compile: /);
});

test("fails on a rule problem", () => {
  const res = run({ "weekly/001-x.mdx": weeklyFile("2026-10-12") });
  assert.equal(res.status, 1);
  assert.ok(res.stdout.includes("`date` must be a quoted YYYY-MM-DD string"), res.stdout);
});

test("reports malformed frontmatter by file instead of crashing", () => {
  const res = run({ "blog/a.mdx": '---\ntitle: "A: b\n---\n\nBody\n', "blog/b.mdx": blogFile("Fine") });
  assert.equal(res.status, 1);
  assert.match(res.stdout, /a\.mdx: frontmatter does not parse: /);
  assert.ok(!res.stderr.includes("YAMLException"), res.stderr);
});

test("fails when there is no content directory", () => {
  const res = run({});
  assert.equal(res.status, 1);
  assert.match(res.stdout, /no content\/blog or content\/weekly/);
});

test("scans content/ideas.md for employer terms", () => {
  const res = run({
    "blog/a.mdx": blogFile("Hello"),
    "ideas.md": "# Blog ideas\n\n- [ ] A story from AIdeas\n",
  });
  assert.equal(res.status, 1);
  assert.match(res.stdout, /content\/ideas\.md: mentions "aideas"/);
});
