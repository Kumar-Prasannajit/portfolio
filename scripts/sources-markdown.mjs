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

// Exit through process.exitCode, never process.exit(): on Windows, exiting
// right after the .ts import in main() crashed Node (0xC0000409) about one run
// in four. Letting the process end on its own lets the TypeScript loader finish.
async function main() {
  const args = process.argv.slice(2);
  const pairs = args.map((arg) => {
    const at = arg.indexOf("=");
    return at > 0 ? [arg.slice(0, at), arg.slice(at + 1)] : null;
  });
  if (pairs.length === 0 || pairs.some((p) => !p || !p[1])) {
    console.error('usage: sources-markdown.mjs "<label>=<collector json file>" ...');
    return 2;
  }

  const { sourcesMarkdown } = await import("../lib/activity.ts");
  const sections = [];
  for (const [label, file] of pairs) {
    let out;
    try {
      out = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
      console.error(`${file}: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
    if (!out || !Array.isArray(out.commits)) {
      console.error(`${file}: not collector output (no "commits" array)`);
      return 1;
    }
    sections.push(sourcesMarkdown(`${label} · ${out.since} → ${out.until}`, out.commits));
  }
  process.stdout.write(sections.join("\n"));
  return 0;
}

process.exitCode = await main();
