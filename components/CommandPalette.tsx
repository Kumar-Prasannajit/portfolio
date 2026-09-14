"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import type { CommandIndexItem } from "@/lib/content";
import { SOCIAL_LINKS } from "@/lib/data";
import { useTheme } from "@/lib/useTheme";
import { useCommandPalette } from "./CommandPaletteContext";
import {
  IconArrowDown,
  IconArrowUp,
  IconBookOpen,
  IconBriefcase,
  IconCalendar,
  IconCornerDownLeft,
  IconFolder,
  IconGithub,
  IconHome,
  IconLayers,
  IconLinkedin,
  IconMail,
  IconMoon,
  IconPhone,
  IconResume,
  IconSearch,
  IconSun,
  IconUser,
} from "./icons";
import styles from "./CommandPalette.module.css";

// One flat, searchable list instead of the old Pages/Blog posts/Weekly/
// Actions groups — cmdk's own fuzzy filter (shouldFilter) is the way
// down to a specific item, not a wall of section headings. Each entry
// carries everything a result row renders: an icon, a title, a short
// description, and a "type" badge (Page / Blog / Weekly / Action).
type PaletteEntry = {
  key: string;
  title: string;
  description: string;
  type: "Page" | "Blog" | "Weekly" | "Action";
  icon: ReactNode;
  keywords?: string[];
  onSelect: () => void;
};

// Home-section entries (About/Stack/Experience/Work/Contact) still jump
// here even though Stack and Experience lost their top-nav link — both
// sections are still live on the homepage, and the palette is exactly
// the power-user path that should keep reaching them.
const PAGES: Array<{
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
}> = [
  { title: "Home", description: "Go to the home page", href: "/", icon: <IconHome /> },
  { title: "About", description: "Jump to the About section", href: "/#about", icon: <IconUser /> },
  { title: "Stack", description: "Jump to the Stack section", href: "/#stack", icon: <IconLayers /> },
  {
    title: "Experience",
    description: "Jump to the Experience section",
    href: "/#experience",
    icon: <IconBriefcase />,
  },
  { title: "Work", description: "Jump to the Work section", href: "/#work", icon: <IconFolder /> },
  { title: "Blogs", description: "Browse all blog posts", href: "/blog", icon: <IconBookOpen /> },
  { title: "Weekly", description: "Browse the weekly devlog", href: "/weekly", icon: <IconCalendar /> },
  { title: "Contact", description: "Jump to the Contact section", href: "/#contact", icon: <IconPhone /> },
  { title: "Resume", description: "View the resume inline", href: "/resume", icon: <IconResume /> },
];

export default function CommandPalette({
  index,
}: {
  index: CommandIndexItem[];
}) {
  const router = useRouter();
  const { isOpen, close } = useCommandPalette();
  const { isDark, toggleTheme } = useTheme();

  const blogItems = index.filter((item) => item.group === "blog");
  const weeklyItems = index.filter((item) => item.group === "weekly");

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
    router.push(href);
  }

  function runAction(action: () => void) {
    close();
    action();
  }

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
      key: "action-theme",
      title: isDark ? "Switch to light mode" : "Switch to dark mode",
      description: "Change the site's color theme",
      type: "Action",
      icon: isDark ? <IconSun /> : <IconMoon />,
      keywords: ["toggle", "theme", "dark", "light", "mode"],
      onSelect: () => runAction(() => toggleTheme()),
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
    ...blogItems.map((item) => ({
      key: item.href,
      title: item.title,
      description: item.description,
      type: "Blog" as const,
      icon: <IconBookOpen />,
      keywords: item.keywords,
      onSelect: () => goTo(item.href),
    })),
    ...weeklyItems.map((item) => ({
      key: item.href,
      title: item.title,
      description: item.description,
      type: "Weekly" as const,
      icon: <IconCalendar />,
      onSelect: () => goTo(item.href),
    })),
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
