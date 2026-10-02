import { useLayoutEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "hiremind_theme";

/** Saved choice first, otherwise the operating system's preference. */
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage can be unavailable (private mode); fall back to the system setting */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Light/dark theme for the page that uses it. Applies data-theme and
 * color-scheme to <html> (so scrollbars, overscroll and view transitions
 * match) and remembers the choice. Removed again on unmount, so pages
 * without a theme keep their own styling.
 */
export function useDocumentTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // Layout effect: runs inside flushSync, so a view transition snapshots the new theme.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* not persisted; the theme still applies for this visit */
    }
    return () => {
      delete root.dataset.theme;
      root.style.colorScheme = "";
    };
  }, [theme]);

  return [theme, setTheme] as const;
}
