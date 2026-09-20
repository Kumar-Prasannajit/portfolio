"use client";

// Boot-sequence preloader: a fake terminal boot log that covers the page for
// about a second and a half, then wipes away into the hero. It is server
// rendered and animated entirely in CSS (see "BOOT SEQUENCE" in globals.css),
// so the page is never held hostage by JS: whatever happens to the scripts,
// the overlay ends on its own.
//
// JS only does the small extras: remember in sessionStorage that this tab has
// seen it, let a key press or tap skip it, and mark <html data-boot="done">
// when it finishes so a later client-side visit to "/" doesn't replay it.
// Skipping before first paint (repeat visits, reduced motion, landing on
// another page) is the inline script in app/layout.tsx.

import { useEffect } from "react";
import { BOOT_LINES, BOOT_TITLE } from "@/lib/data";

// A little after the CSS timeline's end (1.45s), as a backstop.
const BOOT_MS = 1600;
const OK = "[ OK ] ";

export default function Boot() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.boot === "done") return;
    try {
      sessionStorage.setItem("kps-booted", "1");
    } catch {}

    const finish = () => {
      root.dataset.boot = "done";
    };
    const timer = setTimeout(finish, BOOT_MS);
    window.addEventListener("keydown", finish, { once: true });
    window.addEventListener("pointerdown", finish, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", finish);
      window.removeEventListener("pointerdown", finish);
    };
  }, []);

  return (
    <div className="boot" aria-hidden="true">
      <div className="boot-inner">
        <div className="boot-title">{BOOT_TITLE}</div>
        {BOOT_LINES.map((line, i) => (
          <div
            className="boot-line"
            key={line}
            style={
              {
                "--i": i,
                "--n": OK.length + line.length,
              } as React.CSSProperties
            }
          >
            <span className="boot-ok">{OK}</span>
            {line}
          </div>
        ))}
        <div className="boot-bar">
          <span />
        </div>
        <div className="boot-ready">
          &gt; ready<span className="cursor" />
        </div>
      </div>
    </div>
  );
}
