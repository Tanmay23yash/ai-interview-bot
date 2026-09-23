import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  FileText,
  Lightbulb,
  LogOut,
  MessageSquare,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import Preloader from "../components/dashboard/Preloader";
import Backdrop from "../components/dashboard/Backdrop";
import SpotlightCard from "../components/dashboard/SpotlightCard";
import { CountUp, Magnetic, Marquee, Reveal } from "../components/dashboard/motionBits";

const API = "http://127.0.0.1:8000";
const INTRO_KEY = "hiremind_intro_seen";

type Resume = { id: number; filename: string; created_at: string };

const TOPICS = [
  "Data Structures",
  "System Design",
  "Machine Learning",
  "Behavioral",
  "Python",
  "React",
  "SQL",
  "Cloud & DevOps",
  "Leadership",
  "Problem Solving",
];

const TIPS = [
  "Answer behavioral questions with the STAR method: Situation, Task, Action, Result.",
  "Think out loud. Interviewers grade your reasoning as much as your final answer.",
  "Quantify your impact. Numbers make a project on your resume memorable.",
  "Prepare two or three questions to ask back. It shows real interest in the role.",
  "Rehearse your answers out loud. Spoken practice exposes gaps that reading does not.",
];

const STEPS = [
  { icon: Upload, title: "Upload your resume", text: "Drop in a PDF. We read every project and skill." },
  { icon: Brain, title: "Gemini analyses it", text: "Tailored technical, ML and behavioral questions." },
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

/** Reads the email out of the JWT and turns it into a friendly first name. */
function nameFromToken(token: string | null): string {
  if (!token) return "there";
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const local = String(payload.sub ?? "").split("@")[0];
    const first = local.split(/[._-]/)[0].replace(/[^a-zA-Z]/g, "");
    if (!first) return "there";
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  } catch {
    return "there";
  }
}

function parseDate(iso: string): Date {
  // The API sends naive UTC timestamps, so mark them as UTC before parsing.
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - parseDate(iso).getTime()) / 1000);
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

/* ---------------- small pieces ---------------- */

function Word({ children, ready, index, className = "" }: { children: string; ready: boolean; index: number; className?: string }) {
  return (
    <span className="mr-[0.25em] inline-block overflow-hidden pb-[0.12em] align-bottom">
      <motion.span
        className={`inline-block ${className}`}
        initial={{ y: "115%", rotate: 4 }}
        animate={ready ? { y: 0, rotate: 0 } : undefined}
        transition={{ duration: 1, delay: 0.15 + index * 0.09, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}

function ResumeIllustration() {
  const reduce = useReducedMotion();
  const line = "h-2 rounded-full bg-white/10";

  return (
    <div className="relative mx-auto h-56 w-44 sm:h-64 sm:w-52" aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-violet-500/30 blur-[70px]" />

      <motion.div
        className="absolute inset-0 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-zinc-800/90 to-zinc-900/90 p-4 shadow-2xl shadow-violet-900/40"
        animate={reduce ? undefined : { y: [0, -10, 0], rotate: [-3, -1, -3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ rotate: -3 }}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2 w-2/3 rounded-full bg-white/25" />
            <div className="h-1.5 w-1/2 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="space-y-2.5">
          <div className={`${line} w-full`} />
          <div className={`${line} w-11/12`} />
          <div className={`${line} w-4/5`} />
          <div className="h-2 w-1/3 rounded-full bg-violet-400/40" />
          <div className={`${line} w-full`} />
          <div className={`${line} w-3/4`} />
          <div className={`${line} w-5/6`} />
          <div className={`${line} w-2/3`} />
        </div>

        {/* scanning beam */}
        {!reduce && (
          <motion.div
            className="absolute inset-x-0 h-14 bg-gradient-to-b from-transparent via-violet-400/30 to-transparent"
            animate={{ top: ["-20%", "110%"] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }}
          />
        )}
      </motion.div>

      <motion.div
        className="absolute -right-6 top-6 flex items-center gap-1.5 rounded-full border border-white/15 bg-zinc-900/90 px-3 py-1.5 text-[11px] font-medium text-violet-200 shadow-lg backdrop-blur"
        animate={reduce ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      >
        <Sparkles className="h-3 w-3" /> 12 questions
      </motion.div>
      <motion.div
        className="absolute -left-8 bottom-10 flex items-center gap-1.5 rounded-full border border-white/15 bg-zinc-900/90 px-3 py-1.5 text-[11px] font-medium text-cyan-200 shadow-lg backdrop-blur"
        animate={reduce ? undefined : { y: [0, 9, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Target className="h-3 w-3" /> Tailored to you
      </motion.div>
    </div>
  );
}

function TipCard() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % TIPS.length), 6000);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="flex h-full flex-col p-7">
      <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-amber-300/80">
        <Lightbulb className="h-4 w-4" /> Interview tip
      </div>

      <div className="min-h-[5.5rem] flex-1">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-lg font-light leading-relaxed text-zinc-200"
          >
            {TIPS[index]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-5 flex gap-1.5">
        {TIPS.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show tip ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1 rounded-full transition-all duration-500 ${
              i === index ? "w-8 bg-amber-300" : "w-3 bg-white/15 hover:bg-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function Dashboard() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [showIntro, setShowIntro] = useState(shouldShowIntro);
  const ready = !showIntro;

  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [failed, setFailed] = useState(false);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  const name = useMemo(() => nameFromToken(token ?? localStorage.getItem("token")), [token]);
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
          navigate("/");
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

  const recent = useMemo(
    () =>
      [...(resumes ?? [])]
        .sort((a, b) => parseDate(b.created_at).getTime() - parseDate(a.created_at).getTime())
        .slice(0, 4),
    [resumes]
  );

  function handleSignOut() {
    logout();
    navigate("/");
  }


  return (
    <div className="relative min-h-screen bg-[#07070b] font-['Outfit',sans-serif] text-white selection:bg-violet-500/40">
      <AnimatePresence>{showIntro && <Preloader onDone={finishIntro} />}</AnimatePresence>

      <Backdrop />

      {/* scroll progress */}
      <motion.div
        className="fixed left-0 right-0 top-0 z-50 h-[2px] origin-left bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-300"
        style={{ scaleX: progress }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        {/* ---------------- NAV ---------------- */}
        <motion.header
          initial={reduce ? false : { y: -40, opacity: 0 }}
          animate={ready ? { y: 0, opacity: 1 } : undefined}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="sticky top-4 z-40 mt-4"
        >
          <nav className="flex items-center justify-between rounded-full border border-white/10 bg-zinc-900/60 py-2 pl-5 pr-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <Link to="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
                <Sparkles className="h-4 w-4" />
              </span>
              HireMind
            </Link>

            <div className="hidden items-center gap-1 text-sm text-zinc-400 sm:flex">
              <Link to="/upload" className="rounded-full px-4 py-2 transition hover:bg-white/5 hover:text-white">
                Upload
              </Link>
              <Link to="/questions" className="rounded-full px-4 py-2 transition hover:bg-white/5 hover:text-white">
                My questions
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/80 to-cyan-400/80 text-sm font-semibold"
                aria-hidden="true"
              >
                {name.charAt(0)}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </nav>
        </motion.header>

        {/* ---------------- HERO ---------------- */}
        <section className="pb-14 pt-16 sm:pt-24">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-zinc-300 backdrop-blur"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="max-w-[16rem] truncate">
              {greeting}, {name}
            </span>
          </motion.div>

          <h1
            className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tighter sm:text-7xl lg:text-8xl"
            aria-label="Ace your next interview."
          >
            <Word ready={ready} index={0}>Ace</Word>
            <Word ready={ready} index={1}>your</Word>
            <Word ready={ready} index={2}>next</Word>
            <Word
              ready={ready}
              index={3}
              className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent"
            >
              interview.
            </Word>
          </h1>

          <Reveal ready={ready} delay={0.7} className="mt-8 max-w-xl">
            <p className="text-lg font-light leading-relaxed text-zinc-400 sm:text-xl">
              Turn your resume into a personal question bank. Practice exactly what interviewers will ask you.
            </p>
          </Reveal>

          <Reveal ready={ready} delay={0.85} className="mt-10 flex flex-wrap items-center gap-4">
            <Magnetic>
              <button
                onClick={() => navigate("/upload")}
                className="group flex items-center gap-3 rounded-full bg-white px-7 py-4 font-semibold text-black shadow-[0_0_40px_-8px_rgba(255,255,255,0.5)] transition hover:shadow-[0_0_60px_-6px_rgba(167,139,250,0.8)]"
              >
                <Upload className="h-5 w-5" />
                Upload resume
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </Magnetic>
            <Magnetic>
              <button
                onClick={() => navigate("/questions")}
                className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-7 py-4 font-medium text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
              >
                <MessageSquare className="h-5 w-5" />
                View questions
              </button>
            </Magnetic>
          </Reveal>
        </section>

        {/* ---------------- TICKER ---------------- */}
        <Reveal ready={ready} delay={1} y={16} className="mb-14 border-y border-white/5 py-5">
          <Marquee>
            {TOPICS.map((topic) => (
              <span key={topic} className="flex items-center text-lg font-light text-zinc-500">
                <span className="px-6">{topic}</span>
                <Sparkles className="h-3.5 w-3.5 text-violet-400/60" />
              </span>
            ))}
          </Marquee>
        </Reveal>

        {/* ---------------- BENTO GRID ---------------- */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Upload */}
          <Reveal ready={ready} className="lg:col-span-7 lg:row-span-2">
            <SpotlightCard
              onClick={() => navigate("/upload")}
              label="Upload a resume"
              className="h-full min-h-[26rem]"
            >
              <div className="flex h-full flex-col justify-between gap-8 p-8 sm:p-10">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-200">
                    <Upload className="h-3.5 w-3.5" /> Start here
                  </div>
                  <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Drop in a resume.
                    <br />
                    <span className="text-zinc-500">Get your questions.</span>
                  </h2>
                </div>

                <ResumeIllustration />

                <div className="flex items-center justify-between text-sm text-zinc-400">
                  <span>PDF only, results in seconds</span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition-transform duration-300 group-hover:rotate-45">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </div>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* Stats */}
          <Reveal ready={ready} delay={0.1} className="lg:col-span-5">
            <SpotlightCard className="h-full">
              <div className="flex h-full flex-col justify-between p-7">
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                  Your progress
                </div>
                <div className="my-4 flex items-end gap-4">
                  <span className="bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-7xl font-semibold leading-none tracking-tighter text-transparent">
                    {resumes === null ? "–" : <CountUp value={resumes.length} />}
                  </span>
                  <span className="pb-2 text-zinc-400">
                    {resumes?.length === 1 ? "resume analysed" : "resumes analysed"}
                  </span>
                </div>
                <p className="text-sm text-zinc-500">
                  {resumes === null
                    ? "Loading your activity..."
                    : recent.length > 0
                      ? `Last upload ${timeAgo(recent[0].created_at)}`
                      : "Upload your first resume to get started"}
                </p>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* Recent */}
          <Reveal ready={ready} delay={0.2} className="lg:col-span-5">
            <SpotlightCard className="h-full">
              <div className="p-7">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                    Recent sessions
                  </span>
                  <Link to="/questions" className="text-xs text-zinc-400 transition hover:text-white">
                    View all
                  </Link>
                </div>

                {resumes === null && (
                  <div className="space-y-3" aria-label="Loading recent sessions">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
                    ))}
                  </div>
                )}

                {resumes !== null && failed && (
                  <p className="py-6 text-center text-sm text-zinc-500">
                    Couldn't load your sessions. Is the backend running?
                  </p>
                )}

                {resumes !== null && !failed && recent.length === 0 && (
                  <p className="py-6 text-center text-sm text-zinc-500">
                    Nothing here yet. Your uploads will show up here.
                  </p>
                )}

                <ul className="space-y-1.5">
                  {recent.map((r, i) => (
                    <motion.li
                      key={r.id}
                      initial={reduce ? false : { opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
                    >
                      <button
                        onClick={() => navigate(`/questions/${r.id}`)}
                        className="group/row flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-violet-300">
                          <FileText className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-zinc-100">{r.filename}</span>
                          <span className="block text-xs text-zinc-500">{timeAgo(r.created_at)}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 -translate-x-2 text-zinc-500 opacity-0 transition-all group-hover/row:translate-x-0 group-hover/row:opacity-100" />
                      </button>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* How it works */}
          <Reveal ready={ready} className="lg:col-span-7">
            <SpotlightCard className="h-full">
              <div className="p-8">
                <div className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                  How it works
                </div>
                <ol className="relative space-y-6">
                  <span className="absolute bottom-5 left-[19px] top-5 w-px bg-gradient-to-b from-violet-500/60 via-fuchsia-500/30 to-transparent" />
                  {STEPS.map(({ icon: Icon, title, text }, i) => (
                    <motion.li
                      key={title}
                      initial={reduce ? false : { opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ delay: i * 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className="relative flex items-start gap-5"
                    >
                      <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-violet-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="pt-1">
                        <h3 className="font-medium text-zinc-100">
                          <span className="mr-2 font-mono text-xs text-zinc-600">0{i + 1}</span>
                          {title}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500">{text}</p>
                      </div>
                    </motion.li>
                  ))}
                </ol>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* Tip */}
          <Reveal ready={ready} delay={0.1} className="lg:col-span-5">
            <SpotlightCard className="h-full">
              <TipCard />
            </SpotlightCard>
          </Reveal>
        </div>

        <Reveal ready={ready} y={12} className="mt-16 text-center text-xs text-zinc-600">
          Built with care to help you land the role. Powered by Gemini.
        </Reveal>
      </div>
    </div>
  );
}
