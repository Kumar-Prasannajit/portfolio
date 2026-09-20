"use client";

// The nav's sound switch: a speaker button beside ⌘ (desktop) and in the
// mobile bar. Off by default; the speaker turns red with sound waves when on.
// It is separate from the music-note button (the Last.fm "last spun" popover).

import { toggleSound, useSoundEnabled } from "@/lib/sound";
import { IconVolume, IconVolumeOff } from "./icons";

export default function SoundToggle({
  variant = "nav",
}: {
  variant?: "nav" | "mobile";
}) {
  const on = useSoundEnabled();
  return (
    <button
      type="button"
      data-sound-toggle=""
      className={variant === "mobile" ? "sound-btn-mobile" : "nav-cmd-trigger sound-btn"}
      aria-label="Interaction sounds"
      aria-pressed={on}
      title={`Interaction sounds: ${on ? "on — click to turn off" : "off — click to turn on"}`}
      onClick={toggleSound}
    >
      {on ? <IconVolume /> : <IconVolumeOff />}
    </button>
  );
}
