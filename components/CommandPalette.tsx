"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { SOCIAL_LINKS } from "@/lib/data";
import { useTheme } from "@/lib/useTheme";
import { toggleSound, useSoundEnabled } from "@/lib/sound";
import { scrollToSection } from "@/lib/panelScroll";
import { nowPlayingCopy, useNowPlaying } from "@/lib/useNowPlaying";
import { useCommandPalette } from "./CommandPaletteContext";
import {
  IconArrowDown,
  IconArrowUp,
  IconBookOpen,
  IconBriefcase,
  IconCalendar,
  IconCornerDownLeft,
  IconCpu,
  IconFolder,
  IconGrid,
  IconGithub,
  IconHome,
  IconImage,
  IconLayers,
  IconLinkedin,
  IconMail,
  IconMapPin,
  IconMoon,
  IconMusic,
  IconPhone,
  IconResume,
  IconSearch,
  IconSun,
  IconUser,
  IconVolume,
  IconVolumeOff,
} from "./icons";
import styles from "./CommandPalette.module.css";

// One flat, searchable list — cmdk's own fuzzy filter (shouldFilter) is
// the way down to a specific item, not a wall of section headings. Each
// entry carries everything a result row renders: an icon, a title, a
// short description, and a "type" badge (Page / Action).
type PaletteEntry = {
  key: string;
  title: string;
  description: string;
  type: "Page" | "Action";
  icon: ReactNode;
  keywords?: string[];
  onSelect: () => void;
};

// Home-section entries come first, in page order (01 About … 06 Contact —
// the same numbering as the section eyebrows), then the separate routes.
// Stack, Experience and Activity have no top-nav link, so the palette is the
// power-user path that keeps reaching them.
const PAGES: Array<{
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
}> = [
  { title: "Home", description: "Go to the home page", href: "/", icon: <IconHome /> },
  { title: "01 About", description: "Jump to the About section", href: "/#about", icon: <IconUser /> },
  { title: "02 Stack", description: "Jump to the Stack section", href: "/#stack", icon: <IconLayers /> },
  {
    title: "03 Experience",
    description: "Jump to the Experience section",
    href: "/#experience",
    icon: <IconBriefcase />,
  },
  { title: "04 Work", description: "Jump to the Work section", href: "/#work", icon: <IconFolder /> },
  { title: "05 Activity", description: "Jump to the Shipping log", href: "/#activity", icon: <IconGrid /> },
  { title: "06 Contact", description: "Jump to the Contact section", href: "/#contact", icon: <IconPhone /> },
  { title: "Blogs", description: "Browse all blog posts", href: "/blog", icon: <IconBookOpen /> },
  { title: "Weekly", description: "Browse the weekly devlog", href: "/weekly", icon: <IconCalendar /> },
  { title: "Gallery", description: "Proof I touch grass sometimes", href: "/gallery", icon: <IconImage /> },
  { title: "Specs", description: "The hardware & software running the show", href: "/specs", icon: <IconCpu /> },
  {
    title: "Places I wanna go",
    description: "The bucket list, funding TBD",
    href: "/places",
    icon: <IconMapPin />,
  },
  { title: "Resume", description: "View the resume inline", href: "/resume", icon: <IconResume /> },
];

export default function CommandPalette() {
  const router = useRouter();
  const { isOpen, close } = useCommandPalette();
  const { isDark, toggleTheme } = useTheme();
  const soundOn = useSoundEnabled();
  const nowPlaying = useNowPlaying(isOpen);

  // Belt-and-braces alongside the [cmdk-root] flex fix in the CSS
  // module (see the comment there for the actual root cause): even
  // with the results list properly scrollable on its own, locking the
  // page behind — same pattern Nav.tsx already uses for the mobile
  // drawer — means a wheel/touch scroll that starts outside the list,
  // or one that outruns it, can never leak into scrolling the page
  // instead of the palette.
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function goTo(href: string) {
    close();
    // On the home page the sections live in separate scroll containers, so
    // jump with the home scrollers instead of a hash navigation.
    if (href.startsWith("/#") && window.location.pathname === "/" && scrollToSection(href.slice(2))) {
      // Same as a nav click (HomeShell): keep the URL shareable.
      history.replaceState(null, "", href.slice(1));
      return;
    }
    router.push(href);
  }

  function runAction(action: () => void) {
    close();
    action();
  }

  const nowPlayingEntry = nowPlayingCopy(nowPlaying);

  const entries: PaletteEntry[] = [
    ...PAGES.map((page) => ({
      key: page.href,
      title: page.title,
      description: page.description,
      type: "Page" as const,
      icon: page.icon,
      onSelect: () => goTo(page.href),
    })),
    {
      key: "action-now-playing",
      title: nowPlayingEntry.title,
      description: nowPlayingEntry.description,
      type: "Action",
      icon: <IconMusic />,
      keywords: ["spotify", "music", "now playing", "lastfm", "song"],
      onSelect: () =>
        runAction(() => {
          if (nowPlayingEntry.url) {
            window.open(nowPlayingEntry.url, "_blank", "noopener");
          }
        }),
    },
    {
      key: "action-theme",
      title: isDark ? "Switch to light mode" : "Switch to dark mode",
      description: "Change the site's color theme",
      type: "Action",
      icon: isDark ? <IconSun /> : <IconMoon />,
      keywords: ["toggle", "theme", "dark", "light", "mode"],
      onSelect: () => runAction(() => toggleTheme()),
    },
    {
      key: "action-sound",
      title: soundOn ? "Turn interaction sounds off" : "Turn interaction sounds on",
      description: "Soft ticks on hover and click (off by default)",
      type: "Action",
      icon: soundOn ? <IconVolume /> : <IconVolumeOff />,
      keywords: ["sound", "audio", "mute", "volume", "click", "noise"],
      onSelect: () => runAction(() => toggleSound()),
    },
    {
      key: "action-email",
      title: "Copy email address",
      description: `Copy ${SOCIAL_LINKS.email} to the clipboard`,
      type: "Action",
      icon: <IconMail />,
      keywords: ["copy", "email", "contact"],
      onSelect: () =>
        runAction(() => {
          navigator.clipboard?.writeText(SOCIAL_LINKS.email).catch(() => {});
        }),
    },
    {
      key: "action-download-resume",
      title: "Download resume",
      description: "Download the resume as a PDF",
      type: "Action",
      icon: <IconResume />,
      keywords: ["download", "resume", "cv", "pdf"],
      onSelect: () =>
        runAction(() => window.open(SOCIAL_LINKS.resume, "_blank", "noopener")),
    },
    {
      key: "action-github",
      title: "Open GitHub",
      description: "View the GitHub profile in a new tab",
      type: "Action",
      icon: <IconGithub />,
      keywords: ["github", "code", "repos"],
      onSelect: () =>
        runAction(() => window.open(SOCIAL_LINKS.github, "_blank", "noopener")),
    },
    {
      key: "action-linkedin",
      title: "Open LinkedIn",
      description: "View the LinkedIn profile in a new tab",
      type: "Action",
      icon: <IconLinkedin />,
      keywords: ["linkedin", "profile"],
      onSelect: () =>
        runAction(() => window.open(SOCIAL_LINKS.linkedin, "_blank", "noopener")),
    },
  ];

  return (
    <Command.Dialog
      open={isOpen}
      onOpenChange={(open) => (open ? undefined : close())}
      label="Command palette"
      shouldFilter
      overlayClassName={styles.overlay}
      contentClassName={styles.content}
    >
      <div className={styles.inputRow}>
        <span className={styles.inputIcon} aria-hidden="true">
          <IconSearch />
        </span>
        <Command.Input
          className={styles.input}
          placeholder="Jump to a page, post, or run an action…"
        />
      </div>

      <div className={styles.hints} aria-hidden="true">
        <span className={styles.hint}>
          <kbd className={styles.key}>
            <IconArrowUp />
          </kbd>
          <kbd className={styles.key}>
            <IconArrowDown />
          </kbd>
          Navigate
        </span>
        <span className={styles.hint}>
          <kbd className={styles.key}>
            <IconCornerDownLeft />
          </kbd>
          Open
        </span>
        <span className={styles.hint}>
          <kbd className={`${styles.key} ${styles.keyText}`}>esc</kbd>
          Close
        </span>
      </div>

      <Command.List className={styles.list}>
        <Command.Empty className={styles.empty}>No matches.</Command.Empty>

        {entries.map((entry) => (
          <Command.Item
            key={entry.key}
            className={styles.item}
            value={entry.title}
            keywords={entry.keywords}
            onSelect={entry.onSelect}
          >
            <span className={styles.itemIcon} aria-hidden="true">
              {entry.icon}
            </span>
            <span className={styles.itemBody}>
              <span className={styles.itemTitle}>{entry.title}</span>
              <span className={styles.itemDesc}>{entry.description}</span>
            </span>
            <span className={styles.itemType}>{entry.type}</span>
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
