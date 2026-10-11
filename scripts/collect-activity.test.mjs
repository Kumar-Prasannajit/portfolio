import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const script = fileURLToPath(new URL("./collect-activity.mjs", import.meta.url));
const stub = pathToFileURL(fileURLToPath(new URL("./fixtures/stub-github.mjs", import.meta.url))).href;

/** Runs the collector against the stubbed GitHub API; returns the result plus every URL it requested. */
function run(args, env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "collect-activity-"));
  const log = path.join(dir, "requests.log");
  fs.writeFileSync(log, "");
  try {
    const res = spawnSync(process.execPath, ["--import", stub, script, ...args], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_TOKEN: "test", STUB_LOG: log, ...env },
    });
    return { res, requested: fs.readFileSync(log, "utf8").split("\n").filter(Boolean) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("collects only the user's own non-merge commits from allowed repos", () => {
  const { res } = run(["--since", "2026-09-14", "--until", "2026-10-11"]);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.since, "2026-09-14");
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.commits.map((c) => [c.repo, c.message]), [
    ["Kumar-Prasannajit/portfolio", "feat: one"],
    ["salonjaa-digital-solution/site", "fix: two"],
  ]);
});

test("never requests anything about a repo outside the allowlist", () => {
  const { res, requested } = run(["--since", "2026-09-14"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!res.stdout.toLowerCase().includes("aideas"));
  assert.ok(requested.length > 0);
  assert.ok(requested.every((u) => !u.toLowerCase().includes("aideas")), requested.join("\n"));
  // Repos last pushed before the window are not asked for commits either.
  assert.ok(requested.every((u) => !u.includes("/stale/commits")));
});

test("exits 1 but still prints the errors when every request fails", () => {
  const { res } = run(["--since", "2026-09-14"], { STUB_MODE: "down" });
  assert.equal(res.status, 1);
  const out = JSON.parse(res.stdout);
  assert.deepEqual(out.commits, []);
  assert.ok(out.errors.length > 0 && out.errors.every((e) => e.includes("HTTP 401")));
});

test("rejects a missing or malformed --since", () => {
  assert.equal(run([]).res.status, 2);
  assert.equal(run(["--since", "14/09/2026"]).res.status, 2);
});
