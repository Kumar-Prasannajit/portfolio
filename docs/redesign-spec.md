# kumarp.in — three-pane redesign

Implementation spec. Work through it **phase by phase in a single branch** cut from `main`.
Each phase is one commit, builds green, and leaves the site usable. Do not start a phase
before the previous one is committed. Do not create a branch per phase.

```bash
git checkout main && git pull
git checkout -b redesign-three-pane
```

---

## 0. How to run this

**This file lives in the repo**, at `docs/redesign-spec.md`, committed to the branch as the first
commit. Do not paste it into chat each time — it is long, it would eat context that the actual
work needs, and a file survives session ends and compaction while a pasted message does not.

**One session per phase.** Do not attempt several phases in one sitting. A long session drifts:
by phase 7 the motion budget and the protected zones will have fallen out of context, and that is
exactly how a disciplined redesign turns into a demo reel. Start each phase fresh with:

```
Read docs/redesign-spec.md and docs/PROGRESS.md.
Implement phase <N> only. Do not start any other phase.
When it builds clean, update PROGRESS.md and commit both together.
```

**`docs/PROGRESS.md` is the state of the build.** Create it in phase 1 and treat these as rules:

- **Read it before touching anything.** It says which phases are done, which decisions have been
  answered, and what was deviated from or deferred.
- **Update it in the same commit as the phase work**, never in a separate commit — a progress file
  that lags the code is worse than none.
- **Never mark a phase done that does not build**, and never mark one partially done. If a phase
  cannot be finished, record what landed, what did not, and why, and leave the phase open.
- **Record every answered open decision there** (section 13), so later phases stop re-asking.

Format, one block per phase:

```markdown
## Phase 3 — Rail 3 contents
Status: done            <!-- not started | in progress | done | blocked -->
Commit: a1b2c3d
Decisions: rail width 260px; AniList list is public, no auth needed
Deviated: accordion is 180px expanded, not 200px — 200 overflowed at 768px height
Follow-ups: ASCII frames are 140KB, consider trimming the frame count
```

**Stop at the end of every phase.** Do not roll into the next one, even if it looks small. The
point of phasing is that each commit is reviewable on its own and the site is never left broken.

---

## 1. Context

Next.js + Tailwind portfolio, deployed at kumarp.in. Theming already uses shadcn-style CSS
custom properties (`--background`, `--foreground`, `--accent`). Inter for UI, a monospace
face for data. Current palette is red / white / black, neubrutalist-leaning.

The page is already a three-pane layout:

| Pane | Role | State |
|---|---|---|
| Rail 1 (left) | Fixed. Photo, local time, date, view count. | Built — leave alone |
| Middle | The only scrolling column. All content lives here. | Needs redesign |
| Rail 3 (right) | Currently an auto-scrolling project wall. | Replace entirely |

**The goal is not "add animations."** The site currently reads as a stack of blocks with equal
weight inside a terminal frame. The redesign makes it read as one instrument panel: every
section either shows real state or is evidence of work, and the three panes read as one grid
rather than three columns.

---

## 2. Non-negotiable rules

Read these before every phase. They are the difference between this looking designed and
looking like a demo reel.

**Motion budget — exactly two reusable effects, used everywhere:**

1. **Masked line rise.** Text splits into lines, each line rises out of an `overflow:hidden`
   wrapper, staggered. Use GSAP `SplitText.create(el, { type: 'lines', mask: 'lines' })`.
2. **Scramble-settle.** Any live or computed value cycles random characters briefly, then
   lands on its real value.

Three named exceptions exist and nothing else may be added: the Stack FLIP re-rank (phase 6),
the theme accordion (phase 3), and the cursor (phase 4). No parallax, no pinned sections, no
section-specific one-off effects.

**Horizontal crossbars.** The dividing bands run across all three panes at the same
y-position, as one continuous rule. Cell boundaries inside the rails snap to them. This is the
single most important visual decision in the redesign — if a rail's internal divider sits 12px
off the band, the whole thing falls apart.

**Token discipline.** Every colour, border-width, radius and shadow comes from a CSS variable.
There must be **zero** style rules targeting a specific theme+mode combination. If a rule needs
to know it is "zoro in brutal mode", the architecture is wrong — fix the tokens instead.

**Accessibility floor.** Body text is a neutral token in every theme, never the accent colour.
All motion is disabled or reduced under `prefers-reduced-motion`. Interactive elements are real
buttons/inputs, not divs with click handlers.

**When editing files where JSX nesting could break, output the complete replacement block for
the component rather than a partial diff.**

**Protected — do not modify.** These are already designed and signed off. Do not restructure,
restyle, rewrite the copy of, or otherwise "improve" them in any phase:

- **Rail 1, the left pane** — photo, local time, date, view count. Layout, contents and copy final.
- **The middle column from the header down to and including the GitHub contribution graph** —
  logo, tagline, nav, ⌘K, mode toggle, both ticker strips, and the contributions block. Order,
  contents and copy final.
- **Nav items** — About, Stack, Experience, Work, Contact. Do not add, rename, reorder or remove.

One unavoidable exception: theme tokens from phase 1 apply site-wide, so these areas will
re-colour with the active palette and pick up brutal mode's border, radius and shadow values.
That is the point of the theme system — exempting them would leave visibly unthemed islands in
the layout. Their structure, layout, content and copy stay exactly as they are.

---

## 3. Phase 1 — Token architecture and theme system

Everything downstream consumes this, so it ships first. This phase also **creates
`docs/PROGRESS.md`** per section 0, with a block for all ten phases and the four open decisions
listed unanswered.

Three independent axes on the `<html>` element:

```html
<html data-theme="shanks" data-mode="dark" data-ui="default">
```

- `data-theme` — `zoro` | `luffy` | `news` | `shanks`
- `data-mode` — `light` | `dark`
- `data-ui` — `default` | `brutal`

**Palettes.** Each defines the same variable names and nothing else. The character colour is an
**accent only** — borders, active states, index numbers, hover, the focus ring. Never body text,
never a large fill behind text. This is what keeps all eight combinations readable without
hand-tuning each one.

| Theme | Accent | Notes |
|---|---|---|
| `shanks` | red | **Default.** Current site palette. |
| `zoro` | green | |
| `luffy` | orange | Most likely to fail contrast — accent only, verify against both modes. |
| `news` | none / near-black | Pure black-and-white, accent is the foreground itself. |

**Brutal mode** overrides only four things and must be roughly fifteen lines of CSS:
`--border-width` (1px → 3px), `--radius` (→ 0), `--shadow` (soft → hard offset, no blur),
`--font-weight-display` (→ heavier, tighter tracking). It composes with all four palettes for
free. Structure and layout do not change.

**No-flash requirement.** Read the saved theme from `localStorage` in an inline script in
`<head>`, before first paint. A flash of the default palette on every load is the most common
bug in theme switchers and it will be treated as a phase failure.

Palette changes crossfade over ~200ms. The brutal toggle snaps with no transition — the hard
cut is intentional.

**Acceptance:** all 16 combinations render without a single combination-specific style rule;
no flash on reload; body text passes AA in all of them.

---

## 4. Phase 2 — Layout shell

Restructure the three-pane grid. No new content yet.

- Rails 1 and 3 are both **fixed** (non-scrolling). The middle is the only scroll container.
- Crossbars align across all three panes per the rule above.
- Rail 3's internal order, top to bottom: **ASCII block (largest) → Stats → theme accordion →
  BRUTAL button**. The ASCII block sits opposite rail 1's photo so the two rails mirror each
  other: a visual block on top, data below.
- Rail 3 cannot scroll, so everything must fit the viewport at 768px height. Every Stats row
  gets a **fixed height** — live values change length and must not shove the layout.

**Mobile (< 1024px):** rails collapse. Rail 1's contents become a compact top strip; rail 3's
controls (theme accordion, brutal) become a bottom bar; the ASCII block and Stats are dropped
or moved inline. The middle becomes the full screen.

**Acceptance:** crossbars align pixel-exactly across all three panes at every breakpoint ≥1024px;
rail 3 fits at 768px height with no clipping; mobile has no horizontal scroll.

---

## 5. Phase 3 — Rail 3 contents

**ASCII block.** Abstract animated pattern — flow field, dithered noise, something ambient. Not
a portrait: rail 1 already has the photograph and it should stay the only one. Pre-generate the
frames at build time and cycle them; do not convert an image to ASCII in the browser every tick.
Monospace, single colour from the accent token, so it re-colours with the theme for free.

**Stats block.** Fixed-height text rows, no images:

- `WATCHING` — currently-watching anime from the **AniList public GraphQL API** (no auth needed
  for a public list). Title and `EP 07 / 12`. No cover art — there is no room.
- `LAST COMMIT` — repo name plus relative time, from the GitHub API.
- `UPTIME` — days since last deploy, plus build status.

Values arrive with scramble-settle. Cache API responses; the page must render with placeholder
rows if a request fails, never with a layout hole.

**Theme accordion.** Four panels, stacked **vertically** — the rail is tall and narrow, and an
accordion should open along its container's long axis. Active panel expands to ~200px at full
rail width; the other three collapse to ~48px bands. Nothing ever disappears.

- Each panel is an **abstract ASCII or dithered texture** in its theme's colour. **Do not use
  Zoro or Luffy character artwork** — it is someone else's IP on a public site, and four pieces
  of anime art inside a monospace brutalist UI would look pasted on. The names carry the
  reference; the textures carry the colour.
- Labels are **rotated 90°**, not stacked letter-by-letter. Collapsed is the default state for
  three of four panels, so the collapsed label is what gets read most.
- Animate `grid-template-rows` on the parent, not the heights of four children — keeps the
  panels perfectly complementary with no sub-pixel gaps. ~400ms, one ease.
- **Hover previews** the theme across the entire site; **click commits** it; leaving without
  clicking restores the previous theme.
- Real radio inputs so arrow keys work.

**BRUTAL button** sits below the accordion and toggles `data-ui`.

**Acceptance:** accordion is keyboard-operable; hover preview restores correctly on leave;
Stats rows never shift the layout when values change; rail re-colours across all four themes
with no per-theme code.

---

## 6. Phase 4 — Custom cursor

Keep the block shape. Change the behaviour.

- **`mix-blend-mode: difference`.** The cursor inverts whatever is beneath it, so it is always
  visible over screenshots, over the red contact block, and in all 16 theme combinations with
  zero per-theme work. Replaces the current solid fill, which disappears on dark imagery.
- **Blink only when idle.** Still while moving; starts blinking after ~2s stationary, exactly
  like a real caret. The current always-on blink is visual noise and trips flashing-content
  guidance.
- **Snap to a character grid.** Move in discrete steps aligned to the monospace grid (one `ch`,
  or 8px). A caret steps; it does not glide. If precision on links suffers in testing, halve the
  step — do not remove the behaviour.
- **State vocabulary, and nothing beyond it:** thin caret over text, slightly larger over
  anything clickable, tinted to the theme colour while hovering the accordion panels (so the
  cursor itself previews the palette), quick shrink on mousedown.
- No trail, no particles, no lag-follow.

**Hygiene:** disabled entirely on touch devices; native cursor restored over text inputs;
positioned by `transform` inside a rAF loop, never `top`/`left`; `pointer-events: none`;
blinking off under `prefers-reduced-motion`.

---

## 7. Phase 5 — About section

- **Delete the `whoami.sh` card.** It repeats rail 1 and the adjacent paragraph, and rail 3 now
  owns all live status. About becomes a **single wide column** — the middle is only ~680px and
  two columns in there was always cramped.
- **Cut to two short paragraphs.** Remove "turning coffee into commits" and any other filler.
  Job-description phrasing ("built reusable React components") goes; write it in his voice.
- **Data-bound prose.** A few words in the copy are live variables rather than hardcoded text —
  role, company, city, and a final line referencing what he is currently watching. On scroll the
  lines rise via the masked reveal, and the variable words land with scramble-settle. That is the
  entire animation budget for this section.

---

## 8. Phase 6 — Stack section

- **Compute the stack from project data.** Same source that renders the project cards, aggregated:
  each tool shows how many projects shipped with it and when it was last used
  (`React · 4 projects · last used 2d ago`). Never a hand-typed list, never a self-rated percentage.
- **Rank by weight, drop the categories.** Remove "Languages & Frontend / Backend & APIs / Data &
  Infra / Tooling & Payments". Heavily-used tools render larger, the rest smaller.
- **Cut to roughly ten tools.** Git and Postman come off — listing Git is like listing email, and
  it drags down Redis and Docker beside it.
- **Signature animation: the section ranks itself.** Tools enter as a flat, equal-weight row, then
  FLIP into their real sizes and order as the section comes into view. Once, on entry. Counts
  scramble-settle as they land.
- **A "learning now" row**, visually separate, marked with a slow pulse dot.
- **Clicking a tool filters the feed below it** (phase 7). This is the reason the section exists —
  it is the index for the work, not a list of claims.
- Optional: one short opinionated line per daily driver, on hover.
- **The GitHub contribution graph stays where it is**, above About. It is protected — do not
  move it into this section.

---

## 9. Phase 7 — Work feed (middle column)

Replace the current "Selected Projects" card list with an editorial grid in the style of the
supplied reference (asymmetric masonry, condensed uppercase headlines, date and tag chips, mixed
card sizes).

- **Three columns**, designed natively for the middle's width — do not port a four-column layout
  into ~680px.
- **Mixed card sizes** drive the rhythm. Vary frame treatment — solid accent fill, outlined,
  inverted — rather than introducing new hues. The reference's orange/green/pink frames do not
  belong in this palette.
- **Duotone the project screenshots into the accent colour.** Raw screenshots of four different
  sites bring four clashing colour schemes and will make the grid look like a link dump.
- **Tag filter row across the top with counts**, driven by the same data as the Stack section and
  filtering the grid live.
- Build the feed to accept **mixed content types** (project / blog / weekly / gallery) even if it
  ships with projects only — see open decisions.

---

## 10. Phase 8 — Header and nav — **DEFERRED, do not implement**

The header is protected. This phase is recorded only so the ideas are not lost, and must not be
built without an explicit go-ahead:

- Merging the two ticker strips into one live telemetry line (last commit age, current episode,
  contribution count, build status) with a couple of the existing quips kept in rotation.
- A contextual pane title that rewrites as you scroll (`~/kumar/about.md` → `stack.json` →
  `work/`), which would need somewhere in the header to live.
- Nav items reflecting scroll position with an active state.

Skip straight from phase 7 to phase 9.

---

## 11. Phase 9 — Commit-graph game

Snake, played on the real GitHub contribution grid, eating commits. The squares light in the
accent colour as the snake passes.

**The graph is inside the protected zone, so this phase needs a decision before it starts**
(see open decisions). It is additive — the graph keeps its position, appearance and data, and
gains a play control — but it does put a new affordance in protected territory. Do not begin
without a go-ahead.

- Explicit `▶ PLAY` affordance, styled like the existing `AUTO` button. **Never autostarts.**
- Idle state is the graph exactly as it looks today. Nothing about it changes until play is
  pressed, and pressing escape or clicking away restores it.
- **Does not capture arrow keys unless the game has focus** — breaking page scroll is the classic
  failure mode here.
- High score in `localStorage`.
- On mobile: swipe controls, or hide it entirely rather than shipping a cramped version.
- Original shapes and palette only. No sprites or art derived from any existing series.

---

## 12. Phase 10 — QA pass

- Contrast audit: every theme × mode, body text and accent, AA minimum.
- `prefers-reduced-motion`: masked reveals become instant, scramble-settle resolves immediately,
  cursor stops blinking, ASCII animation freezes.
- Keyboard-only pass over the accordion, nav, filters and game.
- Mobile at 375px and 768px: no horizontal scroll, rails collapsed correctly.
- Lighthouse: confirm the ASCII loop and cursor rAF are not burning main-thread time when idle.

---

## 13. Open decisions

Resolve before the phase that needs them; do not guess silently.

1. **Feed scope (phase 7).** Projects only, or a unified feed of projects + blog + weekly +
   gallery? Unified is what makes the reference layout work — three projects will leave that grid
   looking sparse — but it turns Blogs and Weekly from separate pages into filters on one page,
   **which means changing the nav, and the nav is protected.** Projects-only unless that is
   explicitly reopened.
2. **Rail width (phase 2).** Middle column width follows directly from it. 240px rails give the
   middle ~800px on a 1280 laptop; 300px rails leave ~680px and the three-column feed gets tight.
3. **Opinion lines (phase 6).** Worth writing ten of them, or skip?
4. **The game (phase 9).** Building it means adding a play control to the protected contribution
   graph. Approve, or drop the game?
