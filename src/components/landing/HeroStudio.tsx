import { useEffect, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import type { AnimationPlaybackControls } from "framer-motion";
import { FileText, Pause, Play } from "lucide-react";

/*
 * A dark "editor" mock — HireMind's take on butter.video's timeline UI.
 * One motion value (seconds, 0 → 7) drives the playhead, the scan bar and the
 * questions, so the whole scene stays in sync and can be paused.
 */

const LENGTH = 7;
const CLIPS = [
  { label: "Upload", from: 0, to: 1.5, color: "#4DC5E5" },
  { label: "Analyse", from: 1.5, to: 3.5, color: "#E9D352" },
  { label: "Generate", from: 3.5, to: 7, color: "#63AD45" },
];

const OUTPUT: { kind: "h2" | "h3" | "li"; text: string; at: number }[] = [
  { kind: "h2", text: "🧠 Technical", at: 3.7 },
  { kind: "h3", text: "FastAPI service", at: 3.9 },
  { kind: "li", text: "Your API served 10k req/min. What breaks first at 100k?", at: 4.2 },
  { kind: "li", text: "Why PostgreSQL over a document store here?", at: 4.6 },
  { kind: "h2", text: "🤖 Machine Learning", at: 5.0 },
  { kind: "li", text: "How did you rule out leakage in the churn model?", at: 5.3 },
  { kind: "h2", text: "💬 Behavioral", at: 5.7 },
  { kind: "li", text: "Tell me about shipping something you disagreed with.", at: 6.0 },
];

const KEYWORDS = ["FastAPI", "PostgreSQL", "React", "scikit-learn"];

function phaseOf(t: number) {
  return t < 1.5 ? 0 : t < 3.5 ? 1 : 2;
}

function linesOf(t: number) {
  return OUTPUT.filter((line) => t >= line.at).length;
}

function timecode(t: number) {
  const secs = Math.floor(t);
  const hundredths = Math.floor((t - secs) * 100);
  return `00:0${secs}.${String(hundredths).padStart(2, "0")}`;
}

export default function HeroStudio() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const [paused, setPaused] = useState(false);

  // Reduced motion: show the finished scene, frozen.
  const t = useMotionValue(reduce ? 6.5 : 0);
  const [phase, setPhase] = useState(() => phaseOf(t.get()));
  const [lines, setLines] = useState(() => linesOf(t.get()));

  useMotionValueEvent(t, "change", (v) => {
    setPhase(phaseOf(v));
    setLines(linesOf(v));
  });

  const playing = inView && !paused && !reduce;

  useEffect(() => {
    if (!playing) return;
    let controls: AnimationPlaybackControls | undefined;
    const run = () => {
      controls = animate(t, LENGTH, {
        duration: LENGTH - t.get(),
        ease: "linear",
        onComplete: () => {
          t.set(0);
          run();
        },
      });
    };
    run();
    return () => controls?.stop();
  }, [playing, t]);

  const playhead = useTransform(t, [0, LENGTH], ["0%", "100%"]);
  const clock = useTransform(t, timecode);
  const upload = useTransform(t, [0, 1.4], ["0%", "100%"]);
  const scan = useTransform(t, [1.5, 3.5], ["-10%", "105%"]);
  const scanOpacity = useTransform(t, [1.4, 1.6, 3.3, 3.5], [0, 1, 1, 0]);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-[28px] bg-lp-showcase p-3 text-[#FAFAFA] shadow-[0_70px_120px_-50px_rgba(15,15,15,0.6)] ring-1 ring-lp-edge sm:rounded-[36px] sm:p-5"
    >
      {/* Transport bar */}
      <div className="flex flex-wrap items-center gap-3 px-1 pb-4 font-['Geist_Mono'] text-xs sm:text-sm">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          disabled={!!reduce}
          aria-label={paused ? "Play demo" : "Pause demo"}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2c2c2c] transition hover:bg-[#3a3a3a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4DC5E5] disabled:opacity-60"
        >
          {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
        </button>
        <span className="tabular-nums">
          <motion.span>{clock}</motion.span>
          <span className="text-white/40"> / 00:07</span>
        </span>
        <span className="hidden h-5 w-px bg-white/10 sm:block" />
        <span className="hidden items-center gap-2 text-white/50 sm:flex">
          Model <span className="rounded-lg bg-[#2c2c2c] px-2 py-1 text-white">gemini-2.5-flash</span>
        </span>
        <span className="ml-auto flex items-center gap-2 rounded-lg bg-[#2c2c2c] px-2.5 py-1.5 text-white/70">
          <FileText size={14} /> alex_rivera.pdf
        </span>
      </div>

      {/* Canvas */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Resume sheet */}
        <div className="relative hidden overflow-hidden rounded-2xl bg-[#F4F4F2] p-5 text-[#0F0F0F] sm:block">
          <div className="font-['Schibsted_Grotesk'] text-lg font-bold leading-tight">Alex Rivera</div>
          <div className="mb-4 text-xs text-[#0F0F0F]/50">Backend Engineer · 3 yrs</div>
          {[92, 74, 85, 60].map((w, i) => (
            <div key={i} className="mb-2 h-2 rounded-full bg-[#0F0F0F]/10" style={{ width: `${w}%` }} />
          ))}
          <div className="my-4 flex flex-wrap gap-1.5">
            {KEYWORDS.map((k, i) => (
              <motion.span
                key={k}
                className="rounded-md px-1.5 py-0.5 font-['Geist_Mono'] text-[11px]"
                animate={
                  phase >= 1
                    ? { backgroundColor: "rgba(233,211,82,0.55)", color: "#0F0F0F" }
                    : { backgroundColor: "rgba(15,15,15,0.06)", color: "rgba(15,15,15,0.45)" }
                }
                transition={{ duration: 0.3, delay: phase === 1 ? 0.25 + i * 0.35 : 0 }}
              >
                {k}
              </motion.span>
            ))}
          </div>
          {[88, 66, 79, 54, 71].map((w, i) => (
            <div key={i} className="mb-2 h-2 rounded-full bg-[#0F0F0F]/10" style={{ width: `${w}%` }} />
          ))}
          {/* Scan bar */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-[#4DC5E5]/35 to-transparent"
            style={{ top: scan, opacity: scanOpacity }}
          />
        </div>

        {/* Output */}
        <div className="relative min-h-[260px] rounded-2xl bg-[#1E1E1E] p-5 sm:min-h-[300px]">
          <div className="mb-4 flex items-center justify-between font-['Geist_Mono'] text-[11px] uppercase tracking-[0.18em] text-white/40">
            <span>questions.md</span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: CLIPS[phase].color }}
              />
              {CLIPS[phase].label}
            </span>
          </div>

          <AnimatePresence mode="wait">
            {phase === 0 && (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/15 sm:h-[230px]"
              >
                <FileText className="text-[#4DC5E5]" />
                <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                  <motion.div className="h-full rounded-full bg-[#4DC5E5]" style={{ width: upload }} />
                </div>
                <span className="font-['Geist_Mono'] text-xs text-white/50">Uploading resume…</span>
              </motion.div>
            )}

            {phase === 1 && (
              <motion.div
                key="analyse"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3 pt-2"
              >
                <span className="font-['Geist_Mono'] text-xs text-white/50">Reading 2 pages with Gemini…</span>
                {[80, 64, 72, 48].map((w, i) => (
                  <motion.div
                    key={i}
                    className="h-3 rounded-full bg-white/[0.07]"
                    style={{ width: `${w}%` }}
                    animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </motion.div>
            )}

            {phase === 2 && (
              <motion.ul key="generate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1.5">
                {OUTPUT.slice(0, lines).map((line) => (
                  <motion.li
                    key={line.text}
                    initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.35 }}
                    className={
                      line.kind === "h2"
                        ? "pt-2 font-['Schibsted_Grotesk'] text-base font-bold first:pt-0"
                        : line.kind === "h3"
                          ? "font-['Geist_Mono'] text-xs text-[#E9D352]"
                          : "flex gap-2 text-sm leading-snug text-white/75"
                    }
                  >
                    {line.kind === "li" && <span className="text-[#63AD45]">–</span>}
                    {line.text}
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Timeline */}
      {/* Margins (not padding) so the playhead's % offset lines up with the ruler. */}
      <div className="relative mx-1 mb-1 mt-4" aria-hidden="true">
        <div className="flex justify-between font-['Geist_Mono'] text-[10px] text-white/50">
          {Array.from({ length: LENGTH * 4 + 1 }, (_, i) =>
            i % 4 === 0 ? (
              <span key={i} className="w-0 text-center">
                <span className="-ml-2 inline-block w-4">{i / 4}s</span>
              </span>
            ) : (
              <span key={i} className="mt-1 h-2 w-px bg-white/20" />
            )
          )}
        </div>
        <div className="relative mt-3 h-8">
          {CLIPS.map((clip) => (
            <div
              key={clip.label}
              className="absolute top-0 flex h-full items-center overflow-hidden rounded-lg px-2 font-['Geist_Mono'] text-[11px] font-medium text-[#0F0F0F]"
              style={{
                left: `${(clip.from / LENGTH) * 100}%`,
                width: `calc(${((clip.to - clip.from) / LENGTH) * 100}% - 3px)`,
                backgroundColor: clip.color,
              }}
            >
              {clip.label}
            </div>
          ))}
        </div>
        <motion.div className="absolute -top-1 bottom-0 w-0.5 rounded-full bg-white" style={{ left: playhead }}>
          <span className="absolute -left-[5px] -top-1 h-3 w-3 rounded-full bg-white" />
        </motion.div>
      </div>
    </div>
  );
}
