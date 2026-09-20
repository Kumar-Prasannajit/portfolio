// Optional interaction sounds: a soft synthesized tick on hover, click and
// page change. OFF by default and only ever turned on by the visitor (the nav
// speaker button or the ⌘K action); the choice is kept in localStorage.
//
// Nothing here can play by itself:
//   - no audio files: sounds are a few milliseconds of oscillator, generated
//     with the Web Audio API on demand
//   - no AudioContext is created until sound is on AND the visitor has
//     interacted with the page (browsers require a gesture anyway), so a page
//     load never makes a sound, even when the saved preference is "on"
//   - nothing plays while the tab is hidden

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "kps-sound";

export type SoundKind = "hover" | "click" | "nav";

// One place to tune how it sounds. Frequencies in Hz, times in seconds, gain
// is linear (kept low: these are ticks, not notifications).
const SOUNDS: Record<
  SoundKind,
  { type: OscillatorType; from: number; to: number; dur: number; gain: number }
> = {
  hover: { type: "sine", from: 1500, to: 1100, dur: 0.03, gain: 0.025 },
  click: { type: "triangle", from: 640, to: 380, dur: 0.06, gain: 0.05 },
  nav: { type: "sine", from: 520, to: 780, dur: 0.09, gain: 0.04 },
};
const MIN_GAP_MS = 45; // never stack ticks closer than this
const NAV_AFTER_CLICK_MS = 600; // a page change right after a click stays silent

// ---- preference (external store for useSyncExternalStore) ------------------

let enabled = false;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {}
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function getSoundEnabled() {
  load();
  return enabled;
}

export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the preference.
  function onStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    enabled = event.newValue === "on";
    emit();
  }
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSoundEnabled() {
  return useSyncExternalStore(subscribeSound, getSoundEnabled, () => false);
}

export function setSoundEnabled(on: boolean) {
  load();
  enabled = on;
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "on");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
  emit();
}

// Turning it on is itself a user gesture, so it may start the audio engine
// and confirm with a tick. Turning it off is silent.
export function toggleSound() {
  const next = !getSoundEnabled();
  setSoundEnabled(next);
  if (next) {
    unlockAudio();
    playSound("nav");
  }
}

// ---- playback ---------------------------------------------------------------

let ctx: AudioContext | null = null;
let unlocked = false; // the visitor has interacted with the page
let lastPlayed = 0;
let lastClick = 0;

// Called from real user gestures (pointerdown / keydown).
export function unlockAudio() {
  unlocked = true;
}

function schedule(c: AudioContext, kind: SoundKind) {
  const spec = SOUNDS[kind];
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.from, t);
  osc.frequency.exponentialRampToValueAtTime(spec.to, t + spec.dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(spec.gain, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + spec.dur + 0.02);
}

export function playSound(kind: SoundKind) {
  if (typeof window === "undefined") return;
  if (!getSoundEnabled() || !unlocked || document.hidden) return;

  const now = performance.now();
  if (kind === "click") lastClick = now;
  if (kind === "nav" && now - lastClick < NAV_AFTER_CLICK_MS) return;
  if (now - lastPlayed < MIN_GAP_MS) return;
  lastPlayed = now;

  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
  }
  const c = ctx;
  if (c.state === "running") {
    schedule(c, kind);
  } else {
    // Freshly created / suspended: play this one once it is running, and drop
    // anything that arrives meanwhile rather than queueing a burst.
    c.resume()
      .then(() => {
        if (c.state === "running") schedule(c, kind);
      })
      .catch(() => {});
  }
}
