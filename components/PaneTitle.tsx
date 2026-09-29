"use client";

// The header's contextual pane title (docs/redesign-spec.md phase 8): a
// terminal-style path that rewrites as you scroll — ~/kumar/about.md ->
// stack.json -> work/ — and follows the route on the other pages. It lives in
// the nav cell the typing tagline used to occupy. Rewrites reuse the
// scramble-settle effect; nothing else animates here.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import ScrambleText from "./ScrambleText";
import { refreshActiveSection, useActiveSection, type SectionId } from "@/lib/useActiveSection";

const ROOT = "~/kumar/";

const SECTION_FILES: Record<SectionId, string> = {
  top: "",
  activity: "activity.log",
  about: "about.md",
  stack: "stack.json",
  experience: "experience.log",
  work: "work/",
  contact: "contact.sh",
};

// Routes use their first segment as a directory; a deeper page is a file in it.
function routePath(pathname: string) {
  const [first, ...rest] = pathname.split("/").filter(Boolean);
  if (!first) return null;
  if (rest.length === 0) return `${first}/`;
  return `${first}/${rest.join("/")}`;
}

export default function PaneTitle() {
  const pathname = usePathname();
  const section = useActiveSection();

  // The section set changes with the route; re-measure once it has mounted.
  useEffect(() => {
    refreshActiveSection();
  }, [pathname]);

  const title = ROOT + (routePath(pathname) ?? SECTION_FILES[section]);

  return (
    <p className="nav-pane-title mono">
      <span className="sr-only">{title}</span>
      <ScrambleText value={title} duration={380} />
    </p>
  );
}
