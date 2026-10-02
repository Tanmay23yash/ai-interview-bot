import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import { ArrowRight, FileText, Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDocumentTheme } from "../hooks/useDocumentTheme";
import type { Theme } from "../hooks/useDocumentTheme";
import ThemeToggle from "../components/dashboard/ThemeToggle";
import { Magnetic, Marquee, Reveal } from "../components/dashboard/motionBits";
import { ChromeTile, FloatingCharm, GlossyPill, HiredDisc, InflatedWord } from "../components/landing/Charms";
import { EXAMPLES } from "../components/landing/examples";
import HeroStudio from "../components/landing/HeroStudio";
import Logo from "../components/landing/Logo";
import { useParallax } from "../components/landing/useParallax";
import QuestionTypes from "../components/landing/QuestionTypes";
import Workflow from "../components/landing/Workflow";

/*
 * Public landing page. Visual language borrowed from butter.video: light canvas,
 * oversized grotesk type, dark product mocks on soft shadows, glossy charms,
 * marquees and a timeline motif. Colours are the lp-* tokens (index.css), so the
 * page follows the light/dark switch it shares with the auth pages and dashboard.
 */

const YEAR = new Date().getFullYear();

const NAV_LINKS = [
  { href: "#workflow", label: "How it works" },
  { href: "#questions", label: "Question types" },
  { href: "#examples", label: "Examples" },
];

const ROLES = [
  "Frontend Engineer",
  "Data Scientist",
  "Backend Engineer",
  "ML Engineer",
  "Product Manager",
  "DevOps",
  "Data Analyst",
  "Full-Stack Developer",
  "Mobile Developer",
  "Cloud Architect",
];

function Nav({ theme, onThemeChange }: { theme: Theme; onThemeChange: (theme: Theme) => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 12));

  const solid = scrolled || open;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <nav
        aria-label="Main"
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-3 transition-all duration-300 ${
          solid ? "bg-lp-bg/90 shadow-[0_12px_30px_-22px_rgba(15,15,15,0.45)] ring-1 ring-lp-edge backdrop-blur-xl" : ""
        }`}
      >
        <Link to="/" aria-label="HireMind home">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-full px-4 py-2 text-[15px] text-lp-ink/60 transition hover:bg-lp-surface hover:text-lp-ink">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onChange={onThemeChange} showLabel={false} />

          <div className="hidden items-center gap-2 md:flex">
            {token ? (
              <Link to="/dashboard" className="rounded-full bg-lp-ink px-5 py-2.5 text-[15px] font-medium text-lp-bg transition hover:bg-lp-button-hover">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-full px-4 py-2.5 text-[15px] text-lp-ink/70 transition hover:text-lp-ink">
                  Log in
                </Link>
                <Link to="/signup" className="rounded-full bg-lp-ink px-5 py-2.5 text-[15px] font-medium text-lp-bg transition hover:bg-lp-button-hover">
                  Try for free
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-lp-surface md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-auto mt-2 max-w-6xl rounded-2xl bg-lp-bg/95 p-3 shadow-[0_20px_40px_-24px_rgba(15,15,15,0.5)] ring-1 ring-lp-edge backdrop-blur-xl md:hidden"
          >
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 font-['Schibsted_Grotesk'] text-2xl font-semibold tracking-tight hover:bg-lp-surface"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {token ? (
                <Link to="/dashboard" className="col-span-2 rounded-full bg-lp-ink py-3 text-center font-medium text-lp-bg">
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="rounded-full bg-lp-surface py-3 text-center font-medium">
                    Log in
                  </Link>
                  <Link to="/signup" className="rounded-full bg-lp-ink py-3 text-center font-medium text-lp-bg">
                    Try for free
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function HeadlineLine({ words, delay }: { words: string[]; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="block">
      {words.map((w, i) => (
        <span key={w} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={reduce ? false : { y: "105%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.9, delay: delay + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            {w}
            {i < words.length - 1 && " "}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

function Hero() {
  const { token } = useAuth();
  const reduce = useReducedMotion();
  const { px, py, onMouseMove } = useParallax();

  // The product mock starts tilted back and lies flat as it scrolls into view.
  const studioRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: studioRef, offset: ["start end", "start 30%"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.9, 1]);

  const primary = token
    ? { to: "/dashboard", label: "Open your dashboard" }
    : { to: "/signup", label: "Get started, it's free" };

  return (
    <section className="relative px-4 pb-16 pt-32 sm:px-6 sm:pt-40" onMouseMove={onMouseMove}>
      <div className="relative mx-auto max-w-6xl">
        <FloatingCharm className="left-[1%] top-[60%] hidden lg:block" depth={0.9} px={px} py={py} rotate={-14} delay={0.6}>
          <HiredDisc size={124} />
        </FloatingCharm>
        <FloatingCharm className="right-[4%] -top-6 hidden md:block" depth={-0.7} px={px} py={py} rotate={10} delay={0.8}>
          <ChromeTile size={92} />
        </FloatingCharm>
        <FloatingCharm className="-right-2 top-[58%] hidden lg:block" depth={1.2} px={px} py={py} rotate={-8} delay={1}>
          <span className="text-6xl">
            <InflatedWord>offer!</InflatedWord>
          </span>
        </FloatingCharm>
        <FloatingCharm className="left-[5%] -top-2 hidden md:block" depth={-1} px={px} py={py} rotate={-6} delay={1.1}>
          <GlossyPill>
            <FileText size={14} /> resume.pdf
          </GlossyPill>
        </FloatingCharm>

        <div className="relative mx-auto text-center">
          <motion.a
            href="#workflow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full bg-lp-surface px-3.5 py-1.5 font-['Geist_Mono'] text-xs text-lp-ink/70 transition hover:bg-lp-surface-strong"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#63AD45]" />
            Now writing with Gemini 2.5 Flash
            <ArrowRight size={12} />
          </motion.a>

          {/* From sm up, sized to the viewport so each line stays on one row. */}
          <h1 className="font-['Schibsted_Grotesk'] text-[13vw] font-bold leading-[0.92] tracking-[-0.05em] sm:text-[8.2vw] xl:text-[112px]">
            <HeadlineLine words={["Know", "the", "questions"]} delay={0.1} />
            <HeadlineLine words={["before", "they're", "asked."]} delay={0.35} />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-lp-ink/55 sm:text-xl"
          >
            HireMind reads your resume and writes the interview you're about to walk into: technical, machine
            learning and behavioral questions about your own work.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.85 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Magnetic>
              <Link
                to={primary.to}
                className="group flex items-center gap-2 rounded-full bg-lp-ink px-7 py-4 text-base font-medium text-lp-bg shadow-[0_18px_40px_-18px_rgba(15,15,15,0.7)] transition hover:bg-lp-button-hover"
              >
                {primary.label}
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </Magnetic>
            <a
              href="#workflow"
              className="rounded-full bg-lp-surface px-7 py-4 text-base font-medium transition hover:bg-lp-surface-strong"
            >
              See how it works
            </a>
          </motion.div>
        </div>
      </div>

      <motion.div
        ref={studioRef}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 1, ease: [0.22, 1, 0.36, 1] }}
        style={{ rotateX, scale, transformPerspective: 1400 }}
        className="relative mx-auto mt-16 max-w-5xl origin-top sm:mt-24"
      >
        <HeroStudio />
      </motion.div>
    </section>
  );
}

function StatementWord({ children, progress, range }: { children: ReactNode; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  return (
    <motion.span className="inline-block" style={{ opacity }}>
      {children}
    </motion.span>
  );
}

function StatementChip({ children, background }: { children: ReactNode; background: string }) {
  return (
    <span
      className="mx-1 inline-flex h-[0.82em] w-[1.5em] -translate-y-[0.06em] items-center justify-center rounded-full align-middle"
      style={{ background, boxShadow: "inset 0 2px 2px rgba(255,255,255,0.6), inset 0 -4px 8px rgba(0,0,0,0.15)" }}
    >
      <span className="flex text-[0.45em]">{children}</span>
    </span>
  );
}

function Statement() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 50%"] });

  const tokens: ReactNode[] = [
    ..."HireMind is the interview coach that reads every line of your resume".split(" "),
    <StatementChip key="pdf" background="linear-gradient(180deg, #b8efff, #4DC5E5)">
      <FileText className="h-[1em] w-[1em] text-[#063a4a]" />
    </StatementChip>,
    ..."and turns it into the questions".split(" "),
    <StatementChip key="q" background="linear-gradient(180deg, #fff6b8, #E9D352)">
      <span className="font-black text-[#4a3f06]">?</span>
    </StatementChip>,
    ..."an interviewer would actually ask you.".split(" "),
  ];

  return (
    <section aria-label="What HireMind does" className="px-4 py-28 sm:px-6 sm:py-40">
      <p
        ref={ref}
        className="mx-auto max-w-5xl font-['Schibsted_Grotesk'] text-[9vw] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-[68px]"
      >
        {tokens.map((token, i) => {
          const start = i / tokens.length;
          return (
            <span key={i}>
              {reduce ? token : <StatementWord progress={scrollYProgress} range={[start, start + 1 / tokens.length]}>{token}</StatementWord>}{" "}
            </span>
          );
        })}
      </p>
    </section>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <Reveal ready className="mb-14 max-w-3xl sm:mb-20">
      <div className="mb-5 font-['Geist_Mono'] text-xs uppercase tracking-[0.2em] text-lp-ink/45">{eyebrow}</div>
      <h2 className="font-['Schibsted_Grotesk'] text-5xl font-bold leading-[0.95] tracking-[-0.045em] sm:text-6xl lg:text-7xl">{title}</h2>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-lp-ink/55">{body}</p>
    </Reveal>
  );
}

function ExampleCard({ example }: { example: (typeof EXAMPLES)[number] }) {
  return (
    <article className="mr-4 w-[280px] shrink-0 rounded-[28px] bg-lp-card p-3 ring-1 ring-lp-edge sm:w-[320px]">
      <div
        aria-hidden="true"
        className="flex h-44 items-center justify-center overflow-hidden rounded-[20px] font-['Schibsted_Grotesk'] text-7xl font-black tracking-tight"
        style={example.surface}
      >
        {example.glyph}
      </div>
      <div className="px-2 pb-2 pt-4">
        <span className="rounded-full bg-lp-surface px-2.5 py-1 font-['Geist_Mono'] text-[11px] text-lp-ink/70">{example.tag}</span>
        <p className="mt-3 text-[17px] font-medium leading-snug">{example.question}</p>
      </div>
    </article>
  );
}

function FinalCta() {
  const { token } = useAuth();
  const { px, py, onMouseMove } = useParallax(28);

  return (
    <section className="px-3 sm:px-5" onMouseMove={onMouseMove}>
      <div className="relative overflow-hidden rounded-[36px] bg-lp-band px-6 py-24 text-center text-[#FAFAFA] ring-1 ring-lp-edge sm:rounded-[48px] sm:py-36">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, #000 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, #000 30%, transparent 75%)",
          }}
        />
        <FloatingCharm className="left-[6%] top-[14%] hidden md:block" depth={0.8} px={px} py={py} rotate={-12}>
          <ChromeTile size={84} glyph="✓" />
        </FloatingCharm>
        <FloatingCharm className="bottom-[12%] right-[7%] hidden md:block" depth={-0.9} px={px} py={py} rotate={12} delay={0.3}>
          <HiredDisc size={110} />
        </FloatingCharm>
        <FloatingCharm className="bottom-[16%] left-[10%] hidden lg:block" depth={1.1} px={px} py={py} rotate={-4} delay={0.5}>
          <GlossyPill tone="yellow">STAR ready</GlossyPill>
        </FloatingCharm>

        <Reveal ready className="relative">
          <h2 className="mx-auto max-w-4xl font-['Schibsted_Grotesk'] text-5xl font-bold leading-[0.95] tracking-[-0.045em] sm:text-7xl lg:text-8xl">
            Your next interview starts with a PDF.
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-[#FAFAFA]/55">
            Upload your resume and get a question set written about your own experience.
          </p>
          <div className="mt-10 flex justify-center">
            <Magnetic>
              <Link
                to={token ? "/upload" : "/signup"}
                className="group flex items-center gap-2 rounded-full bg-[#FAFAFA] px-8 py-4 text-base font-medium text-[#0F0F0F] transition hover:bg-white"
              >
                Upload your resume
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  const columns: { title: string; links: { label: string; to?: string; href?: string }[] }[] = [
    { title: "Product", links: NAV_LINKS.map((l) => ({ label: l.label, href: l.href })) },
    {
      title: "Account",
      links: [
        { label: "Log in", to: "/login" },
        { label: "Sign up", to: "/signup" },
        { label: "Reset password", to: "/forgot-password" },
      ],
    },
    { title: "Built with", links: [{ label: "Gemini 2.5 Flash" }, { label: "FastAPI" }, { label: "React" }] },
  ];

  return (
    <footer className="px-4 pb-8 pt-20 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="col-span-2 lg:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-lp-ink/55">
            Interview prep, written from your resume.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="mb-4 font-['Geist_Mono'] text-xs uppercase tracking-[0.18em] text-lp-ink/40">{col.title}</h3>
            <ul className="space-y-2.5 text-[15px]">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.to ? (
                    <Link to={l.to} className="text-lp-ink/70 transition hover:text-lp-ink">
                      {l.label}
                    </Link>
                  ) : l.href ? (
                    <a href={l.href} className="text-lp-ink/70 transition hover:text-lp-ink">
                      {l.label}
                    </a>
                  ) : (
                    <span className="text-lp-ink/70">{l.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div
        aria-hidden="true"
        className="mx-auto mt-20 max-w-6xl select-none overflow-hidden whitespace-nowrap font-['Schibsted_Grotesk'] text-[20.5vw] font-black leading-[0.8] tracking-[-0.06em] xl:text-[262px]"
      >
        HireMind
      </div>
      <div className="mx-auto mt-8 flex max-w-6xl flex-wrap justify-between gap-2 border-t border-lp-ink/10 pt-6 font-['Geist_Mono'] text-xs text-lp-ink/45">
        <span>© {YEAR} HireMind</span>
        <span>All rights reserved.</span>
      </div>
    </footer>
  );
}

export default function Landing() {
  const reduce = useReducedMotion();
  const [theme, setTheme] = useDocumentTheme();

  // Smooth in-page anchor scrolling, only while this page is mounted.
  useEffect(() => {
    if (reduce) return;
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = "smooth";
    return () => {
      html.style.scrollBehavior = previous;
    };
  }, [reduce]);

  return (
    <div
      data-theme={theme}
      // The shared theme toggle uses --hm-accent; here it takes the landing page blue.
      style={{ "--hm-accent": "#4DC5E5" } as CSSProperties}
      className="min-h-screen overflow-x-clip bg-lp-bg font-['Geist',sans-serif] text-lp-ink antialiased selection:bg-[#4DC5E5]/40"
    >
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-lp-ink px-4 py-2 text-lp-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Nav theme={theme} onThemeChange={setTheme} />

      <main id="main">
        <Hero />

        <section aria-label="Roles" className="border-y border-lp-ink/[0.06] py-8">
          <p className="mb-6 px-4 text-center font-['Geist_Mono'] text-xs uppercase tracking-[0.2em] text-lp-ink/45">
            Shaped by your resume, any role
          </p>
          <Marquee duration={45}>
            {ROLES.map((role) => (
              <span
                key={role}
                className="flex items-center gap-8 pr-8 font-['Schibsted_Grotesk'] text-2xl font-semibold tracking-tight text-lp-ink/30 sm:text-3xl"
              >
                {role}
                <span className="h-1.5 w-1.5 rounded-full bg-lp-ink/20" />
              </span>
            ))}
          </Marquee>
        </section>

        <Statement />

        <section id="questions" className="scroll-mt-24 px-4 pb-28 sm:px-6 sm:pb-40">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Question library"
              title="Every line becomes a question."
              body="Gemini sorts what it asks into tracks, each drawn from the skills, projects and experience on your resume."
            />
            <QuestionTypes />
          </div>
        </section>

        <section id="workflow" className="scroll-mt-24 px-4 pb-28 sm:px-6 sm:pb-40">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="How it works"
              title="Your new interview workflow."
              body="From PDF to a mock interview in five steps. No setup, no generic question banks."
            />
            <Workflow />
          </div>
        </section>

        <section id="examples" className="scroll-mt-24 pb-28 sm:pb-40">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Examples"
              title="Questions that sound like your interviewer."
              body="A few samples. Yours are written from your resume, so they'll be about your own work."
            />
          </div>
          <Marquee duration={60}>
            {EXAMPLES.map((example) => (
              <ExampleCard key={example.question} example={example} />
            ))}
          </Marquee>
        </section>

        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}
