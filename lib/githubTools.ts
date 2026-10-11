// Pure half of the Stack section's GitHub activity (lib/githubActivity.ts does
// the fetching): which tools a repo uses, which repos are worth looking at, and
// how repo pushes fold into a per-tool "last used". No imports and no I/O, so
// it runs under `node --test` as well as in Next.

export type RepoSummary = {
  full_name: string;
  fork: boolean;
  archived: boolean;
  private: boolean;
  default_branch: string;
  pushed_at: string;
};

/**
 * npm dependency -> tool name. The names are the tags in lib/data.ts, verbatim:
 * the Work feed's click-to-filter matches on them, so a tool spelled differently
 * here would never light up. Extend by adding a row (`deps` exact, `prefixes`
 * for scoped families like @tsparticles/*).
 */
const DEPENDENCY_TOOLS: readonly {
  tool: string;
  deps?: readonly string[];
  prefixes?: readonly string[];
}[] = [
  { tool: "Next.js", deps: ["next"] },
  { tool: "React", deps: ["react"] },
  { tool: "TypeScript", deps: ["typescript"] },
  { tool: "Tailwind CSS", deps: ["tailwindcss"] },
  { tool: "Express", deps: ["express"] },
  { tool: "MongoDB", deps: ["mongoose", "mongodb"] },
  { tool: "JWT", deps: ["jsonwebtoken"] },
  { tool: "Razorpay", deps: ["razorpay"] },
  { tool: "Lenis", deps: ["lenis", "@studio-freight/lenis"] },
  { tool: "Swiper.js", deps: ["swiper"] },
  { tool: "Particle.js", deps: ["particles.js"], prefixes: ["tsparticles", "@tsparticles/"] },
  // Frameworks that only exist to run a Node server. Not `next`: every Next app
  // runs on Node, which would make Node.js "used" whenever the portfolio is.
  {
    tool: "Node.js",
    deps: ["express", "fastify", "koa", "@hapi/hapi", "@nestjs/core"],
  },
];

/** GitHub language -> tool name, for repos with no package.json to read. */
const LANGUAGE_TOOLS: Readonly<Record<string, string>> = {
  TypeScript: "TypeScript",
  JavaScript: "JavaScript",
  HTML: "HTML",
  CSS: "CSS",
};

/**
 * A language must be at least this share of a repo's bytes to count. Without a
 * floor, the .mjs config files every Next/Tailwind repo carries
 * (eslint.config.mjs, postcss.config.mjs) would mark JavaScript as used.
 */
const MIN_LANGUAGE_SHARE = 0.05;

/** `node server.js`, `nodemon ...`, `ts-node ...`, `tsx ...` at a command start. */
const NODE_SCRIPT = /(^|[\s&;|(])(node|nodemon|ts-node|tsx)(\s|$)/;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Tools implied by a package.json's dependencies and scripts. Never throws. */
export function toolsFromPackageJson(pkg: unknown): Set<string> {
  const tools = new Set<string>();
  if (!isRecord(pkg)) return tools;

  const deps = new Set<string>();
  for (const key of ["dependencies", "devDependencies"] as const) {
    const block = pkg[key];
    if (isRecord(block)) for (const name of Object.keys(block)) deps.add(name);
  }
  for (const { tool, deps: exact = [], prefixes = [] } of DEPENDENCY_TOOLS) {
    if (
      exact.some((d) => deps.has(d)) ||
      prefixes.some((p) => [...deps].some((d) => d.startsWith(p)))
    ) {
      tools.add(tool);
    }
  }

  if (isRecord(pkg.scripts)) {
    for (const key of ["start", "dev", "serve"]) {
      const script = pkg.scripts[key];
      if (typeof script === "string" && NODE_SCRIPT.test(script)) {
        tools.add("Node.js");
      }
    }
  }
  return tools;
}

/** Tools implied by GitHub's `/languages` byte counts. Never throws. */
export function toolsFromLanguages(languages: unknown): Set<string> {
  const tools = new Set<string>();
  if (!isRecord(languages)) return tools;

  const bytes = Object.entries(languages).filter(
    (e): e is [string, number] => typeof e[1] === "number" && e[1] > 0,
  );
  const total = bytes.reduce((sum, [, n]) => sum + n, 0);
  if (total === 0) return tools;

  for (const [language, n] of bytes) {
    const tool = LANGUAGE_TOOLS[language];
    if (tool && n / total >= MIN_LANGUAGE_SHARE) tools.add(tool);
  }
  return tools;
}

/** Profile README repo ("owner/owner"): content, not a project. */
function isProfileRepo(fullName: string): boolean {
  const [owner, name] = fullName.split("/");
  return !!owner && owner.toLowerCase() === name?.toLowerCase();
}

/** The user's GitHub login: their own account, and the author of the commits the automation reads. */
export const USER_LOGIN = "Kumar-Prasannajit";

/**
 * The only GitHub owners whose repos may show on the site: the user's own
 * account and the org they own. An allowlist on purpose — the token can also
 * see an employer's repos (AIdeas-Tech-Solutions-Private-Limited) that must
 * never appear, and an org joined later stays out until it is added here.
 */
export const ALLOWED_OWNERS: readonly string[] = [
  USER_LOGIN,
  "salonjaa-digital-solution",
];

/**
 * Single repos the user built that live on someone else's personal account.
 * Named one by one so those accounts' other repos never count. All public, so
 * they need no token.
 */
export const ALLOWED_REPOS: readonly string[] = [
  "biraceyuva-GIET/giet-eyuva-center",
  "navgyanpvt/Shrimp-Disease-Detection",
  "OmkarPadhy/E-Fiesta-2k25",
];

/**
 * The GitHub API URL listing `owner`'s most recently pushed repos. The user's
 * own account uses /user/repos when a token is present (private repos too,
 * affiliation=owner so never org or collaborator ones) and the public listing
 * otherwise; any other owner is an org. Shared by the site's Stack section and
 * scripts/collect-activity.mjs.
 */
export function repoListUrl(owner: string, hasToken: boolean): string {
  const me = USER_LOGIN;
  if (owner.toLowerCase() !== me.toLowerCase()) {
    return `https://api.github.com/orgs/${owner}/repos?sort=pushed&per_page=100`;
  }
  return hasToken
    ? "https://api.github.com/user/repos?affiliation=owner&sort=pushed&per_page=100"
    : `https://api.github.com/users/${me}/repos?sort=pushed&per_page=30`;
}

/**
 * Whether "owner/name" belongs to one of `owners`, or is one of `repos`
 * (both case-insensitive).
 */
export function isAllowedRepo(
  fullName: string,
  owners: readonly string[],
  repos: readonly string[] = [],
): boolean {
  const name = fullName.toLowerCase();
  const owner = name.split("/")[0];
  return (
    owners.some((o) => o.toLowerCase() === owner) ||
    repos.some((r) => r.toLowerCase() === name)
  );
}

/**
 * The `limit` most recently pushed repos worth scanning: no forks, archived
 * repos or the profile repo, and, when `owners` is given, only repos those
 * accounts or orgs own or that `repos` names (case-insensitive). Sorts defensively rather than
 * trusting the API's order. Anything that isn't a repo list (an error body)
 * yields [].
 */
export function pickRecentRepos(
  list: unknown,
  limit: number,
  owners?: readonly string[],
  repos: readonly string[] = [],
): RepoSummary[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (r): r is RepoSummary =>
        isRecord(r) &&
        typeof r.full_name === "string" &&
        typeof r.pushed_at === "string" &&
        !r.fork &&
        !r.archived &&
        !isProfileRepo(r.full_name) &&
        (!owners || isAllowedRepo(r.full_name, owners, repos)),
    )
    .sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
    .slice(0, limit);
}

/** Newest repo push per tool. */
export function latestByTool(
  repos: readonly { pushedAt: string; tools: ReadonlySet<string> }[],
): Record<string, string> {
  const latest: Record<string, string> = {};
  for (const { pushedAt, tools } of repos) {
    for (const tool of tools) {
      const seen = latest[tool];
      if (!seen || Date.parse(pushedAt) > Date.parse(seen)) {
        latest[tool] = pushedAt;
      }
    }
  }
  return latest;
}
