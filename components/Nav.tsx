"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import {
  IconCheck,
  IconGithub,
  IconInstagram,
  IconLinkedin,
  IconMail,
  IconMoon,
  IconResume,
  IconSun,
  IconThemeCircle,
} from "./icons";
import TaglineCycler from "./TaglineCycler";
import { NAV_LINKS, NAV_LOGO_MARK, SOCIAL_LINKS } from "@/lib/data";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Syncs React state from the theme actually in effect — an explicit
    // data-theme stamp the pre-hydration inline script (see app/layout.tsx)
    // may have set from localStorage, or the system preference otherwise.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(effectiveTheme() === "dark");
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // The ⌘K / Ctrl+K hint on the command cell is a real shortcut, not just
  // decoration — it opens the same menu as clicking the grid icon.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMenuOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
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
    // toggle button's own center as a growing circle until it covers the
    // screen — anchored to the button, not wherever inside it was clicked.
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
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

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(SOCIAL_LINKS.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <header className="site-nav">
      <div className="nav-inner">
        <div className="nav-grid">
          <a href="#top" className="nav-cell nav-cell-logo" aria-label={NAV_LOGO_MARK}>
            <span className="nav-logo-swap">
              <Image
                src={isDark ? "/darkmode.png" : "/lightmode.png"}
                alt={NAV_LOGO_MARK}
                width={140}
                height={70}
                priority
                className="nav-logo-img nav-logo-img-default"
              />
              {/* On hover: dark mode reveals the red favicon mark (the
                  cursor's diff-blend box goes white behind it); light
                  mode instead swaps to the dark-theme logo asset, since
                  that section goes red-backed with white content instead
                  — see the .cursor-invert-target light-mode rules. */}
              <Image
                src={isDark ? "/favicon.png" : "/darkmode.png"}
                alt=""
                aria-hidden="true"
                width={140}
                height={70}
                className="nav-logo-img nav-logo-img-hover"
              />
            </span>
          </a>

          <div className="nav-cell nav-cell-top nav-cell-main">
            <TaglineCycler />
          </div>
          <div className="nav-cell nav-cell-bottom nav-cell-main">
            <ul className="nav-links">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>
                    <span className="nav-link-idx mono">{link.idx}</span>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="nav-command" ref={menuRef}>
              <button
                type="button"
                className="nav-cmd-trigger"
                aria-label="Open command menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title="Command menu (⌘K)"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className="nav-cmd-kbd mono">⌘</span>
              </button>
              {menuOpen && (
                <div className="nav-command-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      copyEmail();
                    }}
                  >
                    {copied ? <IconCheck /> : <IconMail />}
                    {copied ? "Copied!" : "Copy email"}
                  </button>
                  <a
                    role="menuitem"
                    href={SOCIAL_LINKS.resume}
                    target="_blank"
                    rel="noopener"
                  >
                    <IconResume />
                    Download resume
                  </a>
                  <a
                    role="menuitem"
                    href={SOCIAL_LINKS.github}
                    target="_blank"
                    rel="noopener"
                  >
                    <IconGithub />
                    GitHub
                  </a>
                  <a
                    role="menuitem"
                    href={SOCIAL_LINKS.linkedin}
                    target="_blank"
                    rel="noopener"
                  >
                    <IconLinkedin />
                    LinkedIn
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(event) => {
                      toggleTheme(event);
                      setMenuOpen(false);
                    }}
                  >
                    {isDark ? <IconSun /> : <IconMoon />}
                    {isDark ? "Light mode" : "Dark mode"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="nav-cell nav-cell-theme">
            <button
              className="theme-toggle-btn"
              aria-label="Toggle color theme"
              title="Toggle color theme"
              onClick={toggleTheme}
            >
              <IconThemeCircle />
            </button>
          </div>

          <div className="nav-cell nav-cell-top nav-cell-social">
            <a
              href={SOCIAL_LINKS.github}
              target="_blank"
              rel="noopener"
              aria-label="GitHub"
            >
              <IconGithub />
            </a>
            <a
              href={SOCIAL_LINKS.linkedin}
              target="_blank"
              rel="noopener"
              aria-label="LinkedIn"
            >
              <IconLinkedin />
            </a>
            <a
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noopener"
              aria-label="Instagram"
            >
              <IconInstagram />
            </a>
            <a
              href={SOCIAL_LINKS.resume}
              target="_blank"
              rel="noopener"
              aria-label="Resume"
            >
              <IconResume />
            </a>
          </div>
          <div className="nav-cell nav-cell-bottom nav-cell-social">
            <div className="nav-hatch" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    </header>
  );
}
