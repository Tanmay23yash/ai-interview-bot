import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChromeTile, FloatingCharm, HiredDisc, InflatedWord } from "../landing/Charms";
import { EXAMPLES } from "../landing/examples";
import Logo from "../landing/Logo";
import { useParallax } from "../landing/useParallax";
import ThemeToggle from "../dashboard/ThemeToggle";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import type { Theme } from "../../hooks/useDocumentTheme";

/*
 * Shared layout for login / signup / password pages, in the landing page's
 * butter.video-inspired style: form on the left, showcase panel on the right.
 * Colours come from the --lp-* tokens (index.css), so the pages follow the
 * light/dark switch shared with the dashboard.
 */

const YEAR = new Date().getFullYear();
const DEAL_MS = 3600;
// Front card first. In dark mode the front card is the lightest, so it still stands out from the panel.
const DECK_TINTS: Record<Theme, string[]> = {
  light: ["#161616", "#262626", "#343434"],
  dark: ["#303030", "#282828", "#222222"],
};
const DECK_TILTS = [0, 2.5, -2];

/** Sample-question cards that deal themselves off the top of the deck. */
function QuestionDeck({ theme }: { theme: Theme }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const tints = DECK_TINTS[theme];

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % EXAMPLES.length), DEAL_MS);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="relative mx-auto h-[290px] w-full max-w-[440px]">
      <AnimatePresence initial={false}>
        {/* Back cards first so the front card paints on top. */}
        {[2, 1, 0].map((offset) => {
          const n = (index + offset) % EXAMPLES.length;
          const example = EXAMPLES[n];
          return (
            <motion.article
              key={example.question}
              className="absolute inset-x-0 top-0 rounded-[28px] p-6 text-[#FAFAFA] shadow-[0_40px_70px_-35px_rgba(15,15,15,0.75)]"
              style={{ zIndex: 3 - offset }}
              initial={{ opacity: 0, y: 80, scale: 0.84, backgroundColor: tints[2] }}
              animate={{
                opacity: 1,
                y: offset * 28,
                scale: 1 - offset * 0.06,
                rotate: DECK_TILTS[offset],
                backgroundColor: tints[offset],
              }}
              exit={{ opacity: 0, y: -70, rotate: -9, scale: 1.02, transition: { duration: 0.45 } }}
              transition={{ type: "spring", stiffness: 150, damping: 22 }}
            >
              {/* Only the front card shows its content; the ones behind are blank edges. */}
              <motion.div animate={{ opacity: offset === 0 ? 1 : 0 }} transition={{ duration: 0.3 }}>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 font-['Geist_Mono'] text-[11px] text-white/70">
                    {example.tag}
                  </span>
                  <span
                    className="flex h-9 min-w-9 items-center justify-center rounded-xl px-2 font-['Schibsted_Grotesk'] text-sm font-black"
                    style={example.surface}
                  >
                    {example.glyph}
                  </span>
                </div>
                <p className="mt-6 min-h-[96px] font-['Schibsted_Grotesk'] text-2xl font-semibold leading-tight tracking-[-0.02em]">
                  {example.question}
                </p>
                <div className="mt-6 flex justify-between font-['Geist_Mono'] text-[11px] text-white/40">
                  <span>questions.md</span>
                  <span>
                    {String(n + 1).padStart(2, "0")} / {String(EXAMPLES.length).padStart(2, "0")}
                  </span>
                </div>
              </motion.div>
            </motion.article>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default function AuthShell({
  title,
  subtitle,
  prompt,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  /** Top-right "switch page" link, e.g. "New here? Create an account". */
  prompt?: { text: string; label: string; to: string };
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const { px, py, onMouseMove } = useParallax(30);
  const [theme, setTheme] = useDocumentTheme();

  return (
    <div
      data-theme={theme}
      // The shared theme toggle uses --hm-accent; here it takes the landing page blue.
      style={{ "--hm-accent": "#4DC5E5" } as CSSProperties}
      className="min-h-svh bg-lp-bg font-['Geist',sans-serif] text-lp-ink antialiased selection:bg-[#4DC5E5]/40 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
    >
      <div className="flex min-h-svh flex-col px-5 py-5 sm:px-10 sm:py-7">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" aria-label="HireMind home">
            <Logo />
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <ThemeToggle theme={theme} onChange={setTheme} />
            {prompt && (
              <p className="flex items-center gap-3 text-sm text-lp-ink/55">
                <span className="hidden sm:inline">{prompt.text}</span>
                <Link
                  to={prompt.to}
                  className="rounded-full bg-lp-surface px-4 py-2.5 font-medium text-lp-ink transition hover:bg-lp-surface-strong"
                >
                  {prompt.label}
                </Link>
              </p>
            )}
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-14">
          <motion.div
            className="w-full max-w-[400px]"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="font-['Schibsted_Grotesk'] text-5xl font-bold leading-[0.95] tracking-[-0.045em] sm:text-6xl">
              {title}
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-lp-ink/55">{subtitle}</p>
            <div className="mt-10">{children}</div>
          </motion.div>
        </main>

        <footer className="flex justify-between gap-4 font-['Geist_Mono'] text-xs text-lp-ink/40">
          <span>© {YEAR} HireMind</span>
          <Link to="/" className="-my-3 py-3 transition hover:text-lp-ink">
            Back to home
          </Link>
        </footer>
      </div>

      {/* Decorative showcase; hidden from assistive tech. */}
      <aside aria-hidden="true" className="hidden p-3 lg:sticky lg:top-0 lg:block lg:h-screen" onMouseMove={onMouseMove}>
        <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[36px] bg-lp-surface p-10 xl:p-14">
          <FloatingCharm className="right-[7%] top-[6%]" depth={0.8} px={px} py={py} rotate={12} delay={0.3}>
            <HiredDisc size={112} />
          </FloatingCharm>
          <FloatingCharm className="left-[5%] top-[40%] hidden xl:block" depth={-0.9} px={px} py={py} rotate={-12} delay={0.5}>
            <ChromeTile size={84} />
          </FloatingCharm>
          <FloatingCharm className="bottom-[20%] right-[6%]" depth={1.1} px={px} py={py} rotate={-8} delay={0.7}>
            <span className="text-5xl xl:text-6xl">
              <InflatedWord>offer!</InflatedWord>
            </span>
          </FloatingCharm>

          <div className="relative flex items-center gap-2 font-['Geist_Mono'] text-xs uppercase tracking-[0.2em] text-lp-ink/45">
            <span className="h-1.5 w-1.5 rounded-full bg-[#63AD45]" />
            Sample questions
          </div>

          <QuestionDeck theme={theme} />

          <p className="relative max-w-md font-['Schibsted_Grotesk'] text-5xl font-bold leading-[0.95] tracking-[-0.045em] xl:text-6xl">
            Know the questions before they're asked.
          </p>
        </div>
      </aside>
    </div>
  );
}
