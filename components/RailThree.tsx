"use client";

// Rail 3's real content (docs/redesign-spec.md phase 3). Fixed top-to-bottom
// order, mirroring rail 1: ASCII block (largest, ambient) -> Stats (live
// data, scramble-settle) -> theme accordion (hover-preview / click-commit,
// one of the spec's three named motion exceptions) -> BRUTAL button.
//
// No longer aria-hidden as a whole (phase 2's placeholder was, since it had
// nothing worth exposing) — the accordion is a real radio group and the
// Stats rows carry a spoken aria-label each; the ASCII block stays
// decorative-only via AsciiFlow's own aria-hidden.

import { useState } from "react";
import AsciiFlow from "./AsciiFlow";
import ScrambleText from "./ScrambleText";
import { daysSince, formatRelativeTime } from "@/lib/format";
import {
  CHARACTER_THEMES,
  useCharacterTheme,
  type CharacterTheme,
} from "@/lib/useCharacterTheme";
import { useRailStats } from "@/lib/useRailStats";
import { useUiMode } from "@/lib/useUiMode";

const THEME_LABELS: Record<CharacterTheme, string> = {
  shanks: "SHANKS",
  zoro: "ZORO",
  luffy: "LUFFY",
  news: "SANJI",
};

// Spec: "active panel expands to ~200px at full rail width; the other three
// collapse to ~48px bands." Exact px, not fr/flex, so docs/PROGRESS.md's
// phase-2 fit check (everything must fit a 768px-tall viewport with no
// scroll) stays a fixed, checkable number rather than drifting with content.
const ACCORDION_EXPANDED = "200px";
const ACCORDION_COLLAPSED = "48px";

function StatRow({
  label,
  value,
  spoken,
}: {
  label: string;
  value: string;
  spoken: string;
}) {
  return (
    <div className="rail3-stat" aria-label={`${label}: ${spoken}`}>
      <span className="rail3-stat-label mono" aria-hidden="true">
        {label}
      </span>
      <ScrambleText value={value} className="rail3-stat-value mono" />
    </div>
  );
}

function Stats() {
  const stats = useRailStats();

  const watching = stats?.watching;
  let watchingValue = "···";
  let watchingSpoken = "loading";
  if (watching) {
    switch (watching.status) {
      case "unconfigured":
        watchingValue = "not set up";
        watchingSpoken = "AniList account not configured";
        break;
      case "none":
        watchingValue = "nothing right now";
        watchingSpoken = "not currently watching anything";
        break;
      case "error":
        watchingValue = "—";
        watchingSpoken = "unavailable";
        break;
      case "ok": {
        const epNow = String(watching.progress).padStart(2, "0");
        const epTotal = watching.episodes != null ? String(watching.episodes) : "?";
        watchingValue = `${watching.title} · EP ${epNow} / ${epTotal}`;
        watchingSpoken = `${watching.title}, episode ${watching.progress} of ${epTotal}`;
        break;
      }
    }
  }

  const lastCommit = stats?.lastCommit;
  let commitValue = "···";
  let commitSpoken = "loading";
  if (lastCommit) {
    if (lastCommit.status === "error") {
      commitValue = "—";
      commitSpoken = "unavailable";
    } else {
      const relative = formatRelativeTime(lastCommit.committedAt);
      commitValue = `${lastCommit.repo} · ${relative}`;
      commitSpoken = `${lastCommit.repo}, ${relative}`;
    }
  }

  const uptime = stats?.uptime;
  let uptimeValue = "···";
  let uptimeSpoken = "loading";
  if (uptime) {
    if (uptime.status === "error") {
      uptimeValue = "—";
      uptimeSpoken = "unavailable";
    } else {
      const days = daysSince(uptime.committedAt);
      const buildLabel = uptime.build === "preview" ? "PREVIEW" : "OK";
      uptimeValue = `${days}d · ${buildLabel}`;
      uptimeSpoken = `${days} days since the last deploy, build ${buildLabel.toLowerCase()}`;
    }
  }

  return (
    <div className="rail3-stats">
      <StatRow label="WATCHING" value={watchingValue} spoken={watchingSpoken} />
      <StatRow label="LAST COMMIT" value={commitValue} spoken={commitSpoken} />
      <StatRow label="UPTIME" value={uptimeValue} spoken={uptimeSpoken} />
    </div>
  );
}

function ThemeAccordion() {
  const { committed, preview, restore, commit } = useCharacterTheme();
  const [hovered, setHovered] = useState<CharacterTheme | null>(null);
  const active = hovered ?? committed;

  const gridTemplateRows = CHARACTER_THEMES.map((theme) =>
    theme === active ? ACCORDION_EXPANDED : ACCORDION_COLLAPSED
  ).join(" ");

  return (
    <div
      className="rail3-accordion"
      role="radiogroup"
      aria-label="Colour theme"
      style={{ gridTemplateRows }}
      onMouseLeave={() => {
        setHovered(null);
        restore();
      }}
    >
      {CHARACTER_THEMES.map((theme) => (
        <label
          key={theme}
          className={`rail3-accordion-panel${theme === active ? " is-active" : ""}`}
          data-swatch={theme}
          onMouseEnter={() => {
            setHovered(theme);
            preview(theme);
          }}
        >
          <input
            type="radio"
            name="rail3-theme"
            className="rail3-accordion-input"
            value={theme}
            checked={committed === theme}
            onChange={() => {
              commit(theme);
              setHovered(null);
            }}
          />
          <span className="rail3-accordion-texture" aria-hidden="true" />
          <span className="rail3-accordion-label mono">{THEME_LABELS[theme]}</span>
        </label>
      ))}
    </div>
  );
}

function BrutalButton() {
  const { brutal, toggle } = useUiMode();
  return (
    <button
      type="button"
      className="rail3-brutal"
      aria-pressed={brutal}
      onClick={toggle}
    >
      BRUTAL
    </button>
  );
}

export default function RailThree() {
  return (
    <div className="rail3">
      <div className="rail3-ascii">
        <AsciiFlow />
      </div>

      <Stats />
      <ThemeAccordion />
      <BrutalButton />
    </div>
  );
}
