import { useEffect, useState } from "react";
import { animate, motion } from "framer-motion";

const LETTERS = "HireMind".split("");

/**
 * Full-screen intro curtain: letters rise, a counter runs to 100,
 * then the whole panel lifts away with a curved bottom edge.
 */
export default function Preloader({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const controls = animate(0, 100, {
      duration: 1.9,
      ease: [0.65, 0, 0.35, 1],
      onUpdate: (v) => setCount(Math.round(v)),
      onComplete: () => onDone(),
    });

    return () => {
      controls.stop();
      document.body.style.overflow = "";
    };
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white"
      style={{ borderRadius: "0 0 50% 50% / 0 0 8% 8%" }}
      initial={{ y: 0 }}
      exit={{ y: "-105%" }}
      transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
      aria-hidden="true"
    >
      {/* soft glow behind the wordmark */}
      <div className="absolute h-72 w-72 rounded-full bg-violet-600/30 blur-[110px]" />

      <div className="relative flex overflow-hidden py-2">
        {LETTERS.map((char, i) => (
          <motion.span
            key={i}
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="text-6xl font-semibold tracking-tighter sm:text-8xl"
          >
            {char}
          </motion.span>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.8 }}
        className="relative mt-3 text-xs uppercase tracking-[0.35em] text-zinc-500"
      >
        Interview prep, powered by Gemini
      </motion.p>

      <div className="absolute bottom-10 left-8 right-8 flex items-end justify-between sm:left-14 sm:right-14">
        <span className="font-mono text-5xl font-light tabular-nums text-zinc-300 sm:text-7xl">
          {String(count).padStart(3, "0")}
        </span>
        <span className="mb-2 text-xs uppercase tracking-[0.3em] text-zinc-600">Loading workspace</span>
      </div>

      <div className="absolute bottom-0 left-0 h-[2px] w-full bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-300"
          style={{ width: `${count}%` }}
        />
      </div>
    </motion.div>
  );
}
