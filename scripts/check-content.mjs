// Validates content/blog and content/weekly: the pure rules in
// lib/contentCheck.ts plus an MDX compile of every body, so a post that would
// break the Vercel build fails here first. Prints `<path>: <problem>` lines and
// exits 1 on any; otherwise prints `content ok: <n> files`.
//
//   node scripts/check-content.mjs [--root <dir>]
//
// --root defaults to the repo root.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertNode } from "./nodeVersion.mjs";

assertNode();

// Dynamic imports, so an old Node gets assertNode's message rather than a
// failure to load the .ts modules.
const { default: matter } = await import("gray-matter");
const { compile } = await import("@mdx-js/mdx");
const { checkContent } = await import("../lib/contentCheck.ts");

const args = process.argv.slice(2);
const rootFlag = args.indexOf("--root");
const root =
  rootFlag >= 0
    ? path.resolve(args[rootFlag + 1])
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = [];
for (const kind of ["blog", "weekly"]) {
  const dir = path.join(root, "content", kind);
  if (!fs.existsSync(dir)) continue;
  for (const filename of fs.readdirSync(dir).sort()) {
    if (!/\.mdx?$/.test(filename)) continue;
    const { data, content } = matter(fs.readFileSync(path.join(dir, filename), "utf8"));
    files.push({
      kind,
      path: path.posix.join("content", kind, filename),
      filename,
      data,
      body: content,
    });
  }
}

const problems = checkContent(files);

for (const file of files) {
  try {
    await compile(file.body);
  } catch (err) {
    const firstLine = String(err?.message ?? err).split("\n")[0];
    problems.push({ path: file.path, message: `MDX does not compile: ${firstLine}` });
  }
}

if (problems.length > 0) {
  for (const { path: p, message } of problems) console.log(`${p}: ${message}`);
  process.exit(1);
}
console.log(`content ok: ${files.length} files`);
