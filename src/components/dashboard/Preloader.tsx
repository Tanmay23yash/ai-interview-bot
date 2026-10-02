import { useEffect, useState } from "react";
import { animate, motion } from "framer-motion";

const LETTERS = "HireMind".split("");

/**
 * Full-screen intro curtain: letters rise, a counter runs to 100,
 * then the whole panel lifts away with a curved bottom edge.
 */
export default function Preloader({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    // The whole dashboard mounts behind this curtain, and its first frame is
    // heavy. Hold still until that frame is out (two rAFs), so the intro then
    // animates smoothly instead of skipping through it.
    let controls: ReturnType<typeof animate> | undefined;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setStarted(true);
        controls = animate(0, 100, {
          duration: 1.9,
          ease: [0.65, 0, 0.35, 1],
          onUpdate: (v) => setCount(Math.round(v)),
          onComplete: () => onDone(),
        });
      });
    });

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      controls?.stop();
      document.body.style.overflow = "";
    };
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-hm-bg text-hm-ink"
      style={{ borderRadius: "0 0 50% 50% / 0 0 8% 8%" }}
      initial={{ y: 0 }}
      exit={{ y: "-105%" }}
      transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
      aria-hidden="true"
    >
      <div className="relative flex overflow-hidden py-2">
        {LETTERS.map((char, i) => (
          <motion.span
            key={i}
            initial={{ y: "110%" }}
            animate={started ? { y: 0 } : undefined}
            transition={{ duration: 0.9, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="text-6xl font-medium tracking-[-0.05em] sm:text-8xl"
          >
            {char}
          </motion.span>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={started ? { opacity: 1, y: 0 } : undefined}
        transition={{ delay: 0.9, duration: 0.8 }}
        className="relative mt-3 font-['Geist_Mono'] text-xs uppercase text-hm-muted"
      >
        Interview prep, powered by Gemini
      </motion.p>

      <div className="absolute bottom-10 left-8 right-8 flex items-end justify-between sm:left-14 sm:right-14">
        <span className="font-['Geist_Mono'] text-5xl font-light tabular-nums sm:text-7xl">
          {String(count).padStart(3, "0")}
        </span>
        <span className="mb-2 font-['Geist_Mono'] text-xs uppercase text-hm-muted">Loading workspace</span>
      </div>

      <div className="absolute bottom-0 left-0 h-[2px] w-full bg-hm-line">
        <div className="h-full bg-hm-accent" style={{ width: `${count}%` }} />
      </div>
    </motion.div>
  );
}
