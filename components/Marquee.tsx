"use client";

// The single live telemetry line under the hero (docs/redesign-spec.md phase
// 8): it replaces the old static ticker and the nav's typing tagline. Real
// state — last commit age, the episode being watched, the contribution
// count, when the live version was deployed — with a couple of the old quips
// kept in the rotation.
// Values settle with the scramble effect when the data lands; a source that
// fails or isn't configured drops its segment instead of leaving a hole.

import ScrambleText from "./ScrambleText";
import { GH_COUNTS, NAV_TAGLINES } from "@/lib/data";
import { formatRelativeTime } from "@/lib/format";
import { useRailStats } from "@/lib/useRailStats";

const PENDING = "···";
const CONTRIBUTIONS = GH_COUNTS.reduce((a, b) => a + b, 0);

// Two of the nav's old taglines, interleaved with the readings.
const QUIPS = [NAV_TAGLINES[2], NAV_TAGLINES[3]];

type Segment = { id: string; text: string };

function useSegments(): Segment[] {
  const stats = useRailStats();
  const segments: Segment[] = [];

  const commit = stats?.lastCommit;
  if (!commit) {
    segments.push({ id: "commit", text: `LAST COMMIT · ${PENDING}` });
  } else if (commit.status === "ok") {
    const age = formatRelativeTime(commit.committedAt).toUpperCase();
    segments.push({ id: "commit", text: `LAST COMMIT · ${age} · ${commit.repo.toUpperCase()}` });
  }

  segments.push({ id: "quip-0", text: QUIPS[0] });

  const watching = stats?.watching;
  if (!watching) {
    segments.push({ id: "watching", text: `WATCHING · ${PENDING}` });
  } else if (watching.status === "ok") {
    const ep = String(watching.progress).padStart(2, "0");
    // No total while a show is still airing: "EP 1103", not "EP 1103 / ?".
    const total = watching.episodes ? ` / ${watching.episodes}` : "";
    segments.push({
      id: "watching",
      text: `WATCHING · ${watching.title.toUpperCase()} · EP ${ep}${total}`,
    });
  }

  segments.push({
    id: "contributions",
    text: `${CONTRIBUTIONS.toLocaleString("en-US")} CONTRIBUTIONS / YR`,
  });
  segments.push({ id: "quip-1", text: QUIPS[1] });

  const deployed = stats?.deployed;
  if (!deployed) {
    segments.push({ id: "deployed", text: `DEPLOYED · ${PENDING}` });
  } else if (deployed.status === "ok") {
    const age = formatRelativeTime(deployed.deployedAt).toUpperCase();
    segments.push({ id: "deployed", text: `DEPLOYED · ${age}` });
  }

  return segments;
}

export default function Marquee() {
  const segments = useSegments();
  // Duplicated once so the CSS animation (translateX(-50%)) loops seamlessly.
  const items = [...segments, ...segments];
  return (
    <div className="marquee-band" aria-hidden="true">
      <div className="marquee-clip">
        <div className="marquee-track mono">
          {items.map((segment, i) => (
            <span key={`${segment.id}-${i}`}>
              <ScrambleText value={segment.text} duration={700} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
