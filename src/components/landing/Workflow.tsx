import { useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUp, FileText, Sparkles, Type } from "lucide-react";

/* Mirrors the real flow: PDF upload → pdfplumber text → Gemini → saved to the dashboard → adaptive mock interview. */
const STEPS = [
  { title: "Upload", body: "Drop in your resume as a PDF. That's the whole setup." },
  { title: "Analyse", body: "Every page is converted to text and read by Gemini 2.5 Flash." },
  { title: "Generate", body: "Questions arrive in clean markdown, grouped by topic across three tracks." },
  { title: "Practice", body: "Each resume and its questions are saved to your dashboard, ready when you are." },
  {
    title: "Mock interview",
    body: "Rehearse live, one question at a time. Every answer is scored, the next question gets harder or easier, and you finish with a study plan.",
  },
];

const STEP_MS = 5500;

function UploadPreview() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 rounded-3xl border border-dashed border-white/15">
      <div className="flex items-center gap-3 rounded-2xl bg-[#2c2c2c] px-4 py-3">
        <FileText className="text-[#4DC5E5]" size={20} />
        <div>
          <div className="text-sm font-medium">alex_rivera.pdf</div>
          <div className="font-['Geist_Mono'] text-[11px] text-white/45">182 KB · PDF</div>
        </div>
      </div>
      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-[#4DC5E5]"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="font-['Geist_Mono'] text-xs text-white/45">PDF only · one file at a time</span>
    </div>
  );
}

function AnalysePreview() {
  const nodes = [
    { icon: <FileText size={20} />, label: "PDF", color: "#4DC5E5" },
    { icon: <Type size={20} />, label: "Plain text", color: "#FAFAFA" },
    { icon: <Sparkles size={20} />, label: "Gemini", color: "#E9D352" },
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <div className="flex items-center gap-3 sm:gap-5">
        {nodes.map((n, i) => (
          <div key={n.label} className="flex items-center gap-3 sm:gap-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.45, type: "spring", stiffness: 200, damping: 16 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2c2c2c]" style={{ color: n.color }}>
                {n.icon}
              </div>
              <span className="font-['Geist_Mono'] text-[11px] text-white/55">{n.label}</span>
            </motion.div>
            {i < nodes.length - 1 && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.45 + 0.25 }}
                className="mb-6 text-white/30"
              >
                <ArrowRight size={18} />
              </motion.div>
            )}
          </div>
        ))}
      </div>
      <div className="w-full max-w-xs space-y-2">
        {[86, 70, 92, 58].map((w, i) => (
          <motion.div
            key={i}
            className="h-2 rounded-full bg-white/10"
            initial={{ width: "0%" }}
            animate={{ width: `${w}%` }}
            transition={{ delay: 1 + i * 0.15, duration: 0.6 }}
          />
        ))}
      </div>
    </div>
  );
}

function GeneratePreview() {
  const lines = [
    { heading: true, text: "🧠 Technical" },
    { heading: false, text: "How did you keep p95 latency under 200 ms?" },
    { heading: false, text: "Walk me through your schema migrations." },
    { heading: true, text: "🤖 Machine Learning" },
    { heading: false, text: "Why gradient boosting over a neural net?" },
    { heading: true, text: "💬 Behavioral" },
    { heading: false, text: "Describe a time you missed a deadline." },
  ];
  return (
    <div className="h-full space-y-1.5">
      <div className="pb-2 font-['Geist_Mono'] text-[11px] uppercase tracking-[0.18em] text-white/40">questions.md</div>
      {lines.map((line, i) => (
        <motion.div
          key={line.text}
          initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: i * 0.3 }}
          className={
            line.heading
              ? "pt-3 font-['Schibsted_Grotesk'] text-lg font-bold"
              : "flex gap-2 text-sm text-white/75"
          }
        >
          {!line.heading && <span className="text-[#63AD45]">–</span>}
          {line.text}
        </motion.div>
      ))}
    </div>
  );
}

function PracticePreview() {
  const saved = [
    { name: "alex_rivera.pdf", when: "Today" },
    { name: "alex_rivera_ml.pdf", when: "2 days ago" },
    { name: "alex_rivera_2025.pdf", when: "Last week" },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="mb-1 font-['Schibsted_Grotesk'] text-lg font-bold">Your resumes</div>
      {saved.map((s, i) => (
        <motion.div
          key={s.name}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15, type: "spring", stiffness: 200, damping: 20 }}
          className="flex items-center gap-3 rounded-2xl bg-[#232323] px-4 py-3"
        >
          <FileText size={18} className="shrink-0 text-white/50" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{s.name}</div>
            <div className="font-['Geist_Mono'] text-[11px] text-white/40">{s.when}</div>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#FAFAFA] px-3 py-1 text-xs font-medium text-[#0F0F0F]">
            Open <ArrowRight size={12} />
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function InterviewPreview() {
  const scores = [
    { label: "Accuracy", value: 88 },
    { label: "Depth", value: 76 },
    { label: "Clarity", value: 92 },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-4 sm:gap-5">
      <div className="flex items-center justify-between font-['Geist_Mono'] text-[11px] text-white/45">
        <span>Q03 · Kubernetes</span>
        <span className="flex items-center gap-2">
          Difficulty
          <span className="flex items-end gap-[3px]" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`w-1 rounded-[1px] ${n <= 3 ? "bg-[#4DC5E5]" : "bg-white/15"}`}
                style={{ height: 5 + n * 2 }}
              />
            ))}
          </span>
        </span>
      </div>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="font-['Schibsted_Grotesk'] text-xl font-bold leading-snug sm:text-2xl"
      >
        A rollout fails halfway through. How do you spot it and roll back safely?
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, type: "spring", stiffness: 200, damping: 20 }}
        className="rounded-2xl bg-[#232323] p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-['Schibsted_Grotesk'] text-3xl font-bold">
            8.6<span className="text-base font-medium text-white/40">/10</span>
          </span>
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.6, type: "spring", stiffness: 260, damping: 18 }}
            className="flex items-center gap-1 rounded-full bg-[#63AD45]/20 px-3 py-1 text-xs font-medium text-[#9be27a]"
          >
            <ArrowUp size={12} /> Next: Advanced
          </motion.span>
        </div>
        <div className="mt-3 space-y-2">
          {scores.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-16 shrink-0 font-['Geist_Mono'] text-[11px] text-white/45">{s.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-[#4DC5E5]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${s.value}%` }}
                  transition={{ delay: 0.9 + i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

const PREVIEWS = [UploadPreview, AnalysePreview, GeneratePreview, PracticePreview, InterviewPreview];

export default function Workflow() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });
  const [active, setActive] = useState(0);
  const Preview = PREVIEWS[active];

  return (
    <div ref={ref} className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <ol className="space-y-2">
        {STEPS.map((step, i) => {
          const open = i === active;
          return (
            <li key={step.title}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-expanded={open}
                className={`w-full rounded-3xl px-5 py-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-ink sm:px-6 ${
                  open ? "bg-lp-surface" : "hover:bg-lp-surface-soft"
                }`}
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-['Geist_Mono'] text-xs text-lp-ink/40">0{i + 1}</span>
                  <span
                    className={`font-['Schibsted_Grotesk'] text-2xl font-bold tracking-tight transition-colors sm:text-3xl ${
                      open ? "text-lp-ink" : "text-lp-ink/35"
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pl-9 pt-2 text-[15px] leading-relaxed text-lp-ink/60">{step.body}</p>
                      {!reduce && (
                        <div className="ml-9 mt-4 h-0.5 overflow-hidden rounded-full bg-lp-ink/10">
                          {/* Filling bar doubles as the auto-advance timer; it only runs while visible. */}
                          <motion.div
                            key={`${active}-${inView}`}
                            className="h-full bg-lp-ink"
                            initial={{ width: "0%" }}
                            animate={inView ? { width: "100%" } : { width: "0%" }}
                            transition={{ duration: inView ? STEP_MS / 1000 : 0, ease: "linear" }}
                            onAnimationComplete={() => {
                              if (inView) setActive((a) => (a + 1) % STEPS.length);
                            }}
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="relative h-[380px] overflow-hidden sm:h-auto sm:aspect-[4/3] rounded-[32px] bg-lp-showcase text-[#FAFAFA] shadow-[0_60px_100px_-50px_rgba(15,15,15,0.55)] ring-1 ring-lp-edge">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            className="absolute inset-0 p-5 sm:p-8"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
          >
            <Preview />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
