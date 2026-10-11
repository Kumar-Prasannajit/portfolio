// Pure, client-safe formatting helpers shared between server pages and
// client components. Deliberately separate from lib/content.ts (which
// imports `node:fs`) — a client component importing even one named
// export from a module that touches `fs` pulls the whole module,
// `fs` import included, into the client bundle, which Turbopack can't
// resolve ("chunking context does not support external modules").

export function formatContentDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Compact "2h ago" / "3d ago" style relative time, for rail 3's live stat
// rows (docs/redesign-spec.md phase 3: LAST COMMIT) and the stack section's
// "last used" line (phase 6). Deliberately coarse — one unit, no decimals —
// since these are ambient status glances, not a precise timestamp.
export function formatRelativeTime(iso: string, now: Date = new Date()) {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  const diffYear = Math.round(diffMonth / 12);
  return `${diffYear}y ago`;
}

// Whole days between an ISO timestamp and now — rail 3's UPTIME row (days
// since the currently-deployed commit landed).
export function daysSince(iso: string, now: Date = new Date()) {
  const then = new Date(iso).getTime();
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}
