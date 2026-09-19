"use client";

// Music-icon button in the nav (left of the ⌘ trigger on desktop, between
// the theme toggle and hamburger on mobile — see Nav.tsx). Clicking it
// opens a pixel-styled popover with the current/last track's details and a
// 30s preview you can play in-page, resolved via Apple's iTunes Search API
// (see app/api/now-playing/route.ts) — free, keyless, and with no login or
// subscription required for a visitor, unlike Spotify's own Web API which
// now gates even keyless search behind the app owner having Premium.
//
// The popover is portaled to <body> and positioned with fixed coordinates
// taken from the button's rect: header.site-nav has backdrop-filter, which
// (per spec) makes it the containing block for position:fixed descendants,
// so rendering in place would size and place it against the nav bar. The
// same trick as the mobile drawer in Nav.tsx. Measuring the button also
// lets one popover work for both the desktop and mobile buttons.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { nowPlayingCopy, useNowPlaying } from "@/lib/useNowPlaying";
import { IconMusic } from "./icons";

const POP_WIDTH = 320;
const POP_MARGIN = 16;

type Position = { top: number; left: number; width: number };

export default function NowPlayingWidget({
  variant = "nav",
}: {
  variant?: "nav" | "mobile";
}) {
  const data = useNowPlaying(true);
  const [pos, setPos] = useState<Position | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const copy = nowPlayingCopy(data);
  const track = data && (data.status === "playing" || data.status === "idle") ? data : null;
  const isLive = data?.status === "playing";
  const open = pos !== null;

  function toggle() {
    if (open) {
      setPos(null);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(POP_WIDTH, window.innerWidth - POP_MARGIN * 2);
    // Right-align to the button, then clamp so it never runs off either edge.
    const left = Math.max(
      POP_MARGIN,
      Math.min(rect.right - width, window.innerWidth - width - POP_MARGIN)
    );
    setPos({ top: rect.bottom + 10, left, width });
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setPos(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPos(null);
    }
    function onResize() {
      setPos(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const buttonClass =
    variant === "mobile"
      ? `np-btn np-btn-mobile${isLive ? " live" : ""}`
      : // .nav-cmd-trigger so the desktop button shares the ⌘ button's
        // padding, hover and custom-cursor morph/invert styling.
        `nav-cmd-trigger np-btn${isLive ? " live" : ""}`;

  const tag = isLive ? "NOW PLAYING" : track ? "LAST SPUN" : "OFFLINE";

  return (
    <div className={variant === "mobile" ? "np np-mobile" : "np np-nav"}>
      <button
        ref={btnRef}
        type="button"
        className={buttonClass}
        aria-label="Now playing"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={copy.title}
        onClick={toggle}
      >
        <span className="np-icon-wrap">
          <IconMusic className="nav-cmd-kbd np-icon" />
          {isLive && <span className="np-live-dot" aria-hidden="true" />}
        </span>
      </button>

      {pos &&
        createPortal(
          <div
            ref={popRef}
            className={`np-pop${isLive ? " live" : ""}`}
            role="dialog"
            aria-label="Now playing"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <div className="np-head">
              <span className="np-eq" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="np-tag">{tag}</span>
            </div>

            {track ? (
              <div className="np-player">
                {track.artwork ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote iTunes artwork, not worth next/image config for a tiny popover thumbnail
                  <img src={track.artwork} alt="" className="np-art" />
                ) : (
                  <span className="np-art np-art-empty" aria-hidden="true">
                    <IconMusic />
                  </span>
                )}
                <div className="np-player-body">
                  <span className="np-player-title">{track.title}</span>
                  <span className="np-player-artist">{track.artist}</span>
                </div>
              </div>
            ) : (
              <div className="np-fallback">
                <p>{copy.description}</p>
              </div>
            )}

            {track &&
              (track.previewUrl ? (
                <>
                  <audio controls autoPlay src={track.previewUrl} className="np-audio" />
                  <span className="np-note">30s preview, via Apple Music</span>
                </>
              ) : (
                <span className="np-note">No 30s preview found for this one</span>
              ))}

            {track?.url && (
              <a className="np-link" href={track.url} target="_blank" rel="noopener">
                Open on Last.fm →
              </a>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
