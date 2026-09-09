"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { IconMoon, IconSun } from "./icons";
import { NAV_LINKS } from "@/lib/data";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>;
  };
};

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// The theme actually being rendered right now: an explicit data-theme
// stamp wins, otherwise it's whatever the prefers-color-scheme media
// query is currently resolving the CSS variables to.
function effectiveTheme(): "light" | "dark" {
  const stamped = document.documentElement.getAttribute("data-theme");
  if (stamped === "light" || stamped === "dark") return stamped;
  return systemPrefersDark() ? "dark" : "light";
}

export default function Nav() {
  // Base design is dark-first by default, matching the original site behavior.
  const [isDark, setIsDark] = useState(true);
  const [clockText, setClockText] = useState("--:-- IST");

  useEffect(() => {
    // Syncs React state from the theme actually in effect — an explicit
    // data-theme stamp the pre-hydration inline script (see app/layout.tsx)
    // may have set from localStorage, or the system preference otherwise.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(effectiveTheme() === "dark");
  }, []);

  useEffect(() => {
    function updateClock() {
      try {
        const fmt = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        setClockText(fmt.format(new Date()) + " IST");
      } catch {
        setClockText("— IST");
      }
    }
    updateClock();
    const id = setInterval(updateClock, 30000);
    return () => clearInterval(id);
  }, []);

  function toggleTheme(event: React.MouseEvent<HTMLButtonElement>) {
    const next = effectiveTheme() === "dark" ? "light" : "dark";

    const applyTheme = () => {
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("kps-theme", next);
      } catch {}
      setIsDark(next === "dark");
    };

    const doc = document as ViewTransitionDocument;
    if (!doc.startViewTransition || prefersReducedMotion()) {
      applyTheme();
      return;
    }

    // Wave/reveal animation: the incoming theme expands out from the
    // clicked button as a growing circle until it covers the screen.
    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = doc.startViewTransition(() => {
      flushSync(applyTheme);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 650,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  }

  return (
    <header className="site-nav">
      <div className="wrap nav-inner">
        <a href="#top" className="brand">
          kumar<span className="slash">://</span>dev
        </a>
        <ul className="nav-links">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
        </ul>
        <div className="nav-right">
          <div className="clock mono">
            <span className="dot"></span>
            <span>{clockText}</span>
          </div>
          <button
            className="icon-btn"
            aria-label="Toggle color theme"
            title="Toggle color theme"
            onClick={toggleTheme}
          >
            {isDark ? <IconMoon /> : <IconSun />}
          </button>
        </div>
      </div>
    </header>
  );
}
