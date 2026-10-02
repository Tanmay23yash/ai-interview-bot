import type { ReactNode } from "react";

import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import AppNav from "../nav/AppNav";

/** Page frame for the interview screens: the app's nav pill, theme and type, without the dashboard's intro. */
export default function AppShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useDocumentTheme();

  return (
    <div
      data-theme={theme}
      className="min-h-svh bg-hm-bg font-['Geist',sans-serif] text-hm-ink antialiased selection:bg-hm-accent/30"
    >
      <AppNav theme={theme} onThemeChange={setTheme} />

      <main className="mx-auto max-w-[1280px] px-4 pb-24 pt-10 sm:px-8 sm:pt-14">{children}</main>
    </div>
  );
}
