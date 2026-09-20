"use client";

// Client side of the viewers counter (see lib/viewCount.ts, app/api/views).
//
// The first time this browser loads the site it asks the server to count it
// (POST) and remembers that in localStorage; every other load only reads the
// number (GET). So the figure is "distinct browsers", not page loads. Clearing
// site data or switching browsers counts again, which is fine for a portfolio.
//
// Shared module state, so the layout can trigger the count on any landing page
// while the home page's panel just displays whatever came back.

import { useSyncExternalStore } from "react";

export type ViewsState =
  | { status: "loading" }
  | { status: "ok"; count: number }
  | { status: "unconfigured" }
  | { status: "error" };

const STORAGE_KEY = "kps-counted";
const LOADING: ViewsState = { status: "loading" };

let state: ViewsState = LOADING;
let started = false;
const listeners = new Set<() => void>();

function set(next: ViewsState) {
  state = next;
  listeners.forEach((listener) => listener());
}

// Idempotent: React strict mode and several callers share one request.
export function loadViews() {
  if (started || typeof window === "undefined") return;
  started = true;

  let counted = false;
  try {
    counted = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {}

  fetch("/api/views", { method: counted ? "GET" : "POST", cache: "no-store" })
    .then((res) => res.json() as Promise<ViewsState & { counted?: boolean }>)
    .then((data) => {
      if (data.status === "ok" && data.counted) {
        try {
          window.localStorage.setItem(STORAGE_KEY, "1");
        } catch {}
      }
      set(data);
    })
    .catch(() => set({ status: "error" }));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useViews(): ViewsState {
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}
