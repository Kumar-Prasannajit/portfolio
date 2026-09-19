"use client";

// Persistent "now playing" chip, sitting beside the name in Hero.tsx.
// Unlike the palette's own now-playing row (which just links out), this one
// actually plays audio in-page: a 30s preview resolved via Apple's iTunes
// Search API (see app/api/now-playing/route.ts) — free, keyless, and with
// no login or subscription required for a visitor, unlike Spotify's own
// Web API which now gates even keyless search behind the app owner having
// Premium.

import { useEffect, useRef, useState } from "react";
import { nowPlayingCopy, useNowPlaying } from "@/lib/useNowPlaying";
import { IconMusic } from "./icons";

export default function NowPlayingWidget() {
  const data = useNowPlaying(true);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const copy = nowPlayingCopy(data);
  const hasTrack = data && (data.status === "playing" || data.status === "idle");
  const previewUrl = hasTrack ? data.previewUrl : null;
  const artwork = hasTrack ? data.artwork : null;
  const isLive = data?.status === "playing";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="nav-nowplaying" ref={rootRef}>
      <button
        type="button"
        className="nav-nowplaying-chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={copy.title}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`nav-nowplaying-dot${isLive ? " live" : ""}`} aria-hidden="true" />
        <IconMusic />
        <span className="nav-nowplaying-title">{copy.title.replace(/^🎧\s*/, "")}</span>
      </button>

      {open && (
        <div className="nav-nowplaying-pop" role="dialog" aria-label="Now playing">
          {previewUrl ? (
            <div className="nav-nowplaying-player">
              {artwork && (
                // eslint-disable-next-line @next/next/no-img-element -- remote iTunes artwork, not worth next/image config for a tiny popover thumbnail
                <img src={artwork} alt="" className="nav-nowplaying-art" />
              )}
              <div className="nav-nowplaying-player-body">
                <span className="nav-nowplaying-player-title">{copy.title.replace(/^🎧\s*/, "")}</span>
                <audio controls autoPlay src={previewUrl} className="nav-nowplaying-audio" />
                <span className="nav-nowplaying-player-note">30s preview, via Apple Music</span>
              </div>
            </div>
          ) : (
            <div className="nav-nowplaying-fallback">
              <p>{copy.description}</p>
              {copy.url && (
                <a href={copy.url} target="_blank" rel="noopener">
                  Open on Last.fm →
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
