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
      env: { ...process.env, GITHUB_TOKEN: "test", GITHUB_TOKEN_SALONJAA: "test", STUB_LOG: log, ...env },
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
  assert.deepEqual(out.errors, ["dropped 1 commit(s) that mention an employer term"]);
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
  // Forks, archived repos and the profile repo are skipped too.
  assert.ok(requested.every((u) => !/aideas-fork|old-thing|Kumar-Prasannajit\/Kumar-Prasannajit/.test(u)));
  // Repos last pushed before the window are not asked for commits either.
  assert.ok(requested.every((u) => !u.includes("/stale/commits")));
});

test("reads public repos only: never a private repo, nor one without the flag", () => {
  const { res, requested } = run(["--since", "2026-09-14"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!res.stdout.includes("private work"));
  assert.ok(requested.every((u) => !/side-project|no-flag|\/crm\//.test(u)), requested.join("\n"));
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
  assert.equal(run(["--since", "2026-02-30"]).res.status, 2);
  assert.equal(run(["--since", "2026-10-11", "--until", "2026-10-01"]).res.status, 2);
});

test("asks for the user's commits in the exact IST window", () => {
  const { requested } = run(["--since", "2026-09-14", "--until", "2026-10-11"]);
  const url = new URL(requested.find((u) => u.includes("/portfolio/commits?")));
  assert.equal(url.searchParams.get("author"), "Kumar-Prasannajit");
  assert.equal(url.searchParams.get("since"), "2026-09-13T18:30:00.000Z");
  assert.equal(url.searchParams.get("until"), "2026-10-11T18:30:00.000Z");
});

test("warns when a repo returns a full page of commits", () => {
  const { res } = run(["--since", "2026-09-14"], { STUB_MODE: "full" });
  assert.ok(JSON.parse(res.stdout).errors.includes("Kumar-Prasannajit/portfolio: 100 commits, results may be truncated"));
});

test("says so when GITHUB_TOKEN is missing (rate limit, shorter repo list)", () => {
  const { res } = run(["--since", "2026-09-14"], { GITHUB_TOKEN: "", GITHUB_TOKEN_SALONJAA: "" });
  const errors = JSON.parse(res.stdout).errors;
  assert.ok(errors.some((e) => e.startsWith("GITHUB_TOKEN not set")), errors.join("\n"));
});

test("names the cloud proxy's placeholder token instead of only logging 401s", () => {
  const { res } = run(["--since", "2026-09-14"], { GITHUB_TOKEN: "proxy-injected" });
  const errors = JSON.parse(res.stdout).errors;
  assert.ok(errors.some((e) => e.startsWith("GITHUB_TOKEN is the cloud placeholder")), errors.join("\n"));
});

test("GITHUB_TOKEN alone is enough: public repos only, so no Salonjaa token note", () => {
  const { res } = run(["--since", "2026-09-14"], { GITHUB_TOKEN_SALONJAA: "" });
  const errors = JSON.parse(res.stdout).errors;
  assert.ok(errors.every((e) => !e.includes("GITHUB_TOKEN")), errors.join("\n"));
});
