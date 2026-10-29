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

const args = process.argv.slice(2);
const rootFlag = args.indexOf("--root");
const root =
  rootFlag >= 0
    ? path.resolve(args[rootFlag + 1])
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = [];
const parseProblems = [];
let foundDir = false;
for (const kind of ["blog", "weekly"]) {
  const dir = path.join(root, "content", kind);
  if (!fs.existsSync(dir)) continue;
  foundDir = true;
  for (const filename of fs.readdirSync(dir).sort()) {
    if (!/\.mdx?$/.test(filename)) continue;
    const filePath = path.posix.join("content", kind, filename);
    try {
      const { data, content } = matter(fs.readFileSync(path.join(dir, filename), "utf8"));
      files.push({ kind, path: filePath, filename, data, body: content });
    } catch (err) {
      const firstLine = String(err?.message ?? err).split("\n")[0];
      parseProblems.push({ path: filePath, message: `frontmatter does not parse: ${firstLine}` });
    }
  }
}
if (!foundDir) {
  console.log(`no content/blog or content/weekly under ${root}`);
  process.exit(1);
}

// Loaded only now: on Windows, Node 24 can crash in process.exit() shortly after
// importing a .ts module, so the early exit above must come first.
const { checkContent, mentionsEmployer } = await import("../lib/contentCheck.ts");

// Existing covers as URL paths, so a `coverImage` that names a missing file fails.
const coversDir = path.join(root, "public", "covers");
const publicPaths = new Set(
  fs.existsSync(coversDir) ? fs.readdirSync(coversDir).map((name) => `/covers/${name}`) : [],
);

const problems = [...parseProblems, ...checkContent(files, publicPaths)];

for (const file of files) {
  try {
    await compile(file.body);
  } catch (err) {
    const firstLine = String(err?.message ?? err).split("\n")[0];
    problems.push({ path: file.path, message: `MDX does not compile: ${firstLine}` });
  }
}

// The idea backlog is never rendered, but it is public in the repo and feeds
// the blog prompt, so it gets the employer-term check too.
const ideasPath = path.join(root, "content", "ideas.md");
if (fs.existsSync(ideasPath)) {
  const term = mentionsEmployer(fs.readFileSync(ideasPath, "utf8"));
  if (term) problems.push({ path: "content/ideas.md", message: `mentions "${term}"` });
}

if (problems.length > 0) {
  for (const { path: p, message } of problems) console.log(`${p}: ${message}`);
  process.exitCode = 1;
} else {
  console.log(`content ok: ${files.length} files`);
}
