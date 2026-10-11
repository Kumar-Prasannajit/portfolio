import test from "node:test";
import assert from "node:assert/strict";
import {
  istDate, istMidnightIso, addDays, weeklySince, blogSince, alreadyPostedToday,
  toCommits, pageWarning, nextWeeklyNumber, pickIdea, tickIdea, weeklyChunks, coverLabel,
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
test("weeklyChunks splits a catch-up into Monday-Sunday weeks", () => {
  assert.deepEqual(weeklyChunks("2026-09-14", "2026-10-11"), [
    { start: "2026-09-14", end: "2026-09-20" },
    { start: "2026-09-21", end: "2026-09-27" },
    { start: "2026-09-28", end: "2026-10-04" },
    { start: "2026-10-05", end: "2026-10-11" },
  ]);
});
test("weeklyChunks folds the previous entry's Sunday into the next week", () => {
  assert.deepEqual(weeklyChunks("2026-10-11", "2026-10-18"), [{ start: "2026-10-11", end: "2026-10-18" }]);
  // A manual run mid-week ends the last chunk on the run date.
  assert.deepEqual(weeklyChunks("2026-10-11", "2026-10-14"), [{ start: "2026-10-11", end: "2026-10-14" }]);
  assert.deepEqual(weeklyChunks("2026-10-11", "2026-10-11"), [{ start: "2026-10-11", end: "2026-10-11" }]);
});
test("weeklyChunks starts mid-week after an older entry, and crosses the year", () => {
  assert.deepEqual(weeklyChunks("2026-09-16", "2026-09-27"), [
    { start: "2026-09-16", end: "2026-09-20" },
    { start: "2026-09-21", end: "2026-09-27" },
  ]);
  assert.deepEqual(weeklyChunks("2026-12-28", "2027-01-10"), [
    { start: "2026-12-28", end: "2027-01-03" },
    { start: "2027-01-04", end: "2027-01-10" },
  ]);
});
test("coverLabel matches the existing two-digit covers", () => {
  assert.equal(coverLabel("004"), "04");
  assert.equal(coverLabel("010"), "10");
  assert.equal(coverLabel("100"), "100");
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

test("pickIdea ignores blank topics and lines inside an HTML comment", () => {
  assert.deepEqual(pickIdea("- [ ]   \n- [ ] Real\n"), { index: 1, topic: "Real", notes: "" });
  const md = "# Blog ideas\n<!--\n- [ ] example — format\n-->\n- [ ] Real one\n";
  assert.deepEqual(pickIdea(md), { index: 4, topic: "Real one", notes: "" });
});
