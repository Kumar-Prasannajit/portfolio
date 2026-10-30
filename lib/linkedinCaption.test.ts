import test from "node:test";
import assert from "node:assert/strict";
import { escapeCommentary, linkedinText } from "./linkedinCaption.ts";

test("escapeCommentary escapes every reserved character", () => {
  assert.equal(
    escapeCommentary("a|b {c} @d [e] (f) <g> h\\i *j* k_l ~m"),
    "a\\|b \\{c\\} \\@d \\[e\\] \\(f\\) \\<g\\> h\\\\i \\*j\\* k\\_l \\~m",
  );
});

test("escapeCommentary keeps #hashtag live and escapes a # that starts none", () => {
  assert.equal(escapeCommentary("Shipped #buildinpublic today"), "Shipped #buildinpublic today");
  assert.equal(escapeCommentary("C# and issue#12 and # 1"), "C\\# and issue\\#12 and \\# 1");
  assert.equal(escapeCommentary("(#tag)"), "\\(#tag\\)");
});

test("linkedinText is caption, blank line, url, all escaped", () => {
  assert.equal(
    linkedinText("Hi (v2) #dev", "https://www.kumarp.in/weekly/009-a_b"),
    "Hi \\(v2\\) #dev\n\nhttps://www.kumarp.in/weekly/009-a\\_b",
  );
});

test("linkedinText refuses an empty caption and over 3000 characters, exactly 3000 passes", () => {
  assert.throws(() => linkedinText("  \n", "https://x.in/a"), /^Error: no LinkedIn caption/);
  const url = "https://x.in/a";
  assert.throws(() => linkedinText("a".repeat(3000 - url.length - 1), url), /caption is 3001 characters/);
  assert.equal(linkedinText("a".repeat(3000 - url.length - 2), url).endsWith(url), true);
});
