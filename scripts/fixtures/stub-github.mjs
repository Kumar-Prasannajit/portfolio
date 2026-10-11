// Test double for api.github.com, loaded with `node --import` by
// collect-activity.test.mjs. Logs every requested URL to $STUB_LOG. The repo
// lists deliberately include an employer repo, so the test can prove the
// collector never asks for its commits.
import fs from "node:fs";

const commit = (sha, login, message, parents = 1) => ({
  sha: sha.padEnd(40, "0"),
  html_url: `https://github.com/x/y/commit/${sha}`,
  parents: Array.from({ length: parents }, () => ({})),
  author: { login },
  commit: { message, author: { date: "2026-10-01T10:00:00Z" } },
});

const ME = "Kumar-Prasannajit";
const routes = [
  [/\/user\/repos\?/, [
    { full_name: `${ME}/portfolio`, pushed_at: "2026-10-10T00:00:00Z" },
    { full_name: "AIdeas-Tech-Solutions-Private-Limited/secret", pushed_at: "2026-10-10T00:00:00Z" },
    { full_name: `${ME}/stale`, pushed_at: "2026-01-01T00:00:00Z" },
  ]],
  [/\/orgs\/salonjaa-digital-solution\/repos\?/, [
    { full_name: "salonjaa-digital-solution/site", pushed_at: "2026-10-09T00:00:00Z" },
  ]],
  [/\/repos\/(biraceyuva-GIET|navgyanpvt|OmkarPadhy)\/[^/?]+$/, {
    full_name: "OmkarPadhy/E-Fiesta-2k25", pushed_at: "2026-01-01T00:00:00Z",
  }],
  [/\/repos\/Kumar-Prasannajit\/portfolio\/commits\?/, [
    commit("aaaaaaa1", ME, "feat: one"),
    commit("aaaaaaa2", ME, "Merge pull request #1", 2),
  ]],
  [/\/repos\/salonjaa-digital-solution\/site\/commits\?/, [
    commit("bbbbbbb1", "someone-else", "not mine"),
    commit("bbbbbbb2", ME, "fix: two"),
  ]],
];

globalThis.fetch = async (input) => {
  const url = String(input);
  fs.appendFileSync(process.env.STUB_LOG, `${url}\n`);
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
  if (process.env.STUB_MODE === "down") return reply({ message: "Bad credentials" }, 401);
  const route = routes.find(([pattern]) => pattern.test(url));
  return route ? reply(route[1]) : reply({ message: "Not Found" }, 404);
};
