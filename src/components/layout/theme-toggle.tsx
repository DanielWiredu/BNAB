"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Light/dark toggle. The actual class is applied to <html> before hydration by
 * the inline script in the root layout (no flash); this button just flips it
 * and persists the choice. Storage key mirrors the sidebar-collapse pattern.
 */
export const THEME_STORAGE_KEY = "lams.theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
      } catch {
        /* storage unavailable — theme still applies for this session */
      }
      return next;
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex size-9 items-center justify-center rounded-md text-[var(--muted-foreground)] outline-none transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)] focus-visible:ring-1 focus-visible:ring-[var(--ring)]",
        className,
      )}
    >
      {/* Render a stable icon until mounted to avoid a hydration mismatch. */}
      {mounted && dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
