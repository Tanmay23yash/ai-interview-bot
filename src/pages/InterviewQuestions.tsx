import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { useEffect, useMemo, useRef, useState, isValidElement } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../lib/api";
import { parseDate } from "../lib/interview";
import { ArrowLeft, ArrowUpRight, X, Trash2, Copy, Check } from "lucide-react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useMotionTemplate,
  useSpring,
  useScroll,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import type { MotionValue, PanInfo } from "framer-motion";

/* ---------------- TYPES ---------------- */

type Resume = {
  id: number;
  filename: string;
  created_at: string;
  questions: string;
};

/* ---------------- CONSTANTS & HELPERS ---------------- */

const API = API_URL;
const ACCENT = "#D7FF3A";
const EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];
const MARQUEE = ["Read it out loud", "Answer with STAR", "Time yourself", "Practice before it counts", "Questions in, offers out"];
const NOISE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";

const pad = (n: number) => String(n).padStart(2, "0");
const stripExt = (name: string) => name.replace(/\.pdf$/i, "");
// The API sends naive UTC timestamps; parseDate marks them as UTC.
const fmtDate = (d: string) =>
  parseDate(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (d: string) =>
  parseDate(d).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";

/** Flattens rendered markdown children back to plain text (used for heading ids). */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

/* ---------------- ANIMATIONS (kept GPU-friendly) ---------------- */

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

const sidebarVariants: Variants = {
  hidden: { x: "-100%" },
  visible: { x: "0%", transition: { type: "spring", stiffness: 300, damping: 32, mass: 0.8 } },
  exit: { x: "-100%", transition: { type: "spring", stiffness: 300, damping: 32 } },
};

const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.035, delayChildren: 0.12 } },
};

const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE } },
};

/* ---------------- SMALL PIECES ---------------- */

/** Text that rolls up to a duplicate of itself on parent `group` hover. */
function RollText({ children }: { children: string }) {
  const t = "block transition-transform duration-500 ease-[cubic-bezier(.76,0,.24,1)] group-hover:-translate-y-full";
  return (
    <span className="relative block overflow-hidden leading-tight">
      <span className={t}>{children}</span>
      <span aria-hidden className={`absolute left-0 top-full ${t}`}>
        {children}
      </span>
    </span>
  );
}

function LocalTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="tabular-nums">
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
    </span>
  );
}

/** Dot + trailing ring. Grows over buttons, shows a label over [data-cursor] elements. */
function Cursor({ x, y, visible }: { x: MotionValue<number>; y: MotionValue<number>; visible: boolean }) {
  const rx = useSpring(x, { stiffness: 300, damping: 28, mass: 0.5 });
  const ry = useSpring(y, { stiffness: 300, damping: 28, mass: 0.5 });
  const [hovering, setHovering] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const over = (e: PointerEvent) => {
      const el = e.target as Element | null;
      setLabel(el?.closest("[data-cursor]")?.getAttribute("data-cursor") || null);
      setHovering(!!el?.closest("a, button:not(:disabled), [data-cursor]"));
    };
    window.addEventListener("pointerover", over);
    return () => window.removeEventListener("pointerover", over);
  }, []);

  const size = label ? 84 : hovering ? 56 : 30;

  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] grid place-items-center rounded-full border"
        style={{ x: rx, y: ry, translateX: "-50%", translateY: "-50%" }}
        animate={{
          width: size,
          height: size,
          opacity: visible ? 1 : 0,
          backgroundColor: label ? ACCENT : "rgba(215,255,58,0)",
          borderColor: label ? ACCENT : "rgba(237,237,232,0.45)",
        }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
      >
        <AnimatePresence>
          {label && (
            <motion.span
              key={label}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              className="ur-mono text-[10px] uppercase tracking-[0.16em] text-[#0A0A0A]"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[101] h-1.5 w-1.5 rounded-full bg-[#EDEDE8]"
        style={{ x, y, translateX: "-50%", translateY: "-50%", opacity: visible && !label ? 1 : 0 }}
      />
    </>
  );
}

/** Button that drifts toward the pointer. */
function MagneticButton({ children, onClick, className = "" }: { children: ReactNode; onClick: () => void; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.6 });

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      onPointerMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.2);
        y.set((e.clientY - r.top - r.height / 2) * 0.35);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ x: sx, y: sy }}
      className={`group ${className}`}
    >
      {children}
    </motion.button>
  );
}

/* ---------------- MARKDOWN STYLING ---------------- */

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-10 text-3xl font-medium tracking-[-0.03em] text-[#EDEDE8] md:text-4xl">{children}</h1>
  ),
  h2: ({ children }) => {
    const id = slugify(textOf(children));
    return (
      <h2 id={id} data-section={id} className="ur-sec mb-6 mt-20 scroll-mt-28 border-t border-white/10 pt-6 first:mt-0">
        <span className="ur-sec-n ur-mono mb-4 block text-[11px] uppercase tracking-[0.2em] text-[#D7FF3A]" />
        <span className="block text-[clamp(1.75rem,3.2vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.03em] text-[#EDEDE8]">
          {children}
        </span>
      </h2>
    );
  },
  h3: ({ children }) => (
    <h3 className="mb-3 mt-10 flex items-baseline gap-3 text-lg font-medium text-[#EDEDE8]">
      <span className="ur-mono text-xs text-zinc-600">—</span>
      {children}
    </h3>
  ),
  ul: ({ children }) => <ul className="my-6 list-none divide-y divide-white/[0.06] border-y border-white/[0.06] p-0">{children}</ul>,
  ol: ({ children }) => <ol className="my-6 list-none divide-y divide-white/[0.06] border-y border-white/[0.06] p-0">{children}</ol>,
  li: ({ children }) => (
    <li className="ur-q group grid grid-cols-[3.5rem_1fr] gap-4 py-5">
      <span className="ur-q-n ur-mono pt-1 text-[11px] tracking-[0.12em] text-zinc-600 transition-colors duration-300 group-hover:text-[#D7FF3A]" />
      <div className="min-w-0 text-[1.0625rem] leading-relaxed text-zinc-300 transition-colors duration-300 group-hover:text-[#EDEDE8] [&_p]:mb-0">
        {children}
      </div>
    </li>
  ),
  p: ({ children }) => <p className="mb-6 leading-relaxed text-zinc-400">{children}</p>,
  strong: ({ children }) => <strong className="font-medium text-[#EDEDE8]">{children}</strong>,
  em: ({ children }) => <em className="ur-serif text-[1.1em] italic text-[#EDEDE8]">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[#D7FF3A] underline decoration-[#D7FF3A]/40 underline-offset-4 transition-colors hover:decoration-[#D7FF3A]"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-8 border-l-2 border-[#D7FF3A] pl-6 text-zinc-400 [&_p]:mb-2">{children}</blockquote>
  ),
  hr: () => <hr className="my-14 border-white/10" />,
  code: ({ children }) => (
    <code className="ur-mono rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[0.85em] text-[#D7FF3A]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="ur-mono my-6 overflow-x-auto rounded-xl border border-white/10 bg-[#111] p-5 text-sm text-zinc-300 [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
      {children}
    </pre>
  ),
};

/* ---------------- COMPONENT ---------------- */

export default function InterviewQuestions() {
  const navigate = useNavigate();
  const { resumeId } = useParams();
  const token = localStorage.getItem("token");
  const reduce = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [active, setActive] = useState<Resume | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [finePointer, setFinePointer] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);

  // Pointer + scroll motion
  const px = useMotionValue(typeof window !== "undefined" ? window.innerWidth / 2 : 0);
  const py = useMotionValue(typeof window !== "undefined" ? window.innerHeight / 2 : 0);
  const spotlight = useMotionTemplate`radial-gradient(560px circle at ${px}px ${py}px, rgba(215,255,58,0.06), transparent 70%)`;
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });
  const customCursor = finePointer && !reduce;

  useEffect(() => {
    setFinePointer(window.matchMedia("(pointer: fine)").matches);
  }, []);

  /* ---------------- FETCHES ---------------- */

  useEffect(() => {
    const ctrl = new AbortController();
    setListLoading(true);
    fetch(`${API}/resumes`, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Couldn't load your history"))))
      .then((data) => setResumes(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setListLoading(false);
      });
    return () => ctrl.abort();
  }, [token]);

  useEffect(() => {
    if (!resumeId) {
      setActive(null);
      setError("");
      return;
    }
    const ctrl = new AbortController();
    setActiveLoading(true);
    setError("");
    window.scrollTo({ top: 0 });
    fetch(`${API}/resumes/${resumeId}`, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("We couldn't open that résumé."))))
      .then((data: Resume) => setActive(data))
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error(err);
        setActive(null);
        setError(err.message || "Something went wrong.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setActiveLoading(false);
      });
    return () => ctrl.abort();
  }, [resumeId, token]);

  /* ---------------- DRAWER BEHAVIOUR ---------------- */

  useEffect(() => {
    if (!open) {
      setConfirmId(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -100 || info.velocity.x < -500) setOpen(false);
  };

  /* ---------------- HANDLERS ---------------- */

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      const res = await fetch(`${API}/resumes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      setResumes((prev) => prev.filter((r) => r.id !== id));
      if (active?.id === id) {
        setActive(null);
        navigate("/questions");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  async function copyAll() {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.questions);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error(err);
    }
  }

  /* ---------------- DERIVED ---------------- */

  const sections = useMemo(() => {
    const md = active?.questions ?? "";
    return md
      .split("\n")
      .filter((l) => /^##\s+/.test(l))
      .map((l) => {
        const text = l.replace(/^##\s+/, "").replace(/[*_`#]/g, "").trim();
        return { text, id: slugify(text) };
      });
  }, [active]);

  const questionCount = useMemo(
    () => (active?.questions ?? "").split("\n").filter((l) => /^\s*([-*+]|\d+\.)\s+/.test(l)).length,
    [active]
  );

  // Highlight the section currently in view (waits for the page transition to finish)
  useEffect(() => {
    if (!active) return;
    let io: IntersectionObserver | undefined;
    const t = setTimeout(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-section]"));
      if (!els.length) return;
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) setCurrentSection((en.target as HTMLElement).dataset.section ?? null);
          });
        },
        { rootMargin: "-20% 0px -70% 0px" }
      );
      els.forEach((el) => io!.observe(el));
    }, 700);
    return () => {
      clearTimeout(t);
      io?.disconnect();
    };
  }, [active]);

  const view = activeLoading ? "loading" : active ? "content" : "empty";

  const reveal = (i: number, base = 0.5) => ({
    initial: reduce ? false : { y: "110%" },
    animate: { y: "0%" },
    transition: { duration: 1.05, ease: EASE, delay: base + i * 0.09 },
  });
  const fadeUp = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, ease: EASE, delay },
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        .ur-sans  { font-family: 'Inter Tight', ui-sans-serif, system-ui, sans-serif; }
        .ur-serif { font-family: 'Instrument Serif', ui-serif, Georgia, serif; }
        .ur-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .ur-root ::selection { background: ${ACCENT}; color: #0A0A0A; }
        .ur-md { counter-reset: sec q; }
        .ur-sec { counter-increment: sec; }
        .ur-sec-n::before { content: "§ " counter(sec, decimal-leading-zero); }
        .ur-q { counter-increment: q; }
        .ur-q-n::before { content: "Q." counter(q, decimal-leading-zero); }
        @keyframes ur-marquee { to { transform: translateX(-50%); } }
        @keyframes ur-grain {
          0%,100% { transform: translate(0,0); } 20% { transform: translate(-3%,2%); }
          40% { transform: translate(2%,-3%); } 60% { transform: translate(-2%,-1%); } 80% { transform: translate(3%,3%); }
        }
        .ur-marquee { animation: ur-marquee 38s linear infinite; }
        .ur-grain { animation: ur-grain 0.9s steps(4) infinite; }
        .ur-scroll::-webkit-scrollbar { width: 6px; }
        .ur-scroll::-webkit-scrollbar-track { background: transparent; }
        .ur-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .ur-scroll::-webkit-scrollbar-thumb:hover { background: ${ACCENT}; }
        @media (prefers-reduced-motion: reduce) {
          .ur-marquee, .ur-grain { animation: none; }
        }
      `}</style>

      <div
        className={`ur-root ur-sans relative flex min-h-screen flex-col overflow-x-hidden bg-[#0A0A0A] text-[#EDEDE8] ${
          customCursor ? "cursor-none [&_*]:!cursor-none" : ""
        }`}
        onPointerMove={(e) => {
          px.set(e.clientX);
          py.set(e.clientY);
          if (!cursorVisible) setCursorVisible(true);
        }}
        onPointerLeave={() => setCursorVisible(false)}
      >
        {customCursor && <Cursor x={px} y={py} visible={cursorVisible} />}

        {/* Intro curtain */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[90] origin-top bg-[#D7FF3A]"
            initial={{ scaleY: 1 }}
            animate={{ scaleY: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
          />
        )}

        {/* Background: column grid, cursor spotlight, film grain */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px)",
              backgroundSize: "calc(100% / 6) 100%",
            }}
          />
          <motion.div className="absolute inset-0" style={{ background: spotlight }} />
          <div className="ur-grain absolute -inset-[50%] opacity-[0.08]" style={{ backgroundImage: `url("${NOISE}")` }} />
        </div>

        {/* --- HISTORY DRAWER --- */}
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                variants={backdropVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-40 bg-black/75"
              />

              <motion.aside
                role="dialog"
                aria-modal="true"
                aria-label="Résumé history"
                variants={sidebarVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.15, right: 0 }}
                onDragEnd={handleDragEnd}
                className="fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-[420px] flex-col border-r border-white/10 bg-[#0E0E0E] will-change-transform"
              >
                <div className="flex items-start justify-between border-b border-white/[0.06] p-6">
                  <div>
                    <div className="ur-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                      Archive · {pad(resumes.length)}
                    </div>
                    <h2 className="ur-serif mt-2 text-5xl italic leading-none">History</h2>
                  </div>
                  <button
                    type="button"
                    aria-label="Close history"
                    onClick={() => setOpen(false)}
                    className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-zinc-400 transition-all duration-500 hover:rotate-90 hover:border-[#D7FF3A] hover:text-[#D7FF3A]"
                  >
                    <X size={16} />
                  </button>
                </div>

                <motion.ul
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="visible"
                  className="ur-scroll flex-1 overflow-y-auto"
                >
                  {listLoading &&
                    [0, 1, 2, 3].map((i) => (
                      <li key={i} className="flex items-center gap-4 border-b border-white/[0.06] px-6 py-6">
                        <div className="h-2.5 w-5 rounded bg-white/5" />
                        <div className="h-4 flex-1 animate-pulse rounded bg-white/[0.06]" />
                      </li>
                    ))}

                  {!listLoading && resumes.length === 0 && (
                    <li className="px-6 py-10 text-sm text-zinc-500">Nothing here yet. Upload a résumé to get started.</li>
                  )}

                  {resumes.map((r, i) => {
                    const isActive = active?.id === r.id;
                    return (
                      <motion.li key={r.id} variants={listItemVariants} className="group relative border-b border-white/[0.06]">
                        {isActive && (
                          <motion.span
                            layoutId="active-bar"
                            className="absolute inset-y-0 left-0 w-[3px] bg-[#D7FF3A]"
                            transition={{ type: "spring", stiffness: 400, damping: 35 }}
                          />
                        )}

                        <AnimatePresence mode="wait" initial={false}>
                          {confirmId === r.id ? (
                            <motion.div
                              key="confirm"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="flex items-center justify-between gap-3 bg-[#FF6B5B]/[0.06] px-6 py-5"
                            >
                              <span className="min-w-0 truncate text-sm text-zinc-300">
                                Delete <span className="text-[#EDEDE8]">{stripExt(r.filename)}</span>?
                              </span>
                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setConfirmId(null)}
                                  className="ur-mono rounded-full border border-white/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:text-white"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(r.id)}
                                  disabled={deletingId === r.id}
                                  className="ur-mono rounded-full bg-[#FF6B5B] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[#0A0A0A] disabled:opacity-60"
                                >
                                  {deletingId === r.id ? "Deleting" : "Delete"}
                                </button>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="row"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="flex items-center"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  navigate(`/questions/${r.id}`);
                                  setOpen(false);
                                }}
                                className={`grid min-w-0 flex-1 grid-cols-[2rem_1fr] items-baseline gap-3 py-5 pl-6 text-left transition-colors ${
                                  isActive ? "text-[#EDEDE8]" : "text-zinc-400 hover:text-[#EDEDE8]"
                                }`}
                              >
                                <span className={`ur-mono text-[10px] ${isActive ? "text-[#D7FF3A]" : "text-zinc-600"}`}>
                                  {pad(i + 1)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-base font-medium">{stripExt(r.filename)}</span>
                                  <span className="ur-mono mt-1 block text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                                    {fmtDate(r.created_at)}
                                  </span>
                                </span>
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${r.filename}`}
                                onClick={() => setConfirmId(r.id)}
                                className="mr-4 grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-600 transition-all hover:bg-[#FF6B5B]/10 hover:text-[#FF6B5B] focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                              >
                                <Trash2 size={15} />
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.li>
                    );
                  })}
                </motion.ul>

                <div className="ur-mono border-t border-white/[0.06] px-6 py-4 text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                  Drag left or press Esc to close
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* --- TOP BAR --- */}
        <motion.header {...fadeUp(0.35)} className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0A0A0A]/90">
          <div className="flex items-center justify-between px-5 py-4 md:px-10">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="ur-mono group flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:text-white"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full border border-white/15 transition-all duration-300 group-hover:border-[#D7FF3A] group-hover:bg-[#D7FF3A] group-hover:text-[#0A0A0A]">
                <ArrowLeft size={14} />
              </span>
              <span className="hidden sm:block">
                <RollText>Dashboard</RollText>
              </span>
            </button>

            <div className="ur-mono hidden items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500 md:flex">
              Interview prep <span className="text-zinc-700">/</span> <span className="text-zinc-300">Questions</span>
            </div>

            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="ur-mono group flex items-center gap-3 rounded-full border border-white/15 py-1.5 pl-4 pr-1.5 text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:border-[#D7FF3A]"
              >
                <RollText>History</RollText>
                <span className="grid h-7 min-w-[1.75rem] place-items-center rounded-full bg-[#D7FF3A] px-2 text-[10px] tabular-nums text-[#0A0A0A]">
                  {pad(resumes.length)}
                </span>
              </button>
              <div className="ur-mono hidden items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-zinc-400 lg:flex">
                <span className="text-zinc-600">Local</span>
                <LocalTime />
              </div>
            </div>
          </div>

          {/* Reading progress */}
          {view === "content" && (
            <motion.div className="absolute -bottom-px left-0 right-0 h-px origin-left bg-[#D7FF3A]" style={{ scaleX: progress }} />
          )}
        </motion.header>

        {/* --- MAIN --- */}
        <main className="relative z-10 flex-1">
          <AnimatePresence mode="wait">
            {view === "loading" && (
              <motion.section
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                className="px-5 pt-12 md:px-10 lg:pt-16"
              >
                <div className="ur-mono mb-8 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-[#D7FF3A]">
                  <span className="h-3 w-1.5 animate-pulse bg-[#D7FF3A]" />
                  Opening résumé
                </div>
                <div className="h-[clamp(2.5rem,6vw,6rem)] w-2/3 animate-pulse rounded-xl bg-white/[0.05]" />
                <div className="mt-16 max-w-3xl space-y-5 border-t border-white/10 pt-12 lg:ml-[25%]">
                  {[90, 76, 84, 60, 72].map((w, i) => (
                    <div key={i} className="h-4 animate-pulse rounded bg-white/[0.05]" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </motion.section>
            )}

            {view === "empty" && (
              <motion.section
                key="empty"
                exit={{ opacity: 0, y: -12, transition: { duration: 0.25 } }}
                className="px-5 py-14 md:px-10 lg:py-20"
              >
                <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
                  {/* Left: intro */}
                  <div className="lg:col-span-6">
                    <motion.div
                      {...fadeUp(0.5)}
                      className="ur-mono mb-8 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D7FF3A] opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D7FF3A]" />
                      </span>
                      Archive
                      <span className="text-zinc-700">·</span>
                      {pad(resumes.length)} résumés
                    </motion.div>

                    <h1 className="text-[clamp(3rem,6.5vw,6.75rem)] font-medium leading-[0.92] tracking-[-0.045em]">
                      <span className="block overflow-hidden pb-[0.06em]">
                        <motion.span className="block" {...reveal(0)}>
                          Pick a résumé,
                        </motion.span>
                      </span>
                      <span className="block overflow-hidden pb-[0.1em]">
                        <motion.span className="block" {...reveal(1)}>
                          <em className="ur-serif pr-[0.06em] font-normal italic tracking-[-0.02em] text-[#D7FF3A]">start</em>{" "}
                          practising.
                        </motion.span>
                      </span>
                    </h1>

                    <motion.p {...fadeUp(0.75)} className="mt-8 max-w-md text-lg leading-relaxed text-zinc-400">
                      Every résumé you upload is kept here with its questions. Open one to review it and rehearse your
                      answers.
                    </motion.p>

                    {error && (
                      <div role="alert" className="ur-mono mt-6 flex items-start gap-3 text-xs text-[#FF6B5B]">
                        <span className="shrink-0 rounded border border-[#FF6B5B]/40 px-1.5 py-0.5 text-[10px] tracking-[0.15em]">
                          ERR
                        </span>
                        <span className="pt-0.5 leading-relaxed">{error}</span>
                      </div>
                    )}

                    <motion.div {...fadeUp(0.9)}>
                      <MagneticButton
                        onClick={() => (resumes.length ? setOpen(true) : navigate("/dashboard"))}
                        className="mt-10 flex h-14 items-center gap-6 rounded-full bg-[#D7FF3A] pl-7 pr-1.5 text-base font-medium text-[#0A0A0A]"
                      >
                        <RollText>{resumes.length ? "Open history" : "Back to dashboard"}</RollText>
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-[#0A0A0A] text-[#D7FF3A] transition-transform duration-500 ease-[cubic-bezier(.76,0,.24,1)] group-hover:rotate-45">
                          <ArrowUpRight size={18} />
                        </span>
                      </MagneticButton>
                    </motion.div>
                  </div>

                  {/* Right: recent résumés */}
                  <motion.div {...fadeUp(0.65)} className="lg:col-span-6 lg:pt-4">
                    <div className="ur-mono mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-zinc-600">
                      <span>Recent</span>
                      {resumes.length > 6 && (
                        <button type="button" onClick={() => setOpen(true)} className="group text-zinc-400 hover:text-[#D7FF3A]">
                          <RollText>{`View all ${resumes.length}`}</RollText>
                        </button>
                      )}
                    </div>

                    <ul className="border-t border-white/10">
                      {listLoading &&
                        [0, 1, 2].map((i) => (
                          <li key={i} className="flex items-center gap-6 border-b border-white/10 py-7">
                            <div className="h-2.5 w-6 rounded bg-white/5" />
                            <div className="h-6 flex-1 animate-pulse rounded bg-white/[0.06]" />
                          </li>
                        ))}

                      {!listLoading && resumes.length === 0 && (
                        <li className="border-b border-white/10 py-10 text-zinc-500">
                          Nothing here yet. Upload a résumé from your dashboard to get started.
                        </li>
                      )}

                      {!listLoading &&
                        resumes.slice(0, 6).map((r, i) => (
                          <motion.li
                            key={r.id}
                            initial={reduce ? false : { opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease: EASE, delay: 0.7 + i * 0.06 }}
                            className="border-b border-white/10"
                          >
                            <button
                              type="button"
                              data-cursor="Open"
                              onClick={() => navigate(`/questions/${r.id}`)}
                              className="group relative grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-4 overflow-hidden py-6 text-left"
                            >
                              <span className="absolute inset-0 origin-bottom scale-y-0 bg-white/[0.03] transition-transform duration-500 ease-[cubic-bezier(.76,0,.24,1)] group-hover:scale-y-100" />
                              <span className="ur-mono relative pl-1 text-[11px] text-zinc-600">{pad(i + 1)}</span>
                              <span className="relative min-w-0">
                                <span className="block truncate text-xl font-medium tracking-tight text-zinc-300 transition-all duration-500 ease-[cubic-bezier(.76,0,.24,1)] group-hover:translate-x-2 group-hover:text-[#EDEDE8] md:text-2xl">
                                  {stripExt(r.filename)}
                                </span>
                                <span className="ur-mono mt-1 block text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                                  {fmtDate(r.created_at)}
                                </span>
                              </span>
                              <span className="relative mr-2 grid h-10 w-10 place-items-center rounded-full border border-white/15 text-zinc-400 transition-all duration-500 group-hover:rotate-45 group-hover:border-[#D7FF3A] group-hover:bg-[#D7FF3A] group-hover:text-[#0A0A0A]">
                                <ArrowUpRight size={16} />
                              </span>
                            </button>
                          </motion.li>
                        ))}
                    </ul>
                  </motion.div>
                </div>
              </motion.section>
            )}

            {view === "content" && active && (
              <motion.section
                key={`r-${active.id}`}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                className="px-5 pb-24 pt-12 md:px-10 lg:pt-16"
              >
                {/* Hero */}
                <motion.div
                  {...fadeUp(0.35)}
                  className="ur-mono mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500"
                >
                  <span className="rounded-full border border-[#D7FF3A]/40 px-2.5 py-1 text-[#D7FF3A]">AI generated</span>
                  <span>{fmtDateTime(active.created_at)}</span>
                  {questionCount > 0 && (
                    <>
                      <span className="text-zinc-700">·</span>
                      <span>{questionCount} questions</span>
                    </>
                  )}
                  {sections.length > 0 && (
                    <>
                      <span className="text-zinc-700">·</span>
                      <span>{sections.length} sections</span>
                    </>
                  )}
                </motion.div>

                <h1 className="max-w-6xl break-words text-[clamp(2.5rem,6vw,6rem)] font-medium leading-[0.95] tracking-[-0.04em]">
                  <span className="block overflow-hidden pb-[0.08em]">
                    <motion.span className="block" {...reveal(0, 0.3)}>
                      {stripExt(active.filename)}
                    </motion.span>
                  </span>
                </h1>

                <motion.div {...fadeUp(0.55)} className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={copyAll}
                    className="ur-mono group flex items-center gap-2.5 rounded-full border border-white/15 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:border-[#D7FF3A] hover:text-[#D7FF3A]"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <RollText>{copied ? "Copied" : "Copy all"}</RollText>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="ur-mono group flex items-center gap-2.5 rounded-full border border-white/15 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:border-[#D7FF3A] hover:text-[#D7FF3A]"
                  >
                    <RollText>Switch résumé</RollText>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/interview?resume=${active.id}`)}
                    className="ur-mono group flex items-center gap-2.5 rounded-full bg-[#D7FF3A] px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-[#0A0A0A] transition-opacity hover:opacity-90"
                  >
                    <ArrowUpRight size={14} />
                    <RollText>Mock interview</RollText>
                  </button>
                </motion.div>

                {/* Body */}
                <div className="mt-16 grid gap-12 border-t border-white/10 pt-12 lg:grid-cols-12 lg:gap-10">
                  {sections.length > 0 && (
                    <motion.aside {...fadeUp(0.65)} className="hidden lg:col-span-3 lg:block">
                      <div className="sticky top-28">
                        <div className="ur-mono mb-5 text-[11px] uppercase tracking-[0.2em] text-zinc-600">Contents</div>
                        <ol className="space-y-1">
                          {sections.map((s, i) => {
                            const on = currentSection === s.id;
                            return (
                              <li key={`${s.id}-${i}`}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    document.getElementById(s.id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
                                  }
                                  className={`group flex w-full items-baseline gap-3 py-1.5 text-left text-sm transition-colors ${
                                    on ? "text-[#EDEDE8]" : "text-zinc-500 hover:text-zinc-200"
                                  }`}
                                >
                                  <span className={`ur-mono text-[10px] ${on ? "text-[#D7FF3A]" : "text-zinc-700"}`}>{pad(i + 1)}</span>
                                  <span
                                    className={`h-px shrink-0 self-center bg-current transition-all duration-500 ${
                                      on ? "w-6" : "w-0 group-hover:w-3"
                                    }`}
                                  />
                                  <span className="truncate">{s.text}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    </motion.aside>
                  )}

                  <motion.article
                    {...fadeUp(0.7)}
                    className={`ur-md min-w-0 max-w-3xl ${sections.length ? "lg:col-span-9" : "lg:col-span-12"}`}
                  >
                    <ReactMarkdown components={mdComponents}>{active.questions}</ReactMarkdown>
                  </motion.article>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        {/* --- MARQUEE FOOTER --- */}
        <motion.footer {...fadeUp(1)} className="relative z-10 overflow-hidden border-t border-white/[0.07] py-5">
          <div className="ur-marquee flex w-max">
            {[0, 1].map((k) => (
              <div key={k} aria-hidden={k === 1} className="flex shrink-0">
                {[...MARQUEE, ...MARQUEE].map((item, i) => (
                  <span key={i} className="flex items-center whitespace-nowrap">
                    <span className="px-8 text-2xl font-light tracking-tight text-zinc-500 md:text-3xl">{item}</span>
                    <span className="text-lg text-[#D7FF3A]">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </motion.footer>
      </div>
    </>
  );
}
