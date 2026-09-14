"use client";

import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import type { CommandIndexItem } from "@/lib/content";
import { SOCIAL_LINKS } from "@/lib/data";
import { useTheme } from "@/lib/useTheme";
import { useCommandPalette } from "./CommandPaletteContext";
import {
  IconGithub,
  IconLinkedin,
  IconMail,
  IconMoon,
  IconResume,
  IconSun,
} from "./icons";
import styles from "./CommandPalette.module.css";

// Home-section entries (About/Stack/Experience/Work/Contact) still jump
// here even though Stack and Experience lost their top-nav link — both
// sections are still live on the homepage, and the palette is exactly
// the power-user path that should keep reaching them.
const PAGES = [
  { title: "About", href: "/#about" },
  { title: "Stack", href: "/#stack" },
  { title: "Experience", href: "/#experience" },
  { title: "Work", href: "/#work" },
  { title: "Blogs", href: "/blog" },
  { title: "Weekly", href: "/weekly" },
  { title: "Contact", href: "/#contact" },
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

  function goTo(href: string) {
    close();
    router.push(href);
  }

  function runAction(action: () => void) {
    close();
    action();
  }

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
        <span className={styles.inputHint} aria-hidden="true">
          ⌘
        </span>
        <Command.Input
          className={styles.input}
          placeholder="Jump to a page, post, or run an action…"
        />
        <span className={styles.escHint}>ESC</span>
      </div>
      <Command.List className={styles.list}>
        <Command.Empty className={styles.empty}>
          No matches.
        </Command.Empty>

        <Command.Group heading="Pages" className={styles.group}>
          {PAGES.map((page) => (
            <Command.Item
              key={page.href}
              className={styles.item}
              value={page.title}
              onSelect={() => goTo(page.href)}
            >
              {page.title}
            </Command.Item>
          ))}
        </Command.Group>

        {blogItems.length > 0 && (
          <>
            <Command.Separator className={styles.separator} />
            <Command.Group heading="Blog posts" className={styles.group}>
              {blogItems.map((item) => (
                <Command.Item
                  key={item.href}
                  className={styles.item}
                  value={item.title}
                  keywords={item.keywords}
                  onSelect={() => goTo(item.href)}
                >
                  {item.title}
                  <span className={styles.itemMeta}>Blog</span>
                </Command.Item>
              ))}
            </Command.Group>
          </>
        )}

        {weeklyItems.length > 0 && (
          <>
            <Command.Separator className={styles.separator} />
            <Command.Group heading="Weekly" className={styles.group}>
              {weeklyItems.map((item) => (
                <Command.Item
                  key={item.href}
                  className={styles.item}
                  value={item.title}
                  onSelect={() => goTo(item.href)}
                >
                  {item.title}
                  <span className={styles.itemMeta}>Weekly</span>
                </Command.Item>
              ))}
            </Command.Group>
          </>
        )}

        <Command.Separator className={styles.separator} />
        <Command.Group heading="Actions" className={styles.group}>
          <Command.Item
            className={styles.item}
            value="toggle theme dark light mode"
            onSelect={() => runAction(() => toggleTheme())}
          >
            {isDark ? <IconSun /> : <IconMoon />}
            {isDark ? "Switch to light mode" : "Switch to dark mode"}
          </Command.Item>
          <Command.Item
            className={styles.item}
            value="copy email address"
            onSelect={() =>
              runAction(() => {
                navigator.clipboard?.writeText(SOCIAL_LINKS.email).catch(() => {});
              })
            }
          >
            <IconMail />
            Copy email address
          </Command.Item>
          <Command.Item
            className={styles.item}
            value="download resume pdf"
            onSelect={() =>
              runAction(() => window.open(SOCIAL_LINKS.resume, "_blank", "noopener"))
            }
          >
            <IconResume />
            Download resume
          </Command.Item>
          <Command.Item
            className={styles.item}
            value="github profile"
            onSelect={() =>
              runAction(() => window.open(SOCIAL_LINKS.github, "_blank", "noopener"))
            }
          >
            <IconGithub />
            Open GitHub
          </Command.Item>
          <Command.Item
            className={styles.item}
            value="linkedin profile"
            onSelect={() =>
              runAction(() => window.open(SOCIAL_LINKS.linkedin, "_blank", "noopener"))
            }
          >
            <IconLinkedin />
            Open LinkedIn
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
