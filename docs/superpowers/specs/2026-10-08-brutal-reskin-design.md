# Brutal mode = a re-skin of the three-pane UI (design spec)

Date: 2026-10-08 · Branch: `feat/brutal-reskin` (from `redesign-three-pane`) · Supersedes `2026-09-29-brutal-redblack-swap-design.md`

## Goal

The BRUTAL button (rail 3, `components/RailThree.tsx`) re-skins the **current** three-pane page with the neubrutalist look of the `redblack` branch. Same DOM, same components, same three panes, same rail 3 sections, same text. Only CSS differs (plus one transient data attribute that keeps the toggle a hard cut). It stays a toggle: click again and the normal site is back.

## What stays

- `lib/useUiMode.ts` flips `<html data-ui="brutal">`, persisted in `localStorage["kps-ui"]`, restored before first paint by the inline script in `app/layout.tsx`.
- Three theme axes (`app/globals.css` header): `data-theme` (zoro | luffy | news | shanks), `data-mode` (light | dark), `data-ui` (default | brutal). Switching theme or mode while brutal is on recolours live.
- Normal mode (`data-ui` unset or `default`) is pixel-identical to before: every new rule is scoped under `:root[data-ui="brutal"]`.

## Colour model (tokens only)

Primary is the character accent as a bright tint; secondary is black.

| token | where | value |
|---|---|---|
| `--primary` | per `data-theme` only | shanks `#ff5757`, zoro `#3ecf6e`, luffy `#f2871f`, news `#c4c4c4` (each >= 4.5:1 against black) |
| neutrals (`--bg`, `--panel`, `--panel-2`, `--accent*`, `--heat-*`) | per `data-mode` only | **dark**: page and panels are `--primary`; emphasis blocks are black with `--primary` text. **light**: page is white; emphasis blocks are `--primary` with black text |
| ink, lines, hard shadows | both modes | black. `--border`, `--border-2`, `--line-strong` all resolve to `--line` |

The existing accent contract is reused rather than replaced: `--accent-solid` is a surface that carries `--accent-ink` text, so buttons, bands, chips and the marquee work in both modes with no per-mode component rules. `--accent` (accent as text or mark on the page) is black in brutal, because the tint cannot be read as text on white. Where the accent used to colour a word, brutal draws it as a solid `--accent-solid` chip instead.

No rule targets a specific theme x mode pair. Themes only change `--primary`; modes only change the neutral block.

## Geometry (ported from redblack)

`--border-width` 3px, `--bw-thin` 2px, `--bw-thick` 4px; offsets `--off-sm` 3px / `--off` 5px / `--off-lg` 8px / `--off-xl` 12px (smaller on phones); radius 0; shadow blur always 0, `--shadow` / `--shadow-sm` / `--shadow-lg`.

Component treatment, all reading the tokens above: solid nav with a thick bottom rule; active nav link as a solid block; icon cells and buttons that fill on hover and translate into their shadow on `:active`; underlined section headings; cards with hard shadows that lift on hover; marquee and contact bands as emphasis blocks; square cursor.

## Toggle behaviour

The file crossfades palette changes (~200ms) but brutal must hard-cut. Because brutal now changes colours, `useUiMode` stamps `data-ui-cut` on `<html>` for the frame of the flip and CSS disables transitions while it is present. Reduced-motion behaviour is unchanged.

## Rail 3 height budget

Rows are fixed-height and `box-sizing: border-box`, so thicker borders do not grow them. The nav grows by a few pixels (thicker rules); the ASCII block absorbs it. Checked at 1440x768 in the verification pass.
