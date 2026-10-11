"use client";

// Client side of rail 3's Stats block (app/api/rail-stats, RailThree.tsx) and
// the About section's live "watching" line (components/About.tsx). One shared
// store rather than a per-component poll: both consumers subscribe to the same
// response, so mounting the About section never costs a second request.
//
// Same behaviour as lib/useNowPlaying.ts: fetch once on first subscribe, then
// on an interval, and keep the last good response on a failed poll instead of
// blanking the row (a transient fetch error shouldn't flash a placeholder
// over data that was fine ten seconds ago). Polling stops when the last
// subscriber unmounts.

import { useSyncExternalStore } from "react";
import type { RailStatsResponse } from "@/app/api/rail-stats/route";

// These fields change at most a few times a day — no point polling faster
// than the source data does (same reasoning as useNowPlaying's 30s, scaled
// up: an anime episode or a commit doesn't land every 30 seconds).
const POLL_INTERVAL_MS = 5 * 60_000;

let state: RailStatsResponse | null = null;
let interval: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

async function fetchStats() {
  try {
    const res = await fetch("/api/rail-stats");
    state = (await res.json()) as RailStatsResponse;
    listeners.forEach((listener) => listener());
  } catch {
    // Keep whatever was last fetched successfully — see module note.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    fetchStats();
    interval = setInterval(fetchStats, POLL_INTERVAL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) clearInterval(interval);
  };
}

export function useRailStats() {
  return useSyncExternalStore(subscribe, () => state, () => null);
}
