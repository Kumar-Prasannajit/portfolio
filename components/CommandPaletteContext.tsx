"use client";

// Shares the command palette's open/closed state between Nav.tsx (the
// ⌘K trigger button lives there) and CommandPalette.tsx (the actual
// palette, mounted once in the root layout) — they're siblings in the
// tree, not parent/child, so plain prop-drilling doesn't reach.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type CommandPaletteContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null
);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Global ⌘K / Ctrl+K — works from anywhere on the page, not just
  // while focus happens to be inside the nav (this used to live in
  // Nav.tsx itself, scoped to a single mounted instance; identical
  // behavior, just relocated so it fires regardless of what's focused).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error(
      "useCommandPalette must be used within a CommandPaletteProvider"
    );
  }
  return ctx;
}
