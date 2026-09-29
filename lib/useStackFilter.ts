"use client";

// The link between the Stack section and the Work feed (docs/redesign-spec.md
// phases 6 and 7): clicking a tool sets the filter, the feed reads it. A tiny
// shared store so neither component imports the other, and so phase 7's
// rebuilt feed can drop in and keep using the same hook. In-memory only — a
// reload starts unfiltered, which is the honest default state.

import { useSyncExternalStore } from "react";

let tool: string | null = null;
const listeners = new Set<() => void>();

export function setStackFilter(next: string | null) {
  if (next === tool) return;
  tool = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useStackFilter(): string | null {
  return useSyncExternalStore(subscribe, () => tool, () => null);
}
