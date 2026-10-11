import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./sources-markdown.mjs", import.meta.url));

/** Writes each { label: collectorOutput } to a temp file and runs the script on "label=file" pairs. */
function run(posts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sources-markdown-"));
  try {
    const args = Object.entries(posts).map(([label, json], i) => {
      const file = path.join(dir, `${i}.json`);
      fs.writeFileSync(file, typeof json === "string" ? json : JSON.stringify(json));
      return `${label}=${file}`;
    });
    return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const out = (since, until, commits) => ({ since, until, commits, errors: [] });
const commit = (repo, sha) => ({ repo, sha, date: "2026-09-15T10:00:00Z", message: "feat: x", url: `https://github.com/${repo}/commit/${sha}` });

test("prints one section per post, headed by label and window, in argument order", () => {
  const res = run({
    "#004": out("2026-09-14", "2026-09-20", [commit("me/app", "aaaaaaa")]),
    "#005": out("2026-09-21", "2026-09-27", [commit("me/app", "bbbbbbb")]),
  });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /^### #004 · 2026-09-14 → 2026-09-20\n[\s\S]*aaaaaaa[\s\S]*### #005 · 2026-09-21 → 2026-09-27\n[\s\S]*bbbbbbb/);
});

test("fails loudly on a bad argument or unreadable JSON", () => {
  assert.equal(run({ "": out("a", "b", []) }).status, 2);
  assert.equal(run({ "#004": "not json" }).status, 1);
  assert.equal(spawnSync(process.execPath, [script], { encoding: "utf8" }).status, 2);
});
