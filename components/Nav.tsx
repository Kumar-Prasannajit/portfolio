"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  IconClose,
  IconGithub,
  IconInstagram,
  IconLinkedin,
  IconMenu,
  IconResume,
  IconThemeCircle,
} from "./icons";
import TaglineCycler from "./TaglineCycler";
import { NAV_LINKS, NAV_LOGO_MARK, SOCIAL_LINKS } from "@/lib/data";
import { useTheme } from "@/lib/useTheme";
import { useCommandPalette } from "./CommandPaletteContext";

export default function Nav() {
  const { isDark, toggleTheme } = useTheme();
  const { isOpen: paletteOpen, toggle: togglePalette } = useCommandPalette();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Mobile drawer: Escape closes it, and — since it's a fixed-position
  // overlay rather than a normal document flow element — resizing past
  // the breakpoint that hides the hamburger trigger has to close it too,
  // or it's left stranded open with no way to reach the button again.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    function onResize() {
      if (window.innerWidth > 640) setMobileMenuOpen(false);
    }
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileMenuOpen]);

  // Runs the same wave/reveal animation as before: the incoming theme
  // expands out from the clicked button's own center as a growing
  // circle. See lib/useTheme.ts for the shared implementation (also
  // used by the command palette's "Toggle dark mode" action, which has
  // no click origin to anchor to and falls back to a plain crossfade).
  function toggleThemeFromButton(event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    toggleTheme({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  return (
    <header className="site-nav">
      <div className="nav-inner">
        <div className="nav-grid">
          <Link href="/" className="nav-cell nav-cell-logo" aria-label={NAV_LOGO_MARK}>
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
          </Link>

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

            <div className="nav-command">
              <button
                type="button"
                className="nav-cmd-trigger"
                aria-label="Open command palette"
                aria-haspopup="dialog"
                aria-expanded={paletteOpen}
                title="Command palette (⌘K)"
                onClick={() => togglePalette()}
              >
                <span className="nav-cmd-kbd mono">⌘</span>
              </button>
            </div>
          </div>

          <div className="nav-cell nav-cell-theme">
            <button
              className="theme-toggle-btn"
              aria-label="Toggle color theme"
              title="Toggle color theme"
              onClick={toggleThemeFromButton}
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

        {/* Mobile-only replacement for .nav-grid above (see the ≤640px
            media query, which hides one and shows the other): logo, then
            a gap, then the theme toggle and hamburger grouped on the
            right. The hamburger opens .nav-mobile-drawer below instead of
            trying to squeeze the full link list into the grid. */}
        <div className="nav-mobile-bar">
          <Link href="/" className="nav-mobile-logo" aria-label={NAV_LOGO_MARK}>
            <Image
              src={isDark ? "/darkmode.png" : "/lightmode.png"}
              alt={NAV_LOGO_MARK}
              width={140}
              height={70}
              priority
              className="nav-logo-img"
            />
          </Link>
          <div className="nav-mobile-actions">
            <button
              className="theme-toggle-btn"
              aria-label="Toggle color theme"
              title="Toggle color theme"
              onClick={toggleThemeFromButton}
            >
              <IconThemeCircle />
            </button>
            <button
              type="button"
              className="nav-hamburger-btn"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-haspopup="true"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>

        {mobileMenuOpen &&
          // Portaled to <body> instead of rendered in place: header.site-nav
          // has backdrop-filter (for the sticky blur), which — per spec —
          // makes it a containing block for its position:fixed descendants,
          // the same as position:relative would. Left in place, the drawer
          // sized and positioned itself against the ~40px nav bar instead
          // of the viewport. Rendering outside that subtree sidesteps it.
          createPortal(
            <>
              <div
                className="nav-mobile-overlay"
                aria-hidden="true"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="nav-mobile-drawer" role="dialog" aria-label="Site navigation">
                <div className="nav-mobile-links">
                  <ul>
                    {NAV_LINKS.map((link) => (
                      <li key={link.href}>
                        <a href={link.href} onClick={() => setMobileMenuOpen(false)}>
                          <span className="nav-link-idx mono">{link.idx}</span>
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="nav-mobile-gif" aria-hidden="true" />
              </div>
            </>,
            document.body
          )}
      </div>
    </header>
  );
}
