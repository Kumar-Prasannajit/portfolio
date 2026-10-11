# Brutal = redblack UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking BRUTAL in rail 3 of `redesign-three-pane` shows the exact `redblack` branch UI at `/`; turning it off restores today's three-pane UI, unchanged.

**Architecture:** Two Next.js root layouts via route groups. `app/(three)/` holds the existing app (moved, not edited). `app/(rb)/` is a second root layout with `redblack`'s CSS verbatim plus its home at `/rb`, generated from `git show redblack:...` by a re-runnable script. `proxy.ts` rewrites `/` to `/rb` when cookie `kps-ui=brutal` is set. BRUTAL sets the cookie and reloads; a fixed `ExitBrutal` button clears it.

**Tech Stack:** Next.js 16.3.4 (App Router, `proxy.ts`), React 19, TypeScript, plain global CSS. No test runner exists in this repo: verification is a Node HTTP-check script, `next build`, `eslint`, `tsc`, and browser screenshots.

**Spec:** `docs/superpowers/specs/2026-09-29-brutal-redblack-swap-design.md` (read the **Amendment** section; the older "Design" section is superseded).

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code (AGENTS.md: "This is NOT the Next.js you know"). Next is **16.3.4**; middleware is called **`proxy.ts`**.
- The default (three-pane) UI must stay pixel-identical: three-pane components, `app/globals.css` and rail 3 are moved or lightly wired, never restyled.
- Git ref of the reference UI is the branch **`redblack`** (not "redblack-brutal").
- Brutal follows the existing light/dark choice: both UIs share localStorage key **`kps-mode`** (`light` | `dark`). The character-theme key **`kps-theme`** must never be written by the `(rb)` tree.
- Cookie name **`kps-ui`**, value **`brutal`**, `path=/`, `SameSite=Lax`, 1 year. It replaces localStorage `kps-ui` as the single source of truth.
- Scope pass 1: home (`/`) and its shell only. Other routes stay three-pane.
- Generated files carry a `GENERATED` banner; change behaviour via the script's `PATCHES` table, never by hand-editing generated files.
- Commit after each task. Use the `commit-message-writer` skill / Conventional Commits.

## Review Focus

1. Unknown URL (`/does-not-exist`) must still render the styled three-pane 404 with nav (needs `global-not-found`), status 404.
2. Cookie set and visiting `/rb` directly, or `/` with cookie: `/` shows redblack; `/blog` etc. still three-pane; `/rb` is `noindex`.
3. Toggling BRUTAL on a non-home route (`/blog`): no reload needed, cookie set, next visit to `/` is redblack; EXIT BRUTAL returns to three-pane `/`.
4. Light/dark chosen in one UI persists in the other (`kps-mode`), and the character theme (`kps-theme`) is untouched after a round trip.
5. `/` responses differ by cookie: with `next start`, verify with/without cookie that each gets the correct UI (no cache poisoning) and that the boot overlay does not replay on toggle (`sessionStorage kps-booted`).

---

## File Structure

| Path | Responsibility |
|---|---|
| `app/(three)/**` | Existing app, moved verbatim (`layout.tsx` slimmed to metadata + `<ThreeDocument>`) |
| `app/(three)/ThreeDocument.tsx` | Whole `<html>` document of the three-pane UI (moved out of layout so `global-not-found` can reuse it) |
| `app/global-not-found.tsx` | Unmatched-URL 404, rendered in `ThreeDocument` |
| `app/(rb)/layout.tsx`, `app/(rb)/globals.css`, `app/(rb)/rb/page.tsx` | Generated from `redblack` (root layout, CSS, home) |
| `components/rb/**`, `lib/rb/**` | Generated from `redblack`; only lib files that differ from HEAD are copied |
| `components/rb/ExitBrutal.tsx` + `.module.css` | Hand-written escape hatch (not generated) |
| `lib/brutalMode.ts` | Cookie helpers shared by `useUiMode`, `ExitBrutal`, `proxy.ts` |
| `proxy.ts` | Rewrites `/` -> `/rb` when the cookie is set |
| `scripts/port-redblack.mjs` | Re-runnable port script |
| `scripts/verify-brutal.mjs` | HTTP checks against a running server |
| `next.config.ts` | Enable `experimental.globalNotFound` |
| `lib/useUiMode.ts`, `app/(three)/ThreeDocument.tsx` (init script) | Cookie-driven toggle; init script reads the cookie |

---

### Task 1: Baseline the default UI

**Files:**
- Modify: `.gitignore` (append `/.verify`)
- Create (untracked): `.verify/baseline/*.png`, `.verify/baseline-routes.txt`

**Interfaces:**
- Produces: `.verify/baseline/` screenshots + route table that Task 2 and Task 5 compare against.

- [ ] **Step 1: Ignore the scratch dir**

```bash
printf '\n# local verification screenshots (docs/superpowers/plans/2026-09-29-brutal-redblack-swap.md)\n/.verify\n' >> .gitignore
mkdir -p .verify/baseline
```

- [ ] **Step 2: Record the current route table**

```bash
npm run build 2>&1 | tee .verify/baseline-build.txt
grep -E '^[ ]*[├└┌│]' .verify/baseline-build.txt > .verify/baseline-routes.txt
```
Expected: build succeeds; `baseline-routes.txt` lists `/`, `/blog`, `/gallery`, `/resume`, `/specs`, `/places`, `/weekly`, `/work/[slug]`, api routes.

- [ ] **Step 3: Screenshot the default UI**

Start `npx next start -p 3000` (background). With the chrome-devtools tools (`navigate_page`, `resize_page`, `take_screenshot`), capture `/`, `/blog`, `/gallery`, `/does-not-exist` at widths 1440, 1100, 390, in dark and light (toggle with the nav theme button, or `localStorage.setItem('kps-mode','light')` then reload). Save as `.verify/baseline/<route>-<width>-<mode>.png` (route `/` -> `home`). Stop the server.

- [ ] **Step 4: Commit**

```bash
git add .gitignore && git commit -m "chore: ignore local verification screenshots"
```

---

### Task 2: Move the app behind `(three)` and keep the 404

**Files:**
- Move: `app/{blog,gallery,places,resume,specs,weekly,work,globals.css,layout.tsx,not-found.tsx,page.tsx}` -> `app/(three)/`
- Create: `app/(three)/ThreeDocument.tsx`, `app/global-not-found.tsx`
- Modify: `app/(three)/layout.tsx`, `next.config.ts`
- Stay put: `app/api/**`, `apple-icon.png`, `icon.png`, `opengraph-image.tsx`, `robots.ts`, `sitemap.ts`

**Interfaces:**
- Produces: `default export ThreeDocument({ children }: { children: React.ReactNode })` in `app/(three)/ThreeDocument.tsx`: the full `<html>…</html>` document (fonts, head scripts, JSON-LD, skip link, providers, nav, HomeShell, footer, palette, cursor, analytics). Consumed by `layout.tsx` and `global-not-found.tsx`.

- [ ] **Step 1: Read the docs you are about to rely on**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md` (section `global-not-found.js`) and `.../01-getting-started/02-project-structure.md` ("Creating multiple root layouts"). Note the exact `experimental.globalNotFound` flag and whether `global-not-found` may export `metadata`.

- [ ] **Step 2: Move the files**

```bash
mkdir -p "app/(three)"
git mv app/blog app/gallery app/places app/resume app/specs app/weekly app/work \
       app/globals.css app/layout.tsx app/not-found.tsx app/page.tsx "app/(three)/"
```

- [ ] **Step 3: Extract the document into `ThreeDocument.tsx`**

`git mv "app/(three)/layout.tsx" "app/(three)/ThreeDocument.tsx"`, then edit `ThreeDocument.tsx`:
- delete the `import type { Metadata }` line and the whole `export const metadata: Metadata = { … };` block (it moves back to `layout.tsx` in Step 4; also drop any imports only it used, e.g. `SITE_URL`, `FEED_ALTERNATES` if unused after removal; `tsc` will tell you);
- rename `export default function RootLayout(` to `export default function ThreeDocument(`.
Keep everything else (fonts, `PERSON_JSON_LD`, `THEME_INIT_SCRIPT`, `BOOT_INIT_SCRIPT`, the `<html>` markup and `import "./globals.css"`) byte-for-byte.

- [ ] **Step 4: Recreate a slim `layout.tsx`**

Create `app/(three)/layout.tsx` with the `metadata` block cut in Step 3 (same content and the imports it needs) and:

```tsx
import ThreeDocument from "./ThreeDocument";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <ThreeDocument>{children}</ThreeDocument>;
}
```

- [ ] **Step 5: Add `global-not-found`**

`next.config.ts`: add inside `nextConfig`:
```ts
  // Two root layouts ((three) and (rb)) mean there is no single layout to
  // compose an unmatched-URL 404 from; global-not-found renders it instead.
  experimental: { globalNotFound: true },
```
`app/global-not-found.tsx`:
```tsx
import type { Metadata } from "next";
import ThreeDocument from "./(three)/ThreeDocument";
import NotFound from "./(three)/not-found";

export const metadata: Metadata = {
  title: "Page not found | Kumar Prasannajit Sahu",
};

export default function GlobalNotFound() {
  return (
    <ThreeDocument>
      <NotFound />
    </ThreeDocument>
  );
}
```
If the docs from Step 1 say `metadata` isn't allowed there, drop that export (the doc dictates).

- [ ] **Step 6: Verify nothing changed for users**

```bash
npx tsc --noEmit && npm run lint && npm run build 2>&1 | tee .verify/after-move-build.txt
grep -E '^[ ]*[├└┌│]' .verify/after-move-build.txt | diff - .verify/baseline-routes.txt && echo ROUTES-IDENTICAL
```
Expected: no type/lint errors; `ROUTES-IDENTICAL` (route groups don't change URLs). Then `npx next start -p 3000`, re-take the Task 1 screenshots into `.verify/after-move/`, and compare each against baseline by viewing both images (layout, colours, nav, rails, 404 with nav). `curl -s -o /dev/null -w "%{http_code}" localhost:3000/does-not-exist` must print `404`.

- [ ] **Step 7: Commit**

```bash
git add -A app next.config.ts && git commit -m "refactor(app): move existing UI into (three) route group with global-not-found"
```

---

### Task 3: Port `redblack` into the `(rb)` group

**Files:**
- Create: `scripts/port-redblack.mjs`; generated `app/(rb)/layout.tsx`, `app/(rb)/globals.css`, `app/(rb)/rb/page.tsx`, `components/rb/**`, `lib/rb/**`
- Modify: `package.json` (only if the script reports missing packages)

**Interfaces:**
- Produces: route `/rb` (redblack home); layout imports `@/components/rb/ExitBrutal` (created in Task 4, so the build stays red until Task 4 Step 2 lands; do Steps 1-5 here, then Task 4 Steps 1-2 before running the build).
- Rewrites: `@/components/X` -> `@/components/rb/X`; `@/lib/X` -> `@/lib/rb/X` only when `lib/X` differs between HEAD and `redblack` (expected: `data`, `panelScroll`, `useTheme`); identical libs (`site`, `views`, `location`, `useNowPlaying`, `motion`, ...) remain shared.

- [ ] **Step 1: Write the script**

Create `scripts/port-redblack.mjs`:

```js
#!/usr/bin/env node
// Copies the redblack branch's UI into the (rb) route group. Re-runnable:
//   node scripts/port-redblack.mjs
// Starts from redblack's app/layout.tsx + app/page.tsx and follows imports.
// Do not hand-edit the output; change PATCHES below instead.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, posix } from "node:path";

const REF = "redblack";
const BANNER = `// GENERATED by scripts/port-redblack.mjs from git ref "${REF}". Do not edit; change PATCHES in the script.\n`;

const run = (args, opts = {}) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 26, ...opts });
const show = (p) => run(["show", `${REF}:${p}`]);
const exists = (p) => {
  try {
    execFileSync("git", ["cat-file", "-e", `${REF}:${p}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
const identicalToHead = (p) => {
  try {
    execFileSync("git", ["diff", "--quiet", "HEAD", REF, "--", p]);
    return true;
  } catch {
    return false;
  }
};

const ENTRIES = {
  "app/layout.tsx": "app/(rb)/layout.tsx",
  "app/page.tsx": "app/(rb)/rb/page.tsx",
  "app/globals.css": "app/(rb)/globals.css",
};
const outOf = (p) => {
  if (ENTRIES[p]) return ENTRIES[p];
  if (p.startsWith("components/")) return `components/rb/${p.slice(11)}`;
  if (p.startsWith("lib/")) return `lib/rb/${p.slice(4)}`;
  throw new Error(`no output mapping for ${p}`);
};

const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\s+(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g;
const importsOf = (p) => [...show(p).matchAll(IMPORT_RE)].map((m) => m[1]);

function resolve(spec, from) {
  let base;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) base = posix.normalize(posix.join(posix.dirname(from), spec));
  else return null; // npm package
  const hit = [`${base}.tsx`, `${base}.ts`, base].find(exists);
  if (!hit) throw new Error(`${from}: cannot resolve "${spec}"`);
  return hit;
}

// 1. Walk the import graph from the entries.
const files = new Set();
const packages = new Set();
const queue = ["app/layout.tsx", "app/page.tsx"];
while (queue.length) {
  const p = queue.pop();
  if (files.has(p)) continue;
  files.add(p);
  if (!/\.tsx?$/.test(p)) continue;
  for (const spec of importsOf(p)) {
    const target = resolve(spec, p);
    if (!target) {
      packages.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
      continue;
    }
    if (target.startsWith("lib/") && identicalToHead(target)) {
      // Shared as-is, so it must not lean on a lib file that diverged.
      for (const s of importsOf(target)) {
        const t = resolve(s, target);
        if (t && t.startsWith("lib/") && !identicalToHead(t))
          throw new Error(`shared ${target} imports diverged ${t}; copy ${target} too`);
      }
      continue;
    }
    if (target.startsWith("app/") && !ENTRIES[target]) throw new Error(`${p}: unexpected app import ${target}`);
    queue.push(target);
  }
}

// 2. Rewrite imports.
const copiedLib = new Set([...files].filter((f) => f.startsWith("lib/")).map((f) => f.replace(/\.tsx?$/, "")));
const rewrite = (src) =>
  src
    .replace(/(["'])@\/components\//g, "$1@/components/rb/")
    .replace(/(["'])@\/(lib\/[A-Za-z0-9_-]+)\1/g, (m, q, mod) =>
      copiedLib.has(mod) ? `${q}@/lib/rb/${mod.slice(4)}${q}` : m,
    );

// 3. Exact-string patches (each must match, so upstream drift fails loudly).
const PATCHES = {
  "app/(rb)/layout.tsx": [
    // share light/dark with the three-pane UI; never touch kps-theme (character)
    ["localStorage.getItem('kps-theme')", "localStorage.getItem('kps-mode')"],
    [
      'import ViewCounter from "@/components/rb/ViewCounter";',
      'import ViewCounter from "@/components/rb/ViewCounter";\nimport ExitBrutal from "@/components/rb/ExitBrutal";',
    ],
    ["<ViewCounter />", "<ViewCounter />\n        <ExitBrutal />"],
  ],
  "lib/rb/useTheme.ts": [['localStorage.setItem("kps-theme", next)', 'localStorage.setItem("kps-mode", next)']],
  "app/(rb)/rb/page.tsx": [
    ["export const metadata: Metadata = pageMetadata({", "export const metadata: Metadata = {\n  ...pageMetadata({"],
    ['  path: "/",\n});', '  path: "/",\n  }),\n  robots: { index: false, follow: true },\n};'],
  ],
};

// 4. Write.
const banner = (out, text) => (/\.tsx?$/.test(out) ? BANNER + text : text);
const outputs = {};
for (const p of files) {
  const out = outOf(p);
  let text = /\.tsx?$/.test(p) ? rewrite(show(p)) : show(p);
  for (const [from, to] of PATCHES[out] ?? []) {
    if (!text.includes(from)) throw new Error(`${out}: patch target not found: ${from}`);
    text = text.replace(from, to);
  }
  outputs[out] = text;
}
for (const out of Object.keys(PATCHES))
  if (!(out in outputs)) throw new Error(`patch for ${out} but it was not generated`);
for (const [out, text] of Object.entries(outputs)) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, banner(out, text));
}

// 5. Report what needs a human: missing npm packages and missing public assets.
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const have = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }));
const missingPkgs = [...packages].filter((n) => !have.has(n) && !["react", "react-dom"].includes(n));
const ASSET_RE = /["'(](\/[A-Za-z0-9_\-./]+\.(?:png|jpe?g|webp|avif|svg|ico|gif|pdf|woff2?|mp3|mp4))["')]/g;
const missingAssets = new Set();
for (const text of Object.values(outputs))
  for (const m of text.matchAll(ASSET_RE)) if (!existsSync(`public${m[1]}`)) missingAssets.add(m[1]);

console.log(`ported ${Object.keys(outputs).length} files`);
console.log("lib copied to lib/rb:", [...copiedLib].join(", ") || "(none)");
if (missingPkgs.length) console.log("MISSING PACKAGES (npm install):", missingPkgs.join(" "));
if (missingAssets.size) console.log("MISSING PUBLIC ASSETS:", [...missingAssets].join(" "));
```

- [ ] **Step 2: Run it**

```bash
node scripts/port-redblack.mjs
```
Expected: prints `ported N files` and `lib copied to lib/rb: lib/data, lib/panelScroll, lib/useTheme` (exactly those three; if others appear, read why: it means they differ from HEAD and are correctly isolated). If it throws "patch target not found", compare against `git show redblack:<file>` and fix the patch string.

- [ ] **Step 3: Resolve reported gaps**

If `MISSING PACKAGES` is printed: `npm install <names>` (e.g. `gsap@^3.15.0` if a ported file imports it; three-pane dropped it). If `MISSING PUBLIC ASSETS` is printed: `git checkout redblack -- public/<file>` for each.

- [ ] **Step 4: Inspect the highest-risk generated lines**

```bash
grep -rn "kps-" "app/(rb)" lib/rb components/rb
```
Expected: `kps-mode` only for theme (layout script, `lib/rb/useTheme.ts`), plus `kps-booted` (sessionStorage, shared and harmless); no `kps-theme` anywhere under `(rb)`/`rb`. `data-theme` (light/dark) remains, which is correct for redblack's CSS.

- [ ] **Step 5: Commit (build is completed after Task 4 Step 2)**

```bash
git add scripts/port-redblack.mjs "app/(rb)" components/rb lib/rb package.json package-lock.json
git commit -m "feat(brutal): port the redblack UI into an isolated (rb) route group"
```

---

### Task 4: Cookie plumbing, ExitBrutal, proxy, toggle

**Files:**
- Create: `lib/brutalMode.ts`, `components/rb/ExitBrutal.tsx`, `components/rb/ExitBrutal.module.css`, `proxy.ts`, `scripts/verify-brutal.mjs`
- Modify: `lib/useUiMode.ts`, `app/(three)/ThreeDocument.tsx` (the `THEME_INIT_SCRIPT` `data-ui` lines)

**Interfaces:**
- `lib/brutalMode.ts`: `export const UI_COOKIE = "kps-ui"`; `export function setBrutalCookie(on: boolean): void` (client only).
- `lib/useUiMode.ts`: unchanged signature `useUiMode(): { brutal: boolean; toggle: () => void }`. `RailThree.tsx`'s `BrutalButton` keeps working with no edit.

- [ ] **Step 1: Write the failing HTTP check first**

Create `scripts/verify-brutal.mjs`:

```js
#!/usr/bin/env node
// HTTP checks for the brutal swap. Usage: node scripts/verify-brutal.mjs [baseUrl]
// Run against `next start` (cache headers only mean something in production).
const BASE = process.argv[2] ?? "http://localhost:3000";
let failed = 0;
const get = (path, cookie) =>
  fetch(BASE + path, { redirect: "manual", headers: cookie ? { cookie } : {} }).then(async (r) => ({
    status: r.status,
    cc: r.headers.get("cache-control"),
    vary: r.headers.get("vary"),
    html: await r.text(),
  }));
// The three-pane <html> carries data-ui; the redblack one does not.
const isThree = (h) => /<html[^>]*data-ui=/.test(h);
const isRb = (h) => !isThree(h) && h.includes("EXIT BRUTAL");
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!ok) failed++;
};
const BRUTAL = "kps-ui=brutal";

let r = await get("/");
check("/ without cookie = three-pane", r.status === 200 && isThree(r.html), `cache-control=${r.cc} vary=${r.vary}`);
r = await get("/", BRUTAL);
check("/ with cookie = redblack", r.status === 200 && isRb(r.html), `cache-control=${r.cc} vary=${r.vary}`);
r = await get("/");
check("/ without cookie again = three-pane (no cache poisoning)", isThree(r.html));
r = await get("/blog", BRUTAL);
check("/blog with cookie stays three-pane (pass 1 scope)", r.status === 200 && isThree(r.html));
r = await get("/rb");
check("/rb direct = redblack, noindex", r.status === 200 && isRb(r.html) && /name="robots"[^>]*noindex/.test(r.html));
r = await get("/does-not-exist");
check("unknown URL = 404 with three-pane chrome", r.status === 404 && isThree(r.html) && r.html.includes("Page not found"));
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Add ExitBrutal and the cookie helper (so the build can go green)**

`lib/brutalMode.ts`:
```ts
// The brutal-mode switch is a cookie, not localStorage, so proxy.ts can see it
// and serve the redblack UI at "/" on the very first paint (no flash).
export const UI_COOKIE = "kps-ui";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function setBrutalCookie(on: boolean) {
  document.cookie = on
    ? `${UI_COOKIE}=brutal; path=/; max-age=${ONE_YEAR}; SameSite=Lax`
    : `${UI_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
```
`components/rb/ExitBrutal.tsx`:
```tsx
"use client";

// The redblack tree has no rail 3 (where the BRUTAL button lives), so this
// fixed button is the only way back to the default UI.
import { setBrutalCookie } from "@/lib/brutalMode";
import styles from "./ExitBrutal.module.css";

export default function ExitBrutal() {
  return (
    <button
      type="button"
      className={styles.exit}
      onClick={() => {
        setBrutalCookie(false);
        window.location.assign("/");
      }}
    >
      EXIT BRUTAL
    </button>
  );
}
```
`components/rb/ExitBrutal.module.css`:
```css
.exit {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 60;
  padding: 10px 14px;
  font: 700 12px/1 var(--font-mono);
  letter-spacing: 0.08em;
  color: var(--ink);
  background: var(--bg);
  border: var(--bw) solid var(--line);
  box-shadow: var(--off) var(--off) 0 var(--shadow-color);
  cursor: pointer;
}
.exit:hover {
  transform: translate(-2px, -2px);
  box-shadow: calc(var(--off) + 2px) calc(var(--off) + 2px) 0 var(--shadow-color);
}
.exit:active {
  transform: translate(var(--off-sm), var(--off-sm));
  box-shadow: none;
}
.exit:focus-visible {
  outline: var(--bw-thin) solid var(--focus);
  outline-offset: 3px;
}
```

- [ ] **Step 3: Run the check and watch it fail**

```bash
npx tsc --noEmit && npm run build && (npx next start -p 3000 &) && sleep 4 && node scripts/verify-brutal.mjs
```
Expected: build passes. FAIL on `/ with cookie = redblack` (no proxy yet).

- [ ] **Step 4: Add the proxy**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` for the current API, then create `proxy.ts` at the repo root:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { UI_COOKIE } from "@/lib/brutalMode";

// "/" is served by the (rb) route group's /rb page while the brutal cookie is
// set. The URL stays "/", so redblack's own pathname checks keep working.
export function proxy(request: NextRequest) {
  if (request.cookies.get(UI_COOKIE)?.value === "brutal") {
    return NextResponse.rewrite(new URL("/rb", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: "/" };
```

- [ ] **Step 5: Make the toggle and the init script use the cookie**

`lib/useUiMode.ts`: replace the `toggle` callback and drop the localStorage writes (keep the mount effect that reads `data-ui`):

```ts
import { setBrutalCookie } from "@/lib/brutalMode";
// ...
  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next = root.getAttribute("data-ui") !== "brutal";
    if (next) root.setAttribute("data-ui", "brutal");
    else root.removeAttribute("data-ui");
    setBrutal(next);
    setBrutalCookie(next);
    try {
      localStorage.removeItem("kps-ui"); // legacy key, superseded by the cookie
    } catch {}
    // "/" is swapped by proxy.ts, so it needs a fresh request; other routes
    // just take the token override above until pass 2.
    if (window.location.pathname === "/") window.location.reload();
  }, []);
```
Update the header comment: brutal is now cookie-driven and reloads on `/`.

In `app/(three)/ThreeDocument.tsx`, inside `THEME_INIT_SCRIPT`, replace
```js
    var ui = localStorage.getItem('kps-ui');
    if(ui === 'brutal'){
```
with
```js
    if(document.cookie.indexOf('kps-ui=brutal') > -1){
```
(keep the `d.setAttribute('data-ui', 'brutal');` line and closing brace).

- [ ] **Step 6: Run the check and watch it pass**

```bash
pkill -f "next start" ; npm run build && (npx next start -p 3000 &) && sleep 4 && node scripts/verify-brutal.mjs
```
Expected: six `PASS` lines. Read the printed `cache-control` / `vary` for the two `/` rows; if both `/` responses are shared-cacheable with identical keys, add `Vary: Cookie` on the proxy responses (Review Focus 5) and re-run.

- [ ] **Step 7: Lint, then commit**

```bash
npm run lint && git add lib/brutalMode.ts lib/useUiMode.ts proxy.ts components/rb/ExitBrutal.tsx components/rb/ExitBrutal.module.css scripts/verify-brutal.mjs "app/(three)/ThreeDocument.tsx" && git commit -m "feat(brutal): cookie-driven swap to the redblack UI with proxy rewrite and exit button"
```

---

### Task 5: Visual parity, round trips, docs

**Files:**
- Modify: `docs/PROGRESS.md` (append a short entry)
- Create (untracked): `.verify/rb/*.png`, `.verify/ref/*.png`

- [ ] **Step 1: Stand up the reference**

```bash
git worktree add ../portfolio-redblack redblack
cd ../portfolio-redblack && npm ci && (npx next dev -p 3100 &)
```

- [ ] **Step 2: Compare at every size**

With the chrome-devtools tools, for widths 1440, 1100, 390 and modes dark and light: screenshot `http://localhost:3100/` (reference, into `.verify/ref/`) and `http://localhost:3000/` after setting cookie `kps-ui=brutal` (into `.verify/rb/`). View pairs side by side and check: nav (tagline, links, theme button), identity panel (portrait, clock/date/viewers tiles), hero, marquee (yellow), heatmap, about terminal card, stack, experience cards, work section, contact band, right project loop, custom square cursor, hard shadows. Expected: identical apart from live values (clock, viewers, now-playing). Any difference is a bug in the port script or its `PATCHES`: fix there, rerun `node scripts/port-redblack.mjs`, re-verify.

- [ ] **Step 3: Round trips in the real browser**

1. On `/`, click BRUTAL: page reloads to redblack; no boot overlay replay; `EXIT BRUTAL` visible; light/dark toggle in the redblack nav works; reload keeps redblack.
2. Click EXIT BRUTAL: three-pane returns; the chosen character theme (`localStorage kps-theme`) is unchanged; the light/dark choice made in redblack is still applied (`kps-mode`).
3. Go to `/blog`, toggle BRUTAL (or set the cookie in devtools): no reload; go to `/`: redblack; EXIT returns.
4. Console: no errors on `/`, `/rb`, or transitions between them.
5. Re-take the default-UI screenshots (Task 1 list) into `.verify/final/` and confirm they match `.verify/baseline/`.

- [ ] **Step 4: Final gates and cleanup**

```bash
git worktree remove ../portfolio-redblack --force
npx tsc --noEmit && npm run lint && npm run build
node scripts/verify-brutal.mjs    # against next start on :3000
```
Also confirm in the `npm run build` route table that `/` and `/rb` are listed separately, with the redblack code only under `/rb`.

- [ ] **Step 5: Docs and commit**

Append to `docs/PROGRESS.md` a dated entry: BRUTAL now swaps to the redblack UI via route groups + `proxy.ts`; how to refresh the port (`node scripts/port-redblack.mjs`); pass 2 (blog/weekly/gallery/work/resume/places/specs in Brutal) is open. Update `docs/redesign-spec.md` where it describes BRUTAL as a token-only override.

```bash
git add docs && git commit -m "docs: record brutal = redblack UI swap and remaining pass-2 work"
```

---

## Self-review

- **Spec coverage:** route-group isolation (T2, T3), script-generated port (T3), proxy rewrite + cookie (T4), light/dark via `kps-mode` (T3 patches), exit control (T4), `global-not-found` (T2), unchanged default UI (T1/T2/T5 comparisons), scope limited to home/shell (T4 `/blog` check), verification incl. reference worktree (T5). Trade-offs (reload on toggle, non-home routes three-pane) match the spec Amendment.
- **Placeholders:** none; the only conditional instructions (docs-dependent `global-not-found` metadata, script-reported missing packages/assets) name exactly what to check and do.
- **Type/name consistency:** `UI_COOKIE`/`setBrutalCookie` defined in T4 Step 2, used in `proxy.ts`, `useUiMode.ts`, `ExitBrutal.tsx`; `ThreeDocument` defined T2, used in `layout.tsx` and `global-not-found.tsx`; `ExitBrutal` path `@/components/rb/ExitBrutal` matches the T3 patch and T4 file.
- **Order caveat:** Task 3 leaves the build red until Task 4 Step 2 (the layout imports `ExitBrutal`); the plan says so at both places.
