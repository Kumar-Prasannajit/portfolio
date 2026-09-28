# Redesign progress

State of the `redesign-three-pane` build against `docs/redesign-spec.md`. Read this before
touching anything. Updated in the same commit as the phase work it describes — never separately.

---

## Phase 1 — Token architecture and theme system
Status: done
Commit: (pending — committed together with this file)
Decisions:
- Split every token into two independent groups: **neutrals** (vary only by `data-mode`,
  untouched from the pre-redesign palette) and **accent** (`--accent`, `--accent-solid`,
  `--accent-dim`, `--accent-ink`, vary only by `data-theme` x `data-mode`). This is what makes
  "zero combination-specific style rules" possible — no rule anywhere needs to know both axes
  at once except the token definitions themselves.
- The pre-existing `--red`/`--red-solid`/`--red-dim`/`--red-ink` tokens (and everywhere they
  were consumed — 12 files, mostly `.module.css`) are renamed to `--accent`/`--accent-solid`/
  `--accent-dim`/`--accent-ink`. `--red` hardcoded an assumption that's false for zoro/luffy/news.
- The pre-existing light/dark toggle used `data-theme="light"|"dark"`. That attribute name is
  now needed for the character palette, so the mode toggle moved to `data-mode="light"|"dark"`
  (`lib/useTheme.ts`, `app/layout.tsx`, `app/globals.css`). `localStorage` keys renamed to match:
  `kps-theme` (character, was the mode key), `kps-mode` (mode, was `kps-theme`), `kps-ui` (new).
  `useTheme.ts`'s existing View Transitions wave toggle is untouched beyond the attribute rename.
- Contribution-graph heat scale (`--heat-0..4`) is derived from `--accent`/`--accent-solid` via
  `color-mix()` instead of 5 hand-picked hex values per theme x mode (was 10 values for 2 modes;
  would have been 40 across 4 themes). One definition, correct for every theme automatically.
- `news` theme's accent tokens are defined as `var(--ink)` / `var(--bg)` / `var(--ink-dim)`
  rather than fixed hex — "the accent is the foreground itself" per the spec, and it inherits
  whatever contrast those neutrals already guarantee, in both modes, for free.
- Brutal mode (`data-ui="brutal"`) overrides exactly `--border-width` (1px→3px), `--radius`
  (12px→0), `--shadow` (soft blur → hard offset via `var(--border-2)`), and
  `--font-weight-display` + `--tracking-display` (400/-0.01em → 900/-0.03em) — ~10 lines.
- Palette changes crossfade over 200ms via a `*` rule scoped to
  background-color/border-color/color/fill/stroke only, so it never fights a component's own
  `transition` (higher specificity replaces it outright) and never eases border-width/radius/
  shadow — those still hard-cut under brutal, as specified.
- No-flash script (`app/layout.tsx`) now stamps all three axes before paint: `data-theme`
  always gets an explicit value (defaults to `shanks` — a character theme has no OS-level
  preference to fall back to, unlike mode), `data-mode` stays unset when nothing is saved (same
  as before the redesign) so the `prefers-color-scheme` CSS fallback resolves it with no JS
  dependency, `data-ui` only gets stamped when `brutal` is saved.
Deviated:
- **Did not retrofit every existing border-radius/border-width/box-shadow declaration in
  `globals.css` to consume the new brutal tokens.** Only `.site-frame`, `.nav-grid` (persistent
  chrome, protected, survives every later phase unchanged) and the four display-font headings
  (`.hero h1`, `.h2`, `.contact-h`, `.pcard-name` — font-weight/letter-spacing only) were wired
  up. Everything else that currently hardcodes a border/radius/shadow (cards, pills, buttons,
  chips, the project-card pixel frame, gallery/place cards) belongs to sections phases 2, 3, 5,
  6 and 7 are about to rebuild or replace outright — wiring them to `--border-width`/`--radius`
  now would be thrown away within one or two phases. New CSS written in those phases should
  consume the tokens from the start instead of hardcoding values, the same way `.nav-grid` now
  does. Flagging this explicitly so it isn't mistaken for "brutal mode doesn't do anything yet"
  — it composes correctly everywhere it's been wired in (verified live, see below).
- luffy/zoro/news exact hex values are a first pass, hand-picked and checked against
  `--bg`/`--panel` in both modes with a WCAG contrast script (all >=4.5:1, luffy the closest at
  ~5.4:1 as the spec predicted). Not run through a full automated audit — that's phase 10's job
  explicitly ("Contrast audit: every theme x mode"). Re-verify there before shipping.
Follow-ups:
- Phase 10 QA pass should re-verify contrast for zoro/luffy/news with a proper tool, not hand
  arithmetic.
- Phases 2/3/5/6/7, when writing new CSS for rail 3, the layout shell, and the rebuilt About/
  Stack/Work sections, should consume `--border-width`/`--radius`/`--shadow`/
  `--font-weight-display`/`--tracking-display` directly rather than hardcoding values — that's
  what makes brutal mode visibly affect those sections once built.
Verified: all 16 combinations checked live in a running dev server (attribute swaps via
devtools, not just reading the CSS) — `--accent`/`--accent-solid` resolve correctly for all 4
themes x 2 modes, brutal override composes on top without disturbing the palette, whole page
re-colors (hero heading, buttons, ticker band, contribution graph, clock separators) with zero
component changes. No console errors. Production build (`next build`) and `eslint` both clean.

---

## Phase 2 — Layout shell
Status: not started

## Phase 3 — Rail 3 contents
Status: not started

## Phase 4 — Custom cursor
Status: not started

## Phase 5 — About section
Status: not started

## Phase 6 — Stack section
Status: not started

## Phase 7 — Work feed (middle column)
Status: not started

## Phase 8 — Header and nav
Status: DEFERRED — do not implement without an explicit go-ahead (see spec section 10).

## Phase 9 — Commit-graph game
Status: not started (blocked on open decision 4 below)

## Phase 10 — QA pass
Status: not started

---

## Open decisions

Unanswered as of phase 1 (spec section 13) — resolve before the phase that needs them.

1. **Feed scope (phase 7).** Projects only, or a unified feed of projects + blog + weekly +
   gallery? Unified changes the nav, which is protected. **Default if not reopened: projects
   only.**
2. **Rail width (phase 2).** 240px rails (~800px middle on a 1280 laptop) vs 300px rails
   (~680px middle, tighter 3-column feed).
3. **Opinion lines (phase 6).** Worth writing ten of them, or skip?
4. **The game (phase 9).** Adding a play control to the protected contribution graph — approve,
   or drop the game?
