import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { BrainCircuit, Code, Users } from "lucide-react";

/* The three tracks Gemini writes questions in (see backend/gemini.py). */
const TRACKS = [
  {
    name: "Technical",
    code: "TE",
    icon: Code,
    body: "Systems, APIs and the exact stack listed on your resume.",
    tip: "Think out loud. Interviewers grade your reasoning as much as your final answer.",
  },
  {
    name: "Machine Learning",
    code: "ML",
    icon: BrainCircuit,
    body: "Models, metrics and the trade-offs behind your data work.",
    tip: "Be ready to defend your metric and your validation split, not just the score.",
  },
  {
    name: "Behavioral",
    code: "BH",
    icon: Users,
    body: "Teamwork, conflict and impact, told the STAR way.",
    tip: "Answer with STAR: Situation, Task, Action, Result.",
  },
];

const ADVANCE_MS = 4500;
const R = 310;
const CIRCUMFERENCE = 2 * Math.PI * R;
const TICKS = 144;
const TICK_DASH = `1.6 ${CIRCUMFERENCE / TICKS - 1.6}`;
const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

/**
 * Tick-mark dial (after cominvi's minerals selector). The dark arc shows the
 * active track; it is a masked copy of the faint ring whose dash offset
 * animates only when the track changes.
 */
export default function TrackDial() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px" });
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused || !inView) return;
    const id = setInterval(() => setActive((a) => (a + 1) % TRACKS.length), ADVANCE_MS);
    return () => clearInterval(id);
  }, [reduce, paused, inView]);

  const progress = (active + 1) / TRACKS.length;
  const track = TRACKS[active];
  const Icon = track.icon;

  return (
    <div
      ref={ref}
      className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)_minmax(0,1fr)] lg:gap-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Track list */}
      <div className="order-2 lg:order-1 lg:self-end">
        <div className="mb-4 font-['Geist_Mono'] text-[11px] uppercase text-hm-muted">Tracks Gemini writes</div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 lg:block">
          {TRACKS.map((t, i) => (
            <li key={t.name}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                className={`text-left text-3xl font-medium leading-[1.1] tracking-[-0.04em] transition-colors duration-300 sm:text-4xl lg:text-5xl ${
                  i === active ? "text-hm-ink" : "text-hm-faint hover:text-hm-muted"
                }`}
              >
                {t.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Dial */}
      <div className="relative order-1 mx-auto aspect-square w-full max-w-[560px] lg:order-2" aria-hidden="true">
        <svg viewBox="0 0 700 700" className="absolute inset-0 h-full w-full">
          <defs>
            <mask id="hm-dial-progress">
              <circle
                cx="350"
                cy="350"
                r={R}
                fill="none"
                stroke="white"
                strokeWidth="44"
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                transform="rotate(-90 350 350)"
                style={{ strokeDashoffset: CIRCUMFERENCE * (1 - progress), transition: `stroke-dashoffset 0.9s ${EASE}` }}
              />
            </mask>
          </defs>
          <circle cx="350" cy="350" r={R} fill="none" stroke="currentColor" strokeWidth="26" strokeDasharray={TICK_DASH} className="text-hm-faint" />
          <circle
            cx="350"
            cy="350"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="26"
            strokeDasharray={TICK_DASH}
            mask="url(#hm-dial-progress)"
            className="text-hm-ink"
          />
          {/* accent marker at the head of the arc */}
          <g style={{ transform: `rotate(${progress * 360}deg)`, transformOrigin: "350px 350px", transition: `transform 0.9s ${EASE}` }}>
            <line x1="350" y1={350 - R - 22} x2="350" y2={350 - R + 22} stroke="#f47920" strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>

        <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-hm-panel">
          <AnimatePresence mode="wait">
            <motion.div
              key={track.name}
              initial={reduce ? false : { opacity: 0, scale: 0.85, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.9, rotate: 8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center"
            >
              <Icon className="h-[38%] w-[38%] min-h-16 min-w-16 text-hm-ink sm:h-28 sm:w-28" strokeWidth={0.9} />
            </motion.div>
          </AnimatePresence>
          <div className="mt-4 font-['Geist_Mono'] text-[11px] uppercase text-hm-muted">
            Track {String(active + 1).padStart(2, "0")} / {String(TRACKS.length).padStart(2, "0")}
          </div>
        </div>
      </div>

      {/* Detail */}
      <div className="order-3 lg:pl-8">
        <div className="font-['Geist_Mono'] text-[11px] uppercase text-hm-muted">
          {track.code} [#{String(active + 1).padStart(2, "0")}]
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={track.name}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <p className="mt-4 max-w-xs text-lg font-medium leading-snug tracking-[-0.02em]">{track.body}</p>
            <p className="mt-6 max-w-xs border-t border-hm-line pt-4 text-sm leading-relaxed text-hm-muted">
              <span className="mr-2 font-['Geist_Mono'] text-[11px] uppercase text-hm-accent">Tip</span>
              {track.tip}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
