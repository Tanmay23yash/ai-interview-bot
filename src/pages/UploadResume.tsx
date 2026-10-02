import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppNav from "../components/nav/AppNav";
import { API_URL } from "../lib/api";
import { ArrowUpRight, FileText, X } from "lucide-react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useMotionTemplate,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import type { MotionValue } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACCENT = "#D7FF3A";
const MAX_BYTES = 5 * 1024 * 1024;
const EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];
const STATUS = ["Reading layout", "Extracting experience", "Mapping skills", "Drafting questions"];
const MARQUEE = ["Résumé in", "Questions out", "PDF only", "5 MB max", "Tailored to you", "Practice before it counts"];
const STEPS = [
  { n: "01", t: "Upload", d: "Drop in your résumé as a PDF." },
  { n: "02", t: "Analyze", d: "We read your experience, projects and skills." },
  { n: "03", t: "Practice", d: "Get interview questions written for you." },
];
// Skeleton "résumé" sections drawn on the sheet: widths in %
const SECTIONS = [
  [100, 92, 70],
  [100, 84, 96, 58],
  [78, 62],
];
const NOISE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";

function validate(f: File): string | null {
  const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "That isn't a PDF. Try again with a .pdf file.";
  if (f.size > MAX_BYTES) return "That file is over 5 MB. Compress it and try again.";
  return null;
}

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */

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
              className="ur-mono text-[11px] uppercase tracking-[0.16em] text-[#0A0A0A]"
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

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function UploadResume() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [finePointer, setFinePointer] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingRef = useRef(false);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  // --- Pointer-driven motion ---
  const px = useMotionValue(typeof window !== "undefined" ? window.innerWidth / 2 : 0);
  const py = useMotionValue(typeof window !== "undefined" ? window.innerHeight / 2 : 0);
  const spotlight = useMotionTemplate`radial-gradient(560px circle at ${px}px ${py}px, rgba(215,255,58,0.07), transparent 70%)`;

  // The résumé sheet tilts toward the cursor wherever it is on the page
  const spring = { stiffness: 110, damping: 18 };
  const tiltX = useSpring(useTransform(py, (v) => (reduce ? 0 : (0.5 - v / window.innerHeight) * 14)), spring);
  const tiltY = useSpring(useTransform(px, (v) => (reduce ? 0 : (v / window.innerWidth - 0.5) * 20)), spring);
  const sheen = useTransform(
    tiltY,
    (v) => `linear-gradient(${110 + v * 4}deg, transparent 35%, rgba(255,255,255,0.07) 50%, transparent 65%)`
  );

  // Magnetic CTA
  const mX = useMotionValue(0);
  const mY = useMotionValue(0);
  const smX = useSpring(mX, { stiffness: 220, damping: 16, mass: 0.6 });
  const smY = useSpring(mY, { stiffness: 220, damping: 16, mass: 0.6 });

  const customCursor = finePointer && !reduce;

  useEffect(() => {
    setFinePointer(window.matchMedia("(pointer: fine)").matches);
  }, []);

  useEffect(() => {
    loadingRef.current = loading;
    if (!loading) {
      setStatusIdx(0);
      return;
    }
    const id = setInterval(() => setStatusIdx((i) => (i + 1) % STATUS.length), 1400);
    return () => clearInterval(id);
  }, [loading]);

  // --- File handling ---

  const pick = useCallback((f: File) => {
    const err = validate(f);
    if (err) {
      setMessage(err);
      return;
    }
    setFile(f);
    setMessage("");
  }, []);

  // Drop anywhere on the page
  useEffect(() => {
    const over = (e: DragEvent) => {
      e.preventDefault();
      if (!loadingRef.current) setIsDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setIsDragging(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (loadingRef.current) return;
      const f = e.dataTransfer?.files?.[0];
      if (f) pick(f);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [pick]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) pick(f);
    e.target.value = ""; // allow re-selecting the same file
  };

  const openPicker = () => {
    if (!loading) fileInputRef.current?.click();
  };

  async function handleUpload() {
    if (!file) {
      setMessage("Please select a PDF file");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("You are not logged in");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    try {
      setLoading(true);
      setMessage("");

      const res = await fetch(`${API_URL}/resume/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Upload failed");

      navigate(`/questions/${data.resume_id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  // --- Derived UI state ---

  const reveal = (i: number) => ({
    initial: reduce ? false : { y: "110%" },
    animate: { y: "0%" },
    transition: { duration: 1.05, ease: EASE, delay: 0.5 + i * 0.09 },
  });
  const fadeUp = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, ease: EASE, delay },
  });

  const lineOpacity = loading ? 0.28 : file ? 0.22 : isDragging ? 0.12 : 0.06;
  const ctaLabel = loading ? "Analyzing your résumé" : file ? "Generate questions" : "Add a résumé first";
  const stepState = (i: number) => {
    if (i === 0) return file ? "Done" : "Now";
    if (i === 1) return loading ? "Running" : file ? "Next" : "—";
    return "—";
  };
  const activeStep = file ? 1 : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        .ur-sans  { font-family: 'Inter Tight', ui-sans-serif, system-ui, sans-serif; }
        .ur-serif { font-family: 'Instrument Serif', ui-serif, Georgia, serif; }
        .ur-mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .ur-root ::selection { background: ${ACCENT}; color: #0A0A0A; }
        @keyframes ur-marquee { to { transform: translateX(-50%); } }
        @keyframes ur-scan { from { top: -25%; } to { top: 105%; } }
        @keyframes ur-grain {
          0%,100% { transform: translate(0,0); } 20% { transform: translate(-3%,2%); }
          40% { transform: translate(2%,-3%); } 60% { transform: translate(-2%,-1%); } 80% { transform: translate(3%,3%); }
        }
        .ur-marquee { animation: ur-marquee 38s linear infinite; }
        .ur-scan { animation: ur-scan 1.6s cubic-bezier(.65,0,.35,1) infinite; }
        .ur-grain { animation: ur-grain 0.9s steps(4) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ur-marquee, .ur-grain { animation: none; }
          .ur-scan { animation-duration: 4s; }
        }
      `}</style>

      <div
        className={`ur-root ur-sans relative flex min-h-svh flex-col overflow-clip bg-[#0A0A0A] text-[#EDEDE8] ${
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
        <div aria-hidden className="pointer-events-none fixed inset-0">
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

        {/* --- Top bar --- */}
        <AppNav surface="dark" intro={fadeUp(0.45)} />

        {/* --- Main --- */}
        <main className="relative z-10 grid flex-1 items-center gap-14 px-5 py-12 md:px-10 lg:grid-cols-12 lg:gap-10 lg:py-16">
          {/* Left: copy + steps */}
          <section className="lg:col-span-7">
            <motion.div
              {...fadeUp(0.55)}
              className="ur-mono mb-8 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D7FF3A] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D7FF3A]" />
              </span>
              Engine ready
              <span className="text-zinc-700">·</span>
              Step {String(activeStep + 1).padStart(2, "0")} / 03
            </motion.div>

            <h1 className="text-[clamp(3.25rem,8.5vw,8.5rem)] font-medium leading-[0.9] tracking-[-0.045em]">
              <span className="block overflow-hidden pb-[0.06em]">
                <motion.span className="block" {...reveal(0)}>
                  Résumé in,
                </motion.span>
              </span>
              <span className="block overflow-hidden pb-[0.1em]">
                <motion.span className="block" {...reveal(1)}>
                  <em className="ur-serif pr-[0.06em] font-normal italic tracking-[-0.02em] text-[#D7FF3A]">questions</em>{" "}
                  out.
                </motion.span>
              </span>
            </h1>

            <motion.p {...fadeUp(0.8)} className="mt-8 max-w-md text-lg leading-relaxed text-zinc-400">
              Upload a PDF and we'll read it the way an interviewer would, then write the questions they're most likely to
              ask you.
            </motion.p>

            <motion.ol {...fadeUp(0.95)} className="mt-14 max-w-xl">
              {STEPS.map((s, i) => {
                const state = stepState(i);
                const on = i === activeStep;
                return (
                  <li
                    key={s.n}
                    className={`grid grid-cols-[3rem_1fr_auto] items-baseline gap-4 border-t border-white/10 py-5 transition-colors duration-500 last:border-b ${
                      on ? "text-[#EDEDE8]" : "text-zinc-600"
                    }`}
                  >
                    <span className="ur-mono text-xs">{s.n}</span>
                    <div>
                      <div className="text-xl font-medium tracking-tight">{s.t}</div>
                      <div className={`mt-1 text-sm ${on ? "text-zinc-400" : "text-zinc-600"}`}>{s.d}</div>
                    </div>
                    <span
                      className={`ur-mono text-[11px] uppercase tracking-[0.18em] ${
                        state === "Done" || state === "Running" ? "text-[#D7FF3A]" : ""
                      }`}
                    >
                      {state}
                    </span>
                  </li>
                );
              })}
            </motion.ol>
          </section>

          {/* Right: the 3D sheet + action */}
          <motion.section {...fadeUp(0.7)} className="lg:col-span-5">
            <input type="file" accept="application/pdf" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

            <div className="relative mx-auto w-full max-w-[340px] [perspective:1400px]">
              <motion.div className="relative aspect-[1/1.32]" style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: "preserve-3d" }}>
                {/* Stacked sheets behind */}
                <div
                  className="absolute inset-0 rounded-[18px] border border-white/[0.05] bg-[#121212]"
                  style={{ transform: "translateZ(-70px) translateX(-22px) rotate(-7deg)" }}
                />
                <div
                  className="absolute inset-0 rounded-[18px] border border-white/[0.06] bg-[#141414]"
                  style={{ transform: "translateZ(-35px) translateX(14px) rotate(4deg)" }}
                />

                {/* Front sheet */}
                <motion.div
                  role="button"
                  tabIndex={0}
                  aria-label={file ? `Selected ${file.name}. Press to replace.` : "Choose a PDF résumé to upload"}
                  data-cursor={loading ? undefined : file ? "Replace" : "Browse"}
                  onClick={openPicker}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openPicker();
                    }
                  }}
                  animate={{ z: isDragging ? 50 : 0, scale: isDragging ? 1.02 : 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 20 }}
                  className={`absolute inset-0 overflow-hidden rounded-[18px] border bg-[#171717] p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)] outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-[#D7FF3A] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0A0A0A] ${
                    isDragging ? "border-[#D7FF3A]" : "border-white/10"
                  }`}
                >
                  {/* Dashed inner frame */}
                  <div
                    className={`pointer-events-none absolute inset-3 rounded-[12px] border border-dashed transition-colors duration-300 ${
                      isDragging ? "border-[#D7FF3A]/60" : file ? "border-transparent" : "border-white/[0.12]"
                    }`}
                  />

                  {/* Skeleton résumé */}
                  <div key={file?.name ?? "empty"} className="relative">
                    <div className="mb-7 flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-white transition-opacity duration-500" style={{ opacity: lineOpacity }} />
                      <div className="min-w-0 flex-1 space-y-2">
                        {file ? (
                          <motion.div
                            initial={reduce ? false : { opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="truncate text-sm font-medium text-zinc-200"
                          >
                            {file.name.replace(/\.pdf$/i, "")}
                          </motion.div>
                        ) : (
                          <div className="h-[6px] w-2/3 rounded-full bg-white" style={{ opacity: lineOpacity }} />
                        )}
                        <div className="h-[5px] w-1/3 rounded-full bg-white" style={{ opacity: lineOpacity }} />
                      </div>
                    </div>

                    {SECTIONS.map((sec, si) => (
                      <div key={si} className="mb-6">
                        <div
                          className="mb-3 h-[5px] w-1/4 rounded-full transition-colors duration-500"
                          style={{ backgroundColor: file ? ACCENT : "#fff", opacity: file ? 0.7 : lineOpacity }}
                        />
                        <div className="space-y-2">
                          {sec.map((w, li) => (
                            <motion.div
                              key={li}
                              initial={reduce ? false : { scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ duration: 0.7, ease: EASE, delay: 0.05 * (si * 4 + li) }}
                              className="h-[5px] origin-left rounded-full bg-white transition-opacity duration-500"
                              style={{ width: `${w}%`, opacity: lineOpacity }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Empty / dragging prompt */}
                  <AnimatePresence>
                    {!file && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
                      >
                        <div className="overflow-hidden">
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                              key={isDragging ? "release" : "drop"}
                              initial={{ y: "100%" }}
                              animate={{ y: "0%" }}
                              exit={{ y: "-100%" }}
                              transition={{ duration: 0.45, ease: EASE }}
                              className={`ur-serif text-7xl italic leading-[1.05] ${isDragging ? "text-[#D7FF3A]" : "text-[#EDEDE8]"}`}
                            >
                              {isDragging ? (
                                "Release"
                              ) : (
                                <>
                                  <span className="pointer-coarse:hidden">Drop</span>
                                  <span className="hidden pointer-coarse:inline">Tap</span>
                                </>
                              )}
                            </motion.div>
                          </AnimatePresence>
                        </div>
                        <div className="ur-mono mt-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                          {isDragging ? (
                            "We'll take it from here"
                          ) : (
                            <>
                              <span className="pointer-coarse:hidden">or click to browse</span>
                              <span className="hidden pointer-coarse:inline">to choose a PDF</span>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Ready stamp */}
                  <AnimatePresence>
                    {file && !loading && (
                      <motion.div
                        initial={reduce ? false : { opacity: 0, scale: 1.8, rotate: -2 }}
                        animate={{ opacity: 1, scale: 1, rotate: -9 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.35 }}
                        className="ur-mono pointer-events-none absolute bottom-7 right-6 rounded-md border-2 border-[#D7FF3A] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.22em] text-[#D7FF3A]"
                      >
                        Ready
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Scanning while uploading */}
                  {loading && (
                    <>
                      <div className="ur-scan pointer-events-none absolute inset-x-0 h-1/4 bg-gradient-to-b from-transparent via-[#D7FF3A]/20 to-transparent">
                        <div className="absolute inset-x-0 top-1/2 h-px bg-[#D7FF3A] shadow-[0_0_14px_2px_rgba(215,255,58,0.6)]" />
                      </div>
                      <div className="ur-mono absolute inset-x-6 bottom-6 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#D7FF3A]">
                        <span className="h-3 w-1.5 animate-pulse bg-[#D7FF3A]" />
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={statusIdx}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.25 }}
                          >
                            {STATUS[statusIdx]}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                    </>
                  )}

                  {/* Light sheen that shifts with tilt */}
                  <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: sheen }} />
                </motion.div>
              </motion.div>
            </div>

            {/* File row / hint */}
            <div className="mx-auto mt-14 max-w-[440px]">
              <AnimatePresence mode="wait" initial={false}>
                {file ? (
                  <motion.div
                    key="file"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center justify-between gap-4 border-y border-white/10 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText size={18} className="shrink-0 text-[#D7FF3A]" />
                      <span className="truncate text-sm text-zinc-200">{file.name}</span>
                      <span className="ur-mono shrink-0 text-[11px] text-zinc-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setFile(null)}
                      className="ur-mono group flex shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-[#FF6B5B] disabled:opacity-40"
                    >
                      <X size={14} />
                      <RollText>Remove</RollText>
                    </button>
                  </motion.div>
                ) : (
                  <motion.p
                    key="hint"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="ur-mono border-y border-white/10 py-4 text-center text-[11px] uppercase tracking-[0.18em] text-zinc-500"
                  >
                    PDF only · Up to 5 MB<span className="pointer-coarse:hidden"> · Drop anywhere on the page</span>
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Magnetic CTA */}
              <motion.button
                ref={ctaRef}
                type="button"
                onClick={handleUpload}
                disabled={!file || loading}
                onPointerMove={(e) => {
                  if (reduce || !ctaRef.current) return;
                  const r = ctaRef.current.getBoundingClientRect();
                  mX.set((e.clientX - r.left - r.width / 2) * 0.12);
                  mY.set((e.clientY - r.top - r.height / 2) * 0.35);
                }}
                onPointerLeave={() => {
                  mX.set(0);
                  mY.set(0);
                }}
                style={{ x: smX, y: smY }}
                className={`group mt-6 flex h-16 w-full items-center justify-between rounded-full pl-7 pr-2 text-base font-medium transition-colors duration-500 disabled:cursor-not-allowed ${
                  file ? "bg-[#D7FF3A] text-[#0A0A0A]" : "border border-white/10 bg-white/[0.03] text-zinc-500"
                }`}
              >
                <RollText>{ctaLabel}</RollText>
                <span
                  className={`grid h-12 w-12 place-items-center rounded-full transition-transform duration-500 ease-[cubic-bezier(.76,0,.24,1)] ${
                    file ? "bg-[#0A0A0A] text-[#D7FF3A] group-hover:rotate-45" : "bg-white/5"
                  }`}
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <ArrowUpRight size={20} />
                  )}
                </span>
              </motion.button>

              {/* Error */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="ur-mono mt-5 flex items-start gap-3 text-xs text-[#FF6B5B]"
                  >
                    <span className="shrink-0 rounded border border-[#FF6B5B]/40 px-1.5 py-0.5 text-[11px] tracking-[0.15em]">ERR</span>
                    <span className="pt-0.5 leading-relaxed">{message}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
        </main>

        {/* --- Marquee footer --- */}
        <motion.footer {...fadeUp(1.1)} className="relative z-10 overflow-hidden border-t border-white/[0.07] py-5">
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