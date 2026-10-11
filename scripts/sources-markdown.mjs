// Prints a draft PR's Sources section from saved collector output, so every
// commit is listed as a link instead of being summarised by the model.
//
//   node scripts/sources-markdown.mjs "#004=/tmp/week-004.json" "#005=/tmp/week-005.json"
//
// Each argument is "<label>=<file>", where <file> holds the JSON printed by
// scripts/collect-activity.mjs for that post's week. Sections come out in
// argument order, headed "<label> · <since> → <until>". Exit 2 on a bad
// argument, 1 on a file that can't be read as collector output.

import fs from "node:fs";
import { assertNode } from "./nodeVersion.mjs";

assertNode();

const { sourcesMarkdown } = await import("../lib/activity.ts");

const args = process.argv.slice(2);
const pairs = args.map((arg) => {
  const at = arg.indexOf("=");
  return at > 0 ? [arg.slice(0, at), arg.slice(at + 1)] : null;
});
if (pairs.length === 0 || pairs.some((p) => !p || !p[1])) {
  console.error('usage: sources-markdown.mjs "<label>=<collector json file>" ...');
  process.exit(2);
}

const sections = [];
for (const [label, file] of pairs) {
  let out;
  try {
    out = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`${file}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  if (!out || !Array.isArray(out.commits)) {
    console.error(`${file}: not collector output (no "commits" array)`);
    process.exit(1);
  }
  sections.push(sourcesMarkdown(`${label} · ${out.since} → ${out.until}`, out.commits));
}
process.stdout.write(sections.join("\n"));
