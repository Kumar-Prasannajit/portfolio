// Test double for api.github.com, loaded with `node --import` by
// collect-activity.test.mjs. Logs every requested URL to $STUB_LOG. The repo
// lists deliberately include an employer repo and private repos, so the tests
// can prove the collector never asks for their commits.
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
    { full_name: `${ME}/portfolio`, private: false, pushed_at: "2026-10-10T00:00:00Z" },
    { full_name: "AIdeas-Tech-Solutions-Private-Limited/secret", private: true, pushed_at: "2026-10-10T00:00:00Z" },
    { full_name: `${ME}/stale`, private: false, pushed_at: "2026-01-01T00:00:00Z" },
    { full_name: `${ME}/aideas-fork`, private: false, fork: true, pushed_at: "2026-10-10T00:00:00Z" },
    { full_name: `${ME}/old-thing`, private: false, archived: true, pushed_at: "2026-10-10T00:00:00Z" },
    { full_name: `${ME}/${ME}`, private: false, pushed_at: "2026-10-10T00:00:00Z" },
    { full_name: `${ME}/side-project`, private: true, pushed_at: "2026-10-10T00:00:00Z" },
    { full_name: `${ME}/no-flag`, pushed_at: "2026-10-10T00:00:00Z" },
  ]],
  [/\/orgs\/salonjaa-digital-solution\/repos\?/, [
    { full_name: "salonjaa-digital-solution/site", private: false, pushed_at: "2026-10-09T00:00:00Z" },
    { full_name: "salonjaa-digital-solution/crm", private: true, pushed_at: "2026-10-09T00:00:00Z" },
  ]],
  [/\/repos\/(biraceyuva-GIET|navgyanpvt|OmkarPadhy)\/[^/?]+$/, {
    full_name: "OmkarPadhy/E-Fiesta-2k25", private: false, pushed_at: "2026-01-01T00:00:00Z",
  }],
  [/\/repos\/Kumar-Prasannajit\/portfolio\/commits\?/, [
    commit("aaaaaaa1", ME, "feat: one"),
    commit("aaaaaaa2", ME, "Merge pull request #1", 2),
    commit("aaaaaaa3", ME, "chore: notes from AIdeas work"),
  ]],
  // Private and flag-less repos: the collector must never ask for these.
  [/\/repos\/[^/]+\/(side-project|no-flag|crm)\/commits\?/, [
    commit("ddddddd1", ME, "feat: private work"),
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
  if (process.env.STUB_MODE === "full" && /portfolio\/commits\?/.test(url)) {
    return reply(Array.from({ length: 100 }, (_, i) => commit(`ccc${String(i).padStart(4, "0")}`, ME, `feat: ${i}`)));
  }
  const route = routes.find(([pattern]) => pattern.test(url));
  return route ? reply(route[1]) : reply({ message: "Not Found" }, 404);
};
