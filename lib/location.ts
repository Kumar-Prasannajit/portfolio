"use client";

// Client side of the "watching from" line (see app/api/location/route.ts): asks
// the server where the request came from and shares the answer with whoever
// displays it. Where the server can't say (local dev, no geo headers) it falls
// back to the city in the browser's own time zone, which needs no request and
// no permission. Nothing here uses the browser's geolocation prompt.

import { useSyncExternalStore } from "react";
import type { LocationResponse } from "@/app/api/location/route";

export type Place = { city: string | null; country: string | null };

let state: Place | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(next: Place | null) {
  state = next;
  listeners.forEach((listener) => listener());
}

// Browsers still report some cities under their old names.
const RENAMED: Record<string, string> = {
  Calcutta: "Kolkata",
  Saigon: "Ho Chi Minh City",
  Katmandu: "Kathmandu",
  Rangoon: "Yangon",
  Kiev: "Kyiv",
};

// "Europe/Berlin" -> Berlin. Continent-only zones ("UTC", "Etc/GMT+5") say
// nothing useful about a place, so they give no line at all.
function fromTimeZone(): Place | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone.includes("/") || zone.startsWith("Etc/")) return null;
    const city = zone.split("/").pop()!.replace(/_/g, " ");
    return { city: RENAMED[city] ?? city, country: null };
  } catch {
    return null;
  }
}

function load() {
  if (started || typeof window === "undefined") return;
  started = true;
  fetch("/api/location", { cache: "no-store" })
    .then((res) => res.json() as Promise<LocationResponse>)
    .then((data) =>
      set(data.status === "ok" ? { city: data.city, country: data.country } : fromTimeZone())
    )
    .catch(() => set(fromTimeZone()));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => {
    listeners.delete(listener);
  };
}

export function useLocation(): Place | null {
  return useSyncExternalStore(subscribe, () => state, () => null);
}
