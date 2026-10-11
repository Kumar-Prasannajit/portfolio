// Pure content rules for content/blog and content/weekly, run by
// scripts/check-content.mjs (which adds the MDX compile) before a drafted post
// becomes a PR and again in CI. No imports and no I/O, so it runs under
// `node --test`. Messages are part of the contract: the tests and the
// routine's instructions quote them.

export type ContentFile = {
  kind: "blog" | "weekly";
  path: string;
  filename: string;
  data: Record<string, unknown>; // gray-matter's parsed frontmatter
  body: string;
};

export type Problem = { path: string; message: string };

/** Case-insensitive substrings that must never appear in a post. Add terms here. */
export const EMPLOYER_TERMS: readonly string[] = ["aideas", "ai-ideas", "ai ideas tech"];

// Zero-width and soft-hyphen characters that could hide a term from a substring match.
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

const normalize = (text: string) => text.replace(INVISIBLE, "").toLowerCase();

/** The first employer term `text` contains, or null. Also used on content/ideas.md. */
export function mentionsEmployer(text: string): string | null {
  const t = normalize(text);
  return EMPLOYER_TERMS.find((term) => t.includes(term)) ?? null;
}

const REQUIRED: Record<ContentFile["kind"], readonly string[]> = {
  blog: ["title", "date", "tags", "excerpt"],
  weekly: ["title", "date", "summary"],
};

const LINKEDIN_MAX = 3000;

const isMissing = (v: unknown) => v === undefined || v === null || v === "";

/** A quoted YYYY-MM-DD that is a real calendar date. A YAML Date object is not a string, so it fails. */
function isIsoDate(v: unknown): boolean {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === v;
}

const slugOf = (filename: string) => filename.replace(/\.mdx?$/, "");

function fileProblems(file: ContentFile): string[] {
  const { data } = file;
  const out: string[] = [];

  for (const field of REQUIRED[file.kind]) {
    if (isMissing(data[field])) out.push(`missing \`${field}\``);
  }

  if (
    file.kind === "blog" &&
    !isMissing(data.tags) &&
    !(
      Array.isArray(data.tags) &&
      data.tags.length > 0 &&
      data.tags.every((t) => typeof t === "string" && t !== "")
    )
  ) {
    out.push("`tags` must be a non-empty list of strings");
  }

  for (const field of ["date", "updated"]) {
    if (!isMissing(data[field]) && !isIsoDate(data[field])) {
      out.push(`\`${field}\` must be a quoted YYYY-MM-DD string`);
    }
  }

  const linkedin = data.linkedin;
  if (linkedin !== undefined && (typeof linkedin !== "string" || linkedin.length > LINKEDIN_MAX)) {
    out.push(`\`linkedin\` must be text of at most ${LINKEDIN_MAX} characters`);
  }

  // next-mdx-remote (what the site renders with) drops `{…}` expressions, so
  // text in braces would silently vanish from the published post. Code and
  // {/* comments */} are fine.
  const prose = file.body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  if (prose.includes("{")) {
    out.push("body has `{…}` outside code; the site strips it, so put it in backticks");
  }

  const text = normalize(`${JSON.stringify(data)}\n${file.body}`);
  for (const term of EMPLOYER_TERMS) {
    if (text.includes(term)) out.push(`mentions "${term}"`);
  }
  return out;
}

/** Every rule over every file; problems come back in file order. */
export function checkContent(files: ContentFile[]): Problem[] {
  const problems: { file: number; path: string; message: string }[] = [];
  const add = (file: number, message: string) =>
    problems.push({ file, path: files[file].path, message });

  files.forEach((file, i) => fileProblems(file).forEach((m) => add(i, m)));

  // Weekly numbers must match how lib/content.ts numbers entries: by date.
  const weekly = files
    .map((file, i) => ({ file, i }))
    .filter(({ file }) => file.kind === "weekly")
    .sort(
      (a, b) =>
        String(a.file.data.date).localeCompare(String(b.file.data.date)) ||
        a.file.filename.localeCompare(b.file.filename),
    );
  weekly.forEach(({ file, i }, n) => {
    const expected = String(n + 1).padStart(3, "0");
    const prefix = /^(\d+)-/.exec(file.filename)?.[1];
    if (prefix !== expected) {
      add(i, `expected number ${expected} from date order, file has ${prefix ?? "none"}`);
    }
  });

  const seen = new Set<string>();
  files.forEach((file, i) => {
    const key = `${file.kind}/${slugOf(file.filename)}`;
    if (seen.has(key)) add(i, `duplicate slug "${slugOf(file.filename)}"`);
    seen.add(key);
  });

  return problems
    .sort((a, b) => a.file - b.file)
    .map(({ path, message }) => ({ path, message }));
}
