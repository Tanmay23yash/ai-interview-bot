import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "../lib/api";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import type { MotionValue } from "framer-motion";
import { CalendarDays, Clock3, FileText, Files, Layers, LogOut, Play, ScanLine, Target, Upload } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useDocumentTheme } from "../hooks/useDocumentTheme";
import Preloader from "../components/dashboard/Preloader";
import MobileNav from "../components/dashboard/MobileNav";
import ThemeToggle from "../components/dashboard/ThemeToggle";
import TrackDial from "../components/dashboard/TrackDial";
import { OrbitArt, QuestionsArt, ResumeArt, Tunnel } from "../components/dashboard/art";
import { ArrowLink, Scramble, SectionTag } from "../components/dashboard/ui";
import { Reveal } from "../components/dashboard/motionBits";
import Logo from "../components/landing/Logo";

/*
 * Signed-in home. Visual language after cominvi.com.mx: flat ink/sage/white
 * surfaces with one orange accent, big medium-weight statements, mono labels,
 * stacked section tags, hairline stat grids and a tick-mark dial. Light and
 * dark themes come from CSS variables (index.css); every animation is
 * transform/opacity only.
 */

const API = API_URL;
const INTRO_KEY = "hiremind_intro_seen";
const YEAR = new Date().getFullYear();
const MONO = "font-['Geist_Mono'] uppercase";

const PAGES = [
  { to: "/upload", label: "Upload" },
  { to: "/questions", label: "My questions" },
  { to: "/interview", label: "Mock interview" },
];

type Resume = { id: number; filename: string; created_at: string };

const STEPS = [
  { icon: Upload, title: "Upload your resume", text: "Drop in a PDF. Every page is read." },
  { icon: ScanLine, title: "Gemini analyses it", text: "Technical, ML and behavioral questions, grouped by topic." },
  { icon: Target, title: "Practice with intent", text: "Rehearse the exact questions your resume invites." },
];

/* ---------------- helpers ---------------- */

function shouldShowIntro(): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return !sessionStorage.getItem(INTRO_KEY);
  } catch {
    return true;
  }
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * The email and first name the login token carries (the name comes from the
 * signup form or Google). Older accounts have no name; guessing one from the
 * email gave "Tanmaysraghuvanshi".
 */
function userFromToken(token: string | null): { name: string | null; email: string } {
  if (!token) return { name: null, email: "" };
  try {
    const json = atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"));
    // atob yields bytes; decode them as UTF-8 so names like "José" or "प्रिया" survive.
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0))));
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    return { name: name || null, email: String(payload.sub ?? "") };
  } catch {
    return { name: null, email: "" };
  }
}

function parseDate(iso: string): Date {
  // The API sends naive UTC timestamps, so mark them as UTC before parsing.
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

function secondsSince(iso: string): number {
  return Math.max(0, (Date.now() - parseDate(iso).getTime()) / 1000);
}

function timeAgo(iso: string): string {
  const seconds = secondsSince(iso);
  if (seconds < 60) return "just now";
  const units: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [2592000, "month"],
  ];
  let label = "minute";
  let divisor = 60;
  for (const [limit, name] of units) {
    if (seconds >= limit) {
      label = name;
      divisor = limit;
    }
  }
  const value = Math.floor(seconds / divisor);
  return `${value} ${label}${value === 1 ? "" : "s"} ago`;
}

/** Compact age for the stat grid: "now", "12m", "5h", "3d", "2mo". */
function shortAgo(iso: string): string {
  const s = secondsSince(iso);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 2592000)}mo`;
}

function uploadsThisWeek(resumes: Resume[]): number {
  return resumes.filter((r) => secondsSince(r.created_at) < 7 * 86400).length;
}

function overview(resumes: Resume[] | null, failed: boolean, latest: Resume | undefined): string {
  if (failed) return "We couldn't reach your sessions just now. Check that the backend is running, then refresh the page.";
  if (resumes === null) return "Loading your workspace and the sessions you have saved so far.";
  if (!latest) {
    return "Your workspace is ready. Upload a resume and HireMind will turn every line of it into the questions an interviewer would ask.";
  }
  const count = resumes.length === 1 ? "one resume" : `${resumes.length} resumes`;
  return `You've analysed ${count} with HireMind. The latest, ${latest.filename}, landed ${timeAgo(latest.created_at)} and its questions are waiting for you.`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/* ---------------- pieces ---------------- */

/** One headline line that slides up from behind a mask once the intro is done. */
function MaskLine({ children, ready, delay }: { children: ReactNode; ready: boolean; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <motion.span
        className="block"
        initial={reduce ? false : { y: "105%" }}
        animate={ready ? { y: "0%" } : undefined}
        transition={{ duration: 1, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** Small dark card with a white mono label bar, like cominvi's hero photo cards. */
function HeroCard({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group relative block aspect-[4/3] overflow-hidden rounded-md border border-hm-line bg-hm-block outline-none focus-visible:ring-2 focus-visible:ring-hm-accent sm:aspect-[3/2]"
    >
      <div className="absolute inset-0 flex items-center justify-center p-4 pb-11 transition-transform duration-500 group-hover:scale-[1.05]">
        {children}
      </div>
      <span
        className={`absolute inset-x-2 bottom-2 flex items-center justify-between rounded-[3px] bg-white px-1.5 py-1 text-[11px] text-[#151515] transition-colors group-hover:bg-hm-accent ${MONO}`}
      >
        {label}
        <Play size={9} fill="currentColor" strokeWidth={0} />
      </span>
    </Link>
  );
}

function StatementWord({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return <motion.span style={{ opacity }}>{children} </motion.span>;
}

/** Large statement whose words fill in as it scrolls through the viewport. */
function Statement({ text, tag }: { text: string; tag: ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 50%"] });
  const words = text.split(" ");

  return (
    <p
      ref={ref}
      className="max-w-[1120px] text-[8vw] font-medium leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-[56px]"
    >
      {tag}
      {words.map((word, i) =>
        reduce ? (
          <span key={i}>{word} </span>
        ) : (
          <StatementWord key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
            {word}
          </StatementWord>
        )
      )}
    </p>
  );
}

/* ---------------- page ---------------- */

export default function Dashboard() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [theme, setTheme] = useDocumentTheme();

  const [showIntro, setShowIntro] = useState(shouldShowIntro);
  const ready = !showIntro;

  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [failed, setFailed] = useState(false);

  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));

  const { name, email } = useMemo(() => userFromToken(token ?? localStorage.getItem("token")), [token]);
  const greeting = useMemo(() => greetingFor(new Date().getHours()), []);

  const finishIntro = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* storage can be unavailable; the intro then simply replays next visit */
    }
    setShowIntro(false);
  }, []);

  useEffect(() => {
    const authToken = token ?? localStorage.getItem("token");
    if (!authToken) return;

    const controller = new AbortController();

    fetch(`${API}/resumes`, {
      headers: { Authorization: `Bearer ${authToken}` },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logout();
          navigate("/login");
          return;
        }
        if (!res.ok) throw new Error("Request failed");
        setResumes(await res.json());
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFailed(true);
        setResumes([]);
      });

    return () => controller.abort();
  }, [token, logout, navigate]);

  const sorted = useMemo(
    () => [...(resumes ?? [])].sort((a, b) => parseDate(b.created_at).getTime() - parseDate(a.created_at).getTime()),
    [resumes]
  );
  const latest = sorted[0];
  const recent = sorted.slice(0, 6);
  const thisWeek = useMemo(() => uploadsThisWeek(resumes ?? []), [resumes]);

  const stats = [
    { icon: Files, value: resumes === null ? "--" : pad(resumes.length), label: "Resumes analysed" },
    { icon: CalendarDays, value: resumes === null ? "--" : pad(thisWeek), label: "Uploads this week" },
    { icon: Clock3, value: latest ? shortAgo(latest.created_at) : "--", label: "Since last upload" },
    { icon: Layers, value: "03", label: "Question tracks" },
  ];

  function handleSignOut() {
    logout();
    navigate("/");
  }

  return (
    <div
      data-theme={theme}
      className="min-h-svh bg-hm-bg font-['Geist',sans-serif] text-hm-ink antialiased selection:bg-hm-accent/30"
    >
      <AnimatePresence>{showIntro && <Preloader onDone={finishIntro} />}</AnimatePresence>

      {/* scroll progress */}
      <motion.div className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-hm-accent" style={{ scaleX: progress }} />

      {/* ---------------- NAV ---------------- */}
      <motion.header
        initial={reduce ? false : { y: -24, opacity: 0 }}
        animate={ready ? { y: 0, opacity: 1 } : undefined}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
          scrolled ? "border-hm-line bg-hm-bg" : "border-transparent"
        }`}
      >
        <nav aria-label="Dashboard" className="flex h-[76px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/dashboard" aria-label="HireMind dashboard">
            <Logo />
          </Link>

          <div className={`hidden items-center gap-8 text-xs md:flex ${MONO}`}>
            {PAGES.map(({ to, label }) => (
              <Link key={to} to={to} className="transition-colors hover:text-hm-accent">
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <ThemeToggle theme={theme} onChange={setTheme} />
            <span
              aria-hidden="true"
              className="hidden h-11 w-11 items-center justify-center rounded-full bg-hm-ink font-medium text-hm-bg sm:flex"
            >
              {(name ?? email).charAt(0).toUpperCase()}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className={`flex h-11 items-center gap-2 rounded-full border border-hm-line px-4 text-xs transition-colors hover:border-hm-ink ${MONO}`}
            >
              <LogOut size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </nav>
      </motion.header>

      <main>
        {/* Phones: the header's page links, just below the fixed header. */}
        <MobileNav links={PAGES} className="pt-[76px]" />

        {/* ---------------- HERO ---------------- */}
        <section className="relative flex flex-col overflow-hidden px-5 pb-6 pt-10 sm:px-8 sm:pb-8 md:min-h-[100svh] md:pt-28">
          <Tunnel />

          <div className="relative flex flex-1 flex-col justify-center gap-12 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Reveal ready={ready} y={12}>
                <SectionTag index="S.00" label="Workspace" />
              </Reveal>
              <h1 className="mt-6 text-[12.5vw] font-medium leading-[0.96] tracking-[-0.045em] sm:text-7xl lg:text-[88px]">
                <MaskLine ready={ready} delay={0.15}>
                  {greeting}
                  {name ? "," : "."}
                </MaskLine>
                {name && (
                  <MaskLine ready={ready} delay={0.25}>
                    {name}.
                  </MaskLine>
                )}
              </h1>
              <Reveal ready={ready} delay={0.45} className="mt-6 max-w-md">
                <p className="text-lg leading-relaxed text-hm-muted">
                  Let's get you ready for the next interview. Upload a resume or pick up a session below.
                </p>
              </Reveal>
            </div>

            <Reveal ready={ready} delay={0.55} className={`text-xs leading-relaxed lg:mr-[12%] ${MONO}`}>
              <div className="text-hm-muted">In your workspace</div>
              <div>
                + <Scramble text={resumes === null ? "--" : pad(resumes.length)} /> resumes analysed
              </div>
              <div className="text-hm-muted">
                Last upload {latest ? timeAgo(latest.created_at) : "--"}
              </div>
            </Reveal>
          </div>

          <Reveal ready={ready} delay={0.65} className="relative mt-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className={`hidden text-[11px] text-hm-muted sm:block ${MONO}`}>Scroll / Overview</div>
            <div className="grid grid-cols-2 gap-3 sm:w-[460px]">
              <HeroCard to="/upload" label="Upload resume">
                <ResumeArt className="aspect-[3/4] w-[36%]" />
              </HeroCard>
              <HeroCard to="/questions" label="My questions">
                <QuestionsArt className="w-[78%]" />
              </HeroCard>
            </div>
          </Reveal>
        </section>

        {/* ---------------- OVERVIEW ---------------- */}
        <section className="px-5 pb-24 pt-20 sm:px-8 sm:pb-32 sm:pt-28">
          <Statement
            text={overview(resumes, failed, latest)}
            tag={<SectionTag index="S.01" label="Overview" className="mr-5 -translate-y-[0.1em] sm:mr-8" />}
          />

          <div className="mt-20 grid gap-10 lg:mt-28 lg:grid-cols-2 lg:gap-4">
            <Link
              to="/upload"
              className="group relative block aspect-[4/3] overflow-hidden rounded-md bg-hm-block outline-none focus-visible:ring-2 focus-visible:ring-hm-accent lg:aspect-auto lg:min-h-[620px]"
            >
              <span className={`absolute left-5 top-5 text-[11px] text-hm-on-block/60 ${MONO}`}>Upload / PDF only</span>
              <div className="absolute inset-0 flex items-center justify-center">
                <ResumeArt className="aspect-[3/4] w-[32%] max-w-[220px] transition-transform duration-700 group-hover:scale-105" />
              </div>
              <span
                className={`absolute inset-x-3 bottom-3 flex items-center justify-between rounded-[3px] bg-white px-2 py-1.5 text-[11px] text-[#151515] transition-colors group-hover:bg-hm-accent ${MONO}`}
              >
                Upload a new resume
                <Play size={9} fill="currentColor" strokeWidth={0} />
              </span>
            </Link>

            <div className="flex flex-col justify-between gap-14">
              <div className="grid grid-cols-2 gap-x-4">
                {stats.map(({ icon: Icon, value, label }) => (
                  <div key={label} className="flex gap-3 border-t border-hm-line py-6 sm:gap-4">
                    <Icon className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" strokeWidth={1.1} />
                    <div className="min-w-0">
                      <div className="text-4xl font-medium leading-none tracking-[-0.04em] sm:text-5xl">
                        <Scramble text={value} />
                      </div>
                      <div className={`mt-2 text-[11px] text-hm-muted ${MONO}`}>{label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="max-w-sm lg:ml-auto lg:mr-[8%]">
                <p className="text-lg font-medium leading-snug tracking-[-0.02em]">
                  HireMind reads every page of your resume and writes technical, machine learning and behavioral
                  questions about your own work.
                </p>
                <ArrowLink to="/upload" className="mt-8">
                  Upload resume
                </ArrowLink>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- SESSIONS ---------------- */}
        <section className="bg-hm-panel px-5 py-24 sm:px-8 sm:py-32">
          <div className="mb-14 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-3xl text-[8vw] font-medium leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-[56px]">
              <SectionTag index="S.02" label="Sessions" className="mr-5 -translate-y-[0.1em] sm:mr-8" />
              Pick up where you left off.
            </h2>
            <ArrowLink to="/questions" className="self-start lg:self-auto">
              All questions
            </ArrowLink>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resumes === null &&
              [0, 1, 2].map((i) => <div key={i} className="min-h-[260px] animate-pulse rounded-md bg-hm-card" />)}

            {resumes !== null && failed && (
              <div className="rounded-md bg-hm-card p-7 sm:col-span-2 lg:col-span-3">
                <p className="text-2xl font-medium tracking-[-0.03em]">Couldn't load your sessions.</p>
                <p className="mt-2 text-hm-muted">Is the backend running? Refresh once it is.</p>
              </div>
            )}

            {resumes !== null && !failed && recent.length === 0 && (
              <div className="flex min-h-[260px] flex-col justify-between gap-8 rounded-md bg-hm-card p-7 sm:col-span-2 lg:col-span-3">
                <FileText className="h-9 w-9" strokeWidth={1.1} />
                <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-2xl font-medium tracking-[-0.03em]">No sessions yet.</p>
                    <p className="mt-2 text-hm-muted">Your uploads and their questions will show up here.</p>
                  </div>
                  <ArrowLink to="/upload">Upload resume</ArrowLink>
                </div>
              </div>
            )}

            {recent.map((r, i) => (
              <motion.div
                key={r.id}
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  to={`/questions/${r.id}`}
                  className="group flex min-h-[260px] flex-col justify-between rounded-md bg-hm-card p-7 outline-none transition-colors duration-300 hover:bg-hm-block hover:text-hm-on-block focus-visible:ring-2 focus-visible:ring-hm-accent"
                >
                  <div className="flex items-start justify-between">
                    <FileText className="h-9 w-9" strokeWidth={1.1} />
                    <span className={`text-[11px] text-hm-muted group-hover:text-hm-on-block/60 ${MONO}`}>#{pad(r.id)}</span>
                  </div>
                  <div>
                    <h3 className="line-clamp-2 break-words text-2xl font-medium leading-tight tracking-[-0.03em]">
                      {r.filename}
                    </h3>
                    <div className={`mt-4 flex items-center justify-between text-[11px] text-hm-muted group-hover:text-hm-on-block/60 ${MONO}`}>
                      <span>{timeAgo(r.created_at)}</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-hm-accent text-[#151515] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <Play size={9} fill="currentColor" strokeWidth={0} />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ---------------- TRACKS ---------------- */}
        <section className="px-5 py-24 sm:px-8 sm:py-32">
          <SectionTag index="S.03" label="Tracks" />
          <div className="mt-12">
            <TrackDial />
          </div>
        </section>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <section className="bg-hm-panel px-5 py-24 sm:px-8 sm:py-32">
          <h2 className="mb-14 max-w-3xl text-[8vw] font-medium leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-[56px]">
            <SectionTag index="S.04" label="How it works" className="mr-5 -translate-y-[0.1em] sm:mr-8" />
            Three steps from PDF to practice.
          </h2>
          <ol className="grid gap-x-4 gap-y-10 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <div className="flex aspect-[4/5] items-center justify-center rounded-md bg-hm-block">
                  <OrbitArt seconds={14 + i * 4}>
                    <Icon className="h-[34%] w-[34%]" strokeWidth={0.8} />
                  </OrbitArt>
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-4">
                  <h3 className="text-xl font-medium tracking-[-0.02em]">{title}</h3>
                  <span className={`text-[11px] text-hm-muted ${MONO}`}>Step {pad(i + 1)}</span>
                </div>
                <p className="mt-1 text-sm text-hm-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------- CTA + FOOTER ---------------- */}
        <section className="px-5 pb-8 pt-24 sm:px-8 sm:pt-36">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="text-[13vw] font-medium leading-[0.95] tracking-[-0.05em] sm:text-7xl lg:text-[104px]">
              Ready for
              <br />
              the next one?
            </h2>
            <ArrowLink to="/upload" className="self-start lg:self-auto">
              Upload resume
            </ArrowLink>
          </div>
          <footer
            className={`mt-20 flex flex-wrap justify-between gap-3 border-t border-hm-line pt-6 text-[11px] text-hm-muted ${MONO}`}
          >
            <span>HireMind © {YEAR}</span>
            <span>Powered by Gemini 2.5 Flash</span>
            <span>{theme} mode</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
