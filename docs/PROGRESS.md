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
Status: done
Commit: (pending — committed together with this file)
Decisions:
- **Rail width: 240px minimum** (open decision 2, resolved with the user). `--panel-w`'s clamp
  floor moved from 300px to 240px, giving the middle column ~800px on a 1280px laptop and
  ~527px at exactly 1024px (verified live) — tighter at the low end, which is the accepted
  trade-off of dropping the tabbed compromise below.
- **Dropped the 1024–1279px tabbed PROFILE/PROJECTS compromise entirely** (resolved with the
  user — not a listed open decision, but a scope call this phase forced: the spec only describes
  two states, ≥1024px three panes and <1024px stacked). Both rails are now `position: fixed` and
  visible at every width ≥1024px, no tab-switching, no per-panel scroller routing.
- **Rail 3 rebuilt as a fixed, non-scrolling shell — the auto-scrolling Projects loop is gone,**
  not deferred to phase 3. The spec's phase 2 acceptance line ("rail 3 cannot scroll... every
  Stats row gets a fixed height") only holds if the old drifting `Projects`/`ProjectCard` rail
  (its own Lenis instance, infinite loop-set cloning, hover/touch/focus pause logic) is removed
  now, so it was — `components/Projects.tsx` and `components/ProjectCard.tsx` deleted (fully
  orphaned once removed from the rail; `.proj-grid`/`.pcard*` CSS removed with them; `.card`
  itself stays — WorkSection.tsx still uses it), along with the `PROFILE`/`PROJECTS` tabs, the
  `▶ AUTO` / `❚❚ PAUSED` status pill, and `HomeShell`'s `rightClone` prop.
- **`components/RailThree.tsx`** is the new rail 3 content: a static, `aria-hidden` structural
  placeholder in phase 3's exact top-to-bottom order (ASCII block -> Stats -> theme accordion ->
  BRUTAL), fixed-height throughout (stats rows 56px, accordion panels 48px collapsed, BRUTAL
  52px, ASCII flexible/largest) so phase 3 can wire in real content — live data, the interactive
  accordion, the ambient animation — without touching this shell's sizing.
- **`lib/panelScroll.ts` collapsed to a single scroller.** With neither rail scrolling anymore,
  `scrollToSection()` no longer needs to pick between a "page" and "right" Lenis instance or
  handle a hidden-panel retry loop — it's a plain "find the element, scroll the one page
  scroller to it" now. `PANEL_MEDIA`/`PANEL_TAB_EVENT` exports removed (unused elsewhere).
- **Mobile (<1024px):** rail 1 collapses to a 96px compact top strip (the photo shrinks to a
  96px thumbnail beside the three stat tiles, laid out in a row instead of stacked) via
  shell-level CSS only — `IdentityPanel.tsx` itself is untouched, only how `globals.css`
  presents it at this width changes, consistent with how mobile already hid it entirely before
  this phase. Rail 3 collapses to a 56px fixed bottom bar showing only the phase-3 controls
  (theme accordion + BRUTAL); the ASCII block and Stats are dropped rather than squeezed inline,
  per the spec's explicit "dropped or moved inline" choice.
- Every new rule in this phase reads `--border-width`/`--radius` from the token layer rather than
  hardcoding values, per phase 1's follow-up note.
Deviated:
- **Rail 1's photo-bottom-edge and rail 3's ASCII-block-bottom-edge are not forced to a pixel-
  identical Y position.** Both are `flex: 1` (the one flexible block in an otherwise fixed-height
  column), so they behave analogously as viewport height changes and read as mirrored — but
  rail 3's exact Stats/accordion/BRUTAL heights are a phase-2 placeholder, not phase 3's final
  sizing, so exact-pixel mirroring wasn't attempted yet. The one crossbar that's guaranteed
  pixel-exact at every scroll position — the header line under the sticky nav, shared by
  `panel-head`'s synced height on both rails — was verified live and holds at every breakpoint
  tested.
- **Mobile viewport testing used the browser automation tool's own scaling** (reported
  `innerWidth` ~500px when the page was asked to resize to 375px) rather than a literal 375px
  viewport — the top-strip/bottom-bar structure and no-horizontal-scroll were confirmed at that
  effective width; phase 10's QA pass should re-check at literal 375px and 768px on a real device
  or an unscaled emulator.
Follow-ups:
- Phase 3 replaces every block inside `RailThree.tsx` with real content and should remove the
  component's outer `aria-hidden="true"` once there's something in it worth exposing to a screen
  reader.
- Phase 10: re-verify the mobile compact strip and bottom bar at literal 375px/768px (see
  Deviated above), and re-check crossbar alignment once phase 3's real accordion heights land.

## Phase 3 — Rail 3 contents
Status: done
Commit: (pending — committed together with this file)
Decisions:
- **Stats: one aggregated route, not three.** `app/api/rail-stats/route.ts` calls AniList
  (WATCHING) and GitHub (LAST COMMIT, UPTIME) in parallel and returns all three in one response —
  same discriminated-union-per-field shape as `now-playing`'s `NowPlayingResponse`, so one field
  failing (say AniList times out) never blanks the other two. `lib/useRailStats.ts` polls it every
  5 minutes (these values change a few times a day at most) and — unlike `useNowPlaying` — keeps
  the last good response on a failed poll instead of re-showing a placeholder over live data.
- **WATCHING needs `ANILIST_USERNAME`** (new env var, `.env.example` updated) — public GraphQL,
  no auth. Unset renders "not set up" (an honest, distinct state from "error"), never a layout
  hole, matching the `LASTFM_*` "unconfigured" precedent. **Not set in this session** — the row
  will show "not set up" until it's added to `.env.local` / Vercel.
- **UPTIME tracks the commit actually deployed, not just `main`'s HEAD.** Reads
  `VERCEL_GIT_COMMIT_SHA` (Vercel stamps it into the runtime env automatically) and falls back to
  `main` only when that's unset (local dev, non-Vercel hosting). `GITHUB_TOKEN` is optional —
  everything read is public, unauthenticated works fine at this traffic level, the token only
  raises the rate ceiling (60/hr -> 5000/hr).
- **ASCII frames are a checked-in static snapshot, not a build step.** `scripts/generate-ascii-
  frames.mjs` is run by hand (`node scripts/generate-ascii-frames.mjs`) and writes `lib/
  asciiFrames.ts` — the same pattern `lib/data.ts`'s `GH_COUNTS` already uses, and doing this
  keeps `next build` from paying a codegen cost for something that only needs regenerating when
  the pattern itself changes. 60 frames, 30x15 chars, a seeded 2-octave value-noise field sampled
  at a drifting offset per frame (a cheap plasma/dither "flow", not a real particle sim) mapped to
  a 10-character density ramp. Single colour (`--accent`) by construction — glyph choice carries
  the intensity, not colour — so it re-themes for free. `AsciiFlow.tsx` only swaps `textContent`
  on a 130ms interval; it never computes a frame client-side, and pauses entirely on
  `prefers-reduced-motion` and `document.hidden` (a background tab gains nothing from a running
  timer).
- **`ScrambleText.tsx` is the shared scramble-settle primitive**, not a one-off for Stats — the
  motion budget calls this out as one of exactly two reusable effects "used everywhere", so
  phases 5 and 6's live variables should import this component rather than reimplementing the
  effect. Structural characters (space, `·`, `/`, `:`, `-`) never scramble, only glyph positions
  do, so separators read as fixed while the value "resolves" around them.
- **Accordion sizing is exact, not `~`.** 200px expanded / 48px collapsed per the spec's own
  numbers, animated via `grid-template-rows` on the parent (`RailThree.tsx` computes the row
  string, `.rail3-accordion`'s `transition: grid-template-rows 400ms ease` animates it) — never
  the panels' own heights, so all four stay complementary with zero sub-pixel gap. **Verified live
  or against a computed 768px-height fit that it lands with exactly 0px of spare** at both nav-
  height brackets (`.rail3-brutal`'s bottom edge sits at exactly `y=768` in both the 1024-1459px
  width bracket, 61px nav-head, and the >=1460px bracket, 87px nav-head — checked via the Chrome
  DevTools MCP's `resize_page` + `evaluate_script`, not just arithmetic).
- **New root tokens: `--swatch-shanks/zoro/luffy/news`.** The accordion has to show all four
  characters' colours at once regardless of which theme is currently active, which no existing
  `data-theme`-gated token can do — these are deliberately flat (unconditional, mode-agnostic)
  identity swatches for the picker only, not a reintroduction of the "combination-specific rule"
  token discipline bans: nothing here needs to know `data-theme` AND `data-mode` together.
  Commented in `globals.css` as an explicit, narrow exception.
- **Textures are CSS gradients, not artwork or precomputed ASCII.** Two diagonal hatch patterns
  (shanks, zoro — opposite angles), a dot halftone (luffy), a vertical hatch (news), each tinted
  from that panel's own `--swatch-*`. Per spec: "do not use Zoro or Luffy character artwork."
- **Rotated labels use `writing-mode: vertical-rl` + `transform: rotate(180deg)`**, not a manual
  `rotate(90deg)` on a horizontal span — the standard cross-browser trick for bottom-to-top
  vertical text (wider support than `writing-mode: sideways-lr`). Sized against the 48px collapsed
  band: "SHANKS", the longest name, renders ~43px tall at 0.62rem/0.14em tracking, verified in the
  live screenshot below.
- **Keyboard IS the commit, not a third preview state.** Real radio inputs mean arrow keys move
  focus *and* the checked value natively, firing `onChange` -> `commit()` immediately — there's no
  keyboard-only "preview without committing" affordance, since hover-preview is inherently a mouse
  enhancement (no hover concept on a keyboard). Tabbing into the group (without pressing an arrow)
  focuses the already-checked radio and changes nothing, which is exactly correct. Verified live:
  focusing the `zoro` radio and pressing `ArrowDown` committed `luffy` immediately (`data-theme`,
  `localStorage`, and the expanded panel all updated in the same tick).
- **Mobile: tap-to-commit, no preview.** No hover on touch, so `<1024px` collapses the accordion to
  a flat, equal-width, un-rotated (`writing-mode: horizontal-tb`) 4-column row — the expand/
  collapse choreography is desktop-only. React's inline `gridTemplateRows` doesn't know about this
  breakpoint, so the mobile media query overrides it with `!important` (a CSS rule with `!important`
  does beat an element's own inline style without one).
- **BRUTAL is `aria-pressed`-driven**, not a second boolean prop threaded through — `[aria-
  pressed="true"]` swaps background/colour to the accent pair. Its "no transition" requirement
  (spec: "the brutal toggle snaps") was already satisfied for free by phase 1's transition rule,
  which only ever eases colour-ish properties, never border-width/radius/shadow — the axis this
  button doesn't touch anyway.
Deviated:
- **Rail 3's total fixed budget now lands with exactly 0px of spare at 768px height** (measured
  live, see Decisions above), not phase 2's placeholder headroom. There is no room left in rail 3's
  fixed budget for anything else without either shrinking an existing fixed value (Stats' 56px
  rows are the obvious lever) or accepting a scroll rail 3 isn't supposed to have — flagging this
  now so a later phase doesn't add a fourth Stats row or a taller accordion without revisiting it.
- **The ASCII block's rendered text can be marginally taller than its flex-allocated box** in the
  single tightest case (narrowest nav-height bracket stacked on the shortest budgeted viewport);
  `.rail3-ascii`'s `overflow: hidden` crops a row or two of ambient texture rather than breaking
  layout. Cosmetic only — not observed in the two brackets actually checked live.
- **Did not touch GSAP / the masked-line-rise effect.** Phase 3 only needed the other half of the
  motion budget (scramble-settle) plus the accordion's own named exception — masked line rise
  arrives with real prose in phase 5 About.
Follow-ups:
- Set `ANILIST_USERNAME` (and optionally `GITHUB_TOKEN`) in `.env.local` / Vercel — WATCHING shows
  "not set up" until then, by design, not a bug.
- Phase 10 QA pass should exercise `prefers-reduced-motion` live (ASCII freeze, scramble resolves
  instantly, accordion snaps with no transition) — the guards are in place in
  `AsciiFlow.tsx`/`ScrambleText.tsx`/`globals.css` and code-reviewed, but the Chrome DevTools MCP
  used for this session's live checks had no reduced-motion emulation switch, so this wasn't
  exercised in a real browser this session.
- Phase 10's contrast audit (already planned for zoro/luffy/news generally, see phase 1) should
  specifically include the accordion's collapsed rotated labels (`--ink-faint` on `--panel`) —
  new text phase 1's own contrast pass never saw.
- No screen-reader (VoiceOver/NVDA) pass yet on the accordion's `radiogroup` — verified
  structurally (real inputs, `aria-label`s, keyboard-operable) but not listened to.
- If rail width (`--panel-w`) is ever revisited past its phase-2 240px floor, re-check the
  accordion's collapsed-label fit — see Decisions above for the ~43px/48px margin it currently has.

## Phase 4 — Custom cursor
Status: done
Commit: (pending — committed together with this file)
Decisions:
- **Split into two nested elements.** `.custom-cursor` (outer, `wrapRef`) does nothing but position
  itself — `transform: translate()` only, updated from a single-shot rAF scheduled per
  `mousemove` (not a perpetual loop, so it costs nothing while the pointer is still — phase 10's
  Lighthouse check cares about exactly this). `.custom-cursor-shape` (inner, `shapeRef`) carries
  every visual state (size, tint, blink, morph) on its own `transition`, so the outer element's
  un-eased position updates can never fight a visual transition on the same property. Splitting
  was necessary, not stylistic: "positioned by transform... never top/left" plus "it steps, it
  does not glide" (no easing on position) can't coexist with "slightly larger over clickable"
  (an eased grow) on one shared `transform` property.
- **Grid-snap is a draw-time-only quantization, never touches hit-testing.** `snap()` rounds to
  the nearest 8px multiple purely for `wrap`'s `transform`; every selector check
  (`onOver`/`onOut`/`enterMorph`) still reads the real, unsnapped `event.clientX/Y`. Verified live
  (see below) that the block visibly steps in 8px increments while every hover/click target still
  resolves correctly.
- **Base shape: 4px x 20px, `mix-blend-mode: difference` on a plain white fill** — "thin caret
  over text" is the resting state, not a per-context toggle; the accent/`--ink` solid fill (and
  its always-on colour-cycle blink, shared with `.typewriter-cursor`) is gone entirely from the
  cursor. `.is-hovering` grows it to 20x20/3px-radius ("slightly larger... over anything
  clickable") — `label` was added to `HOVER_SELECTOR` for this, since the accordion's panels
  (RailThree.tsx) are `<label>`s wrapping a visually-hidden radio, not buttons/inputs themselves,
  and it's the only `<label>` anywhere in the codebase (checked: `Grep "<label" components/`).
- **Idle-blink, not colour-cycle.** A 2000ms `setTimeout` reset on every real `mousemove` adds
  `.is-idle` (a hard on/off `steps(1,end)` opacity cut, matching `.typewriter-cursor`'s own
  cut-not-fade convention) once the pointer's been still that long; any movement clears it
  immediately. Guarded against firing while `morphed` — a blink is a caret concept, and layering
  an opacity flash onto the nav's clip-path reveal would fight it rather than read as "idle".
- **Quick shrink on mousedown is a custom-property toggle, not a `transform` override.**
  `.is-pressed` only sets `--cursor-scale: 0.55` (consumed by the base rule's
  `scale(var(--cursor-scale))`); it never declares `transform` itself, so it composes for free
  with `.is-hovering`/`.is-tinted`'s own width/height/background, and `.is-morphed`'s explicit
  `transform: none` still wins outright over the base rule while a nav section is active — a
  press during morph can't desync the clip-path circle from the rect it's covering.
  Verified live: dispatching `mousedown` flips `--cursor-scale` to `.55` synchronously (read via
  `getComputedStyle` after a forced `offsetWidth` reflow); `mouseup` reverts it and drops the class.
- **Accordion tint is a literal colour preview, not another diff-blend state.** Spec: "tinted to
  the theme colour... so the cursor itself previews the palette" — hovering a
  `.rail3-accordion-panel[data-swatch]` sets `--cursor-tint: var(--swatch-<theme>)` and adds
  `.is-tinted`, which switches `mix-blend-mode` back to `normal` so the swatch renders as its true
  colour instead of an inversion. Verified live: hovering the SHANKS panel resolved the shape's
  background to `rgb(232, 64, 74)` (`--swatch-shanks: #e8404a`) with `mix-blend-mode: normal`.
- **Hygiene — native caret over text fields.** `TEXT_SELECTOR` (any real text `input`/`textarea`/
  `[contenteditable]`, explicitly excluding the accordion's own radio) both hides the fake cursor
  (`wrap.classList.add("is-hidden")`) and restores `cursor: text` via a CSS rule with higher
  specificity than the blanket `cursor: none` (an element selector beats `*`, no `!important`
  needed). An `overTextInput` flag stops the belt-and-suspenders "any mousemove reveals the
  cursor" logic (needed for the Chromium-hover-sync-event case, see the comment in
  CustomCursor.tsx) from immediately un-hiding it again on the very next pixel of movement inside
  the field. Verified live via a dispatched `mouseover` on the blog's search input (`/blog`) —
  real `hover` motion from the browser-automation tool used for the rest of this phase's live
  checks turned out not to dispatch a genuine `mouseover` DOM event, only a visual pointer move,
  so this one state needed a dispatched event to observe; every other state above was confirmed
  from real tool-driven hovers.
- **Nav morph (the pre-existing `enterMorph`/`exitMorph` mechanic) kept its exact geometry, only
  its positioning primitive changed** — `wrap.style.transform = translate(rect.left, rect.top)`
  instead of `dot.style.left/top`, `shape` (not the removed single `dot`) gets the inline
  width/height/`--morph-x/-y/-r`. Verified live: dispatching `mouseover` on the logo nav cell
  translated the wrapper to the cell's exact rect origin, sized the shape to its exact
  width/height, set a real `--morph-r`, and added `cursor-invert-target` to the link; a follow-up
  `mouseout` cleared all four cleanly. The light-mode overrides that switch the morphed box off
  entirely (`:root:not([data-mode="dark"])`/`:root[data-mode="light"] .custom-cursor.is-morphed`)
  were renamed to target `.custom-cursor-shape.is-morphed` alongside this move.
- **Label state (`data-cursor`, the project-card "View →" tag) now sets `mix-blend-mode: normal`
  explicitly** — it didn't need to before (the base cursor had no blend mode at all pre-phase-4),
  but now that the base is diff-blended, the tag would otherwise invert instead of rendering its
  true accent colour.
- **Cursor shape's own `border-radius` stays a hardcoded 1px/3px/0, not `var(--radius)`.** The
  token-discipline rule governs themed UI chrome (cards, buttons — brutal mode's 12px→0 sweep);
  the cursor is one of the spec's three named motion-budget exceptions and its shape was already
  hardcoded pre-redesign (2px/3px/0, never tokenized) — this isn't a new deviation, just carried
  forward.
Deviated:
- **Grid step shipped at the spec's own literal 8px, not halved.** The spec's own fallback
  ("if precision on links suffers in testing, halve the step") assumes real-user testing this
  session's browser-automation tool couldn't do reliably (see the Decisions note above about
  `hover` not dispatching real events) — but since snapping only quantizes the *drawn* position
  and never the real hit-tested pointer, there is no click-precision regression to find; the only
  open question is whether 8px reads as too laggy visually at small link targets. Flagging for a
  real-device pass in phase 10 rather than guessing a smaller step now.
Follow-ups:
- Phase 10 QA pass should watch the grid-snap follow motion on a real trackpad/mouse (not the
  automation tool) specifically over the nav links and the rail-3 accordion's narrow collapsed
  bands, and halve `GRID_STEP` in CustomCursor.tsx if it reads as imprecise there.
- No VoiceOver/NVDA-relevant change here (the whole cursor is `aria-hidden`/decorative and bails
  out under touch or reduced motion already) — nothing new to re-check in phase 10 beyond the
  existing reduced-motion bail-out, which this phase didn't touch.

## Phase 5 — About section
Status: done
Commit: (pending — committed together with this file)
Decisions:
- **`whoami.sh` card deleted; About is one wide column of two paragraphs.** `TERM_ROWS` (its only
  consumer) removed from `lib/data.ts`; `.about-grid`, `.term-row*` CSS removed. `.term-card`/
  `.term-head`/`.term-body` stay — `TermWindow` and `HomeShell`'s panel heads still use them.
- **GSAP added as a dependency (`gsap@^3.15`).** The spec names `SplitText.create(el, { type:
  'lines', mask: 'lines' })`, and GSAP wasn't actually installed (a stale comment in `TaglineCycler`
  and `lib/motion.ts`'s "don't mix in a second animation library" note both pre-date this). SplitText
  is free in 3.13+. Only About uses it so far; Reveal/motion elsewhere is unchanged.
- **Reveal is armed like `Reveal.tsx`:** copy is visible in server HTML/no-JS; after mount, only if
  it starts below the fold (and not reduced-motion) are lines hidden (`yPercent: 110` inside the
  SplitText mask) and risen once when 20% of the block is in view (`power4.out`, stagger from
  `STAGGER`). `split.revert()` after the tween restores the original DOM; `autoSplit` re-splits on
  resize/font swap without re-hiding an already-revealed block. Waits on `document.fonts.ready`.
- **Live variables** (`.about-var`): role, company, city from `EXPERIENCE[0]` (company strips
  "Pvt. Ltd."; city is the first comma segment of `location`), and the closing line from AniList via
  the rail-3 stats feed (title + `EP n / total`). Rendered in mono so scrambling glyphs can't change
  width; `nowrap` + SplitText's `ignore` so a line break never slices one; an sr-only copy carries
  the real value because the scrambling glyphs are `aria-hidden`. Accent is only the dashed
  underline; text is `--ink`.
- **`ScrambleText` gained `active` (default true)** to hold the scramble until the reveal fires.
- **`useRailStats` is now a shared store** (`useSyncExternalStore`, ref-counted 5-min poll) so About
  and rail 3 share one request. Behaviour for rail 3 is unchanged.
- **The watching line is frozen to the first response** (fallback if none within 2.5s): SplitText
  moves nodes, so React must not restructure a split paragraph later. Rail 3 keeps updating live.
  When WATCHING isn't `ok` (unset/none/error) the line is a static "DSA problems in JavaScript"
  sentence — no invented content, no layout hole.
- **Copy is new and in first person; please review it.** Facts come only from existing site data
  (roles, three apps, five-person Git workflow, ECE at GIET). "I got here sideways" is my inference
  from the degree, not something the site said — cut it if it's wrong.
Deviated:
- GSAP `power4.out` stands in for `EASE.out` (`[0.22,1,0.36,1]`); GSAP has no cubic-bezier without
  the CustomEase plugin.
Follow-ups:
- Set `ANILIST_USERNAME` to exercise the live watching line; it was verified only on the fallback
  path this session (no username configured).
- Phase 10: reduced-motion (reveal skipped, scramble instant) is code-reviewed, not exercised in a
  browser; screen-reader pass on the sr-only variable copy not done.

## Phase 6 — Stack section
Status: done
Commit: (pending — committed together with this file)
Decisions:
- **Computed, not typed.** `lib/stack.ts#computeStack` aggregates `PROJECTS[].tags` (the data the
  Work cards render) into `{ name, count, lastUsed, weight }`, top 10. `STACK_GROUPS` and its
  categories deleted. `/specs` keeps its own `.stack-group`/`.pill` CSS (it never used the data).
- **Ranking = project count, then position in a project's own tag list (primary tools first), then
  project order.** Recency is display-only. My first cut ranked by recency and silently sank every
  Manima-only tool (Node.js, Express, MongoDB) because Manima has no date — for a backend-leaning
  profile that was the wrong result, so recency no longer affects rank. Result today: React (2),
  then Next.js, HTML, Node.js, CSS, Express, TypeScript, JavaScript, MongoDB, Tailwind CSS.
  Cut by the size limit: JWT, Razorpay, Particle.js, Lenis, Swiper.js. Git/Postman are gone
  simply because they aren't project tags.
- **"Last used" from GitHub** (answered with the user): `components/Stack.tsx` (server) reads
  `pushed_at` for each project's Source-link repo, `revalidate: 3600`, optional `GITHUB_TOKEN`. A
  tool's last-used is the newest date among its projects; if none known the segment is omitted.
  `Project.lastWorked` (new, optional) overrides it. `pushed_at` is a proxy — any push bumps it,
  not just work that used the tool.
- **The ranking animation:** server HTML is the finished ranked state. After mount, if the board
  starts below the fold (and not reduced-motion), it swaps to a flat equal-weight row in an
  unrelated (alphabetical) order, then GSAP Flip re-ranks it once on entry (`power4.out`, 0.9s,
  0.05s stagger); counts scramble-settle via `ScrambleText active`. Weight drives size through one
  CSS var (`--w`, forced to 0 while flat).
- **Relative time is client-only** (`useSyncExternalStore` mounted flag) — the page is prerendered,
  so "2mo ago" in the HTML would mismatch on hydration.
- **Filter store `lib/useStackFilter.ts`** (in-memory, `useSyncExternalStore`). Tools are real
  `<button aria-pressed>`s. The current Work cards moved into a client `WorkGrid` that filters by
  tag and shows "Showing n of m · show all". This is deliberately minimal so the control isn't
  dead before phase 7; phase 7 replaces the grid and keeps the hook.
- **Learning-now row** is driven by `LEARNING_NOW` in `lib/data.ts`, pulse dot 2.8s (off under
  reduced motion). It is **empty, so the row is hidden** — the user said they'd name the tools but
  hadn't yet. Nothing invented.
- **Opinion lines (open decision 3): skipped** — optional in the spec and unanswered; not written.
- CSS consumes `--border-width`/`--radius`/display-font tokens; accent is border/selection only
  (selected tool uses the `--accent-solid`/`--accent-ink` pair, like BRUTAL).
Deviated:
- The spec's "React · 4 projects" shape can't reach that scale: there are only 3 projects, so
  counts are 1–2 and only React reads as "heavy". Sizes will differentiate more as projects are added.
Follow-ups:
- TODO(content): fill `LEARNING_NOW`; set `lastWorked` on Manima (private repo).
- Phase 7 owns the real feed; keep `useStackFilter` and the `tags` matching.
- Phase 10: reduced-motion path (no flat row, counts instant) and keyboard pass over the tool
  buttons are code-reviewed, not exercised in a browser.

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
2. ~~**Rail width (phase 2).**~~ **Answered in phase 2: 240px minimum.** See that phase's
   Decisions above.
3. **Opinion lines (phase 6).** Worth writing ten of them, or skip?
4. **The game (phase 9).** Adding a play control to the protected contribution graph — approve,
   or drop the game?
