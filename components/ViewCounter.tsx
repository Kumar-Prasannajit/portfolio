"use client";

// Counts this visit (once per browser, see lib/views.ts) whichever page the
// visitor lands on, not just the home page whose panel displays the number.
// Renders nothing.

import { useEffect } from "react";
import { loadViews } from "@/lib/views";

export default function ViewCounter() {
  useEffect(() => {
    loadViews();
  }, []);
  return null;
}
