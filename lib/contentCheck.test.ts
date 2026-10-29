import test from "node:test";
import assert from "node:assert/strict";
import { checkContent, mentionsEmployer, type ContentFile } from "./contentCheck.ts";

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

test("employer term variants and zero-width tricks are caught", () => {
  assert.deepEqual(messages([blog({ body: "at AI-Ideas Tech" })]), ['mentions "ai-ideas"']);
  assert.deepEqual(messages([blog({ body: "at A​Ideas" })]), ['mentions "aideas"']);
  assert.deepEqual(messages([blog({ body: "Some AI ideas for the data pipeline" })]), []);
});
test("braces outside code are rejected (the site strips them), comments and code are fine", () => {
  assert.deepEqual(messages([blog({ body: "Route is /blog/{slug}" })]),
    ["body has `{…}` outside code; the site strips it, so put it in backticks"]);
  assert.deepEqual(messages([blog({ body: "ok {/* CHECK: x */} and `{a}`\n\n```js\nconst x = {};\n```" })]), []);
});
test("mentionsEmployer", () => {
  assert.equal(mentionsEmployer("notes about AIdeas"), "aideas");
  assert.equal(mentionsEmployer("fine"), null);
});

const withCover = (coverImage: unknown) => blog({ data: { ...blog().data, coverImage } });
const SHAPE = "`coverImage` must be /covers/<name>.jpg, .jpeg or .png";
test("coverImage pointing at an existing cover passes", () => {
  assert.deepEqual(checkContent([withCover("/covers/blog-a.jpg")], new Set(["/covers/blog-a.jpg"])), []);
});
test("coverImage must be a /covers/ jpg, jpeg or png", () => {
  assert.deepEqual(messages([withCover("/images/a.jpg")]), [SHAPE]);
  assert.deepEqual(messages([withCover("/covers/a.gif")]), [SHAPE]);
  assert.deepEqual(messages([withCover(3)]), [SHAPE]);
});
test("coverImage naming a missing file fails when public paths are given", () => {
  assert.deepEqual(checkContent([withCover("/covers/blog-a.jpg")], new Set()).map((p) => p.message),
    ["`coverImage` file public/covers/blog-a.jpg does not exist"]);
});
