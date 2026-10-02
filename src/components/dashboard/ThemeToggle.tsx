import type { MouseEvent } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import type { Theme } from "../../hooks/useDocumentTheme";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

/**
 * Round light/dark switch. Where the View Transitions API exists, the new
 * theme is revealed by a circle growing out of the button; elsewhere (or with
 * reduced motion) it switches instantly.
 */
export default function ThemeToggle({
  theme,
  onChange,
  showLabel = true,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
  /** The "Light"/"Dark" text beside the button (from sm up); off for tight navs. */
  showLabel?: boolean;
}) {
  const reduce = useReducedMotion();
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle(e: MouseEvent<HTMLButtonElement>) {
    const doc = document as ViewTransitionDocument;
    if (!doc.startViewTransition || reduce) {
      onChange(next);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    const transition = doc.startViewTransition(() => {
      flushSync(() => onChange(next));
    });
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 650, easing: "cubic-bezier(0.76, 0, 0.24, 1)", pseudoElement: "::view-transition-new(root)" }
        );
      })
      .catch(() => {
        /* transition skipped (e.g. tab hidden); the theme has still changed */
      });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="group flex items-center gap-3 rounded-full outline-none"
    >
      {showLabel && (
        <span className="hidden font-['Geist_Mono'] text-xs uppercase tracking-wide text-hm-ink sm:inline">
          {theme === "dark" ? "Dark" : "Light"}
        </span>
      )}
      <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-hm-ink/70 text-hm-ink transition-colors group-hover:border-hm-accent group-hover:bg-hm-accent group-hover:text-[#151515] group-focus-visible:ring-2 group-focus-visible:ring-hm-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-hm-bg">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ y: 16, opacity: 0, rotate: -45 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -16, opacity: 0, rotate: 45 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex"
          >
            {theme === "dark" ? <Moon size={18} strokeWidth={1.5} /> : <Sun size={18} strokeWidth={1.5} />}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}
