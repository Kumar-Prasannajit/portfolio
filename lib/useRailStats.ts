"use client";

// Client side of rail 3's Stats block (app/api/rail-stats, RailThree.tsx).
// Same shape as lib/useNowPlaying.ts: poll once on mount, then on an
// interval, keep the last good response on a failed poll instead of
// blanking the row (a transient fetch error shouldn't flash a placeholder
// over data that was fine ten seconds ago).

import { useEffect, useState } from "react";
import type { RailStatsResponse } from "@/app/api/rail-stats/route";

// These fields change at most a few times a day — no point polling faster
// than the source data does (same reasoning as useNowPlaying's 30s, scaled
// up: an anime episode or a commit doesn't land every 30 seconds).
const POLL_INTERVAL_MS = 5 * 60_000;

export function useRailStats() {
  const [data, setData] = useState<RailStatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const res = await fetch("/api/rail-stats");
        const json: RailStatsResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // Keep whatever was last fetched successfully — see module note.
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return data;
}
