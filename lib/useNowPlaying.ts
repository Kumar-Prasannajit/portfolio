"use client";

// Shared by CommandPalette.tsx (the ⌘K action row) and NowPlayingWidget.tsx
// (the persistent nav chip) so both poll the same /api/now-playing endpoint
// through one implementation instead of two copies drifting apart.

import { useEffect, useState } from "react";
import type { NowPlayingResponse } from "@/app/api/now-playing/route";

// Last.fm's own scrobble lag means a 30s cadence is already more than
// fast enough — no point polling faster than the source data changes.
const POLL_INTERVAL_MS = 30_000;

export function useNowPlaying(enabled: boolean) {
  const [data, setData] = useState<NowPlayingResponse | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function fetchNowPlaying() {
      try {
        const res = await fetch("/api/now-playing");
        const json: NowPlayingResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ status: "error" });
      }
    }

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  return data;
}

export function nowPlayingCopy(data: NowPlayingResponse | null): {
  title: string;
  description: string;
  url: string | null;
} {
  if (!data) {
    return { title: "Checking Spotify…", description: "Asking Last.fm what's playing", url: null };
  }
  switch (data.status) {
    case "unconfigured":
      return {
        title: "Now playing: not wired up yet",
        description: "Add LASTFM_API_KEY + LASTFM_USERNAME to .env.local, cheapskate",
        url: null,
      };
    case "no-scrobbles":
      return {
        title: "Now playing: nothing, apparently",
        description: "Last.fm's never seen me listen to a single song — link it to Spotify",
        url: null,
      };
    case "error":
      return {
        title: "Now playing: Last.fm ghosted me",
        description: "API's down or rate-limited — try again in a bit",
        url: null,
      };
    case "playing":
      return {
        title: `🎧 Now playing: ${data.title} — ${data.artist}`,
        description: "Live from Spotify via Last.fm — click to peek at the track",
        url: data.url || null,
      };
    case "idle":
      return {
        title: `Last spun: ${data.title} — ${data.artist}`,
        description: "Not live right now, but that's the vibe I left on",
        url: data.url || null,
      };
  }
}
