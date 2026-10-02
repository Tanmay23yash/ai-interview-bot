import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { InflatedWord } from "./Charms";

/*
 * The question tracks Gemini writes (see backend/gemini.py), each shown with a
 * different type treatment — a nod to butter.video's text-effects library.
 */

function Card({
  effect,
  label,
  caption,
  surface,
  children,
}: {
  effect: string;
  label: string;
  caption: string;
  surface: string;
  children: ReactNode;
}) {
  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="group"
    >
      <div
        className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-[28px] ${surface}`}
        aria-hidden="true"
      >
        <span className="absolute left-4 top-4 font-['Geist_Mono'] text-[11px] uppercase tracking-[0.16em] opacity-50">
          {effect}
        </span>
        {children}
      </div>
      <h3 className="mt-4 font-['Schibsted_Grotesk'] text-lg font-bold tracking-tight sm:text-xl">{label}</h3>
      <p className="mt-1 text-sm leading-relaxed text-lp-ink/55 sm:text-[15px]">{caption}</p>
    </motion.article>
  );
}

export default function QuestionTypes() {
  const reduce = useReducedMotion();

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-4">
      <Card
        effect="Inflate"
        label="Technical"
        caption="Systems, APIs and the exact stack listed on your resume."
        surface="bg-lp-surface text-lp-ink"
      >
        <span className="text-4xl transition-transform duration-500 group-hover:scale-110 sm:text-6xl xl:text-7xl">
          <InflatedWord color="cyan">Code</InflatedWord>
        </span>
      </Card>

      <Card
        effect="Glow"
        label="Machine Learning"
        caption="Models, metrics and trade-offs behind your data work."
        surface="bg-lp-band text-white ring-1 ring-lp-edge"
      >
        <motion.span
          className="font-['Schibsted_Grotesk'] text-4xl font-black tracking-tight text-[#effbe6] sm:text-6xl xl:text-7xl"
          initial={{ textShadow: "0 0 6px #63AD45, 0 0 18px #63AD45, 0 0 40px rgba(99,173,69,0.6)" }}
          animate={
            reduce
              ? undefined
              : {
                  textShadow: [
                    "0 0 6px #63AD45, 0 0 18px #63AD45, 0 0 40px rgba(99,173,69,0.6)",
                    "0 0 10px #63AD45, 0 0 34px #63AD45, 0 0 80px rgba(99,173,69,0.9)",
                    "0 0 6px #63AD45, 0 0 18px #63AD45, 0 0 40px rgba(99,173,69,0.6)",
                  ],
                }
          }
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          Model
        </motion.span>
      </Card>

      <Card
        effect="Focus"
        label="Behavioral"
        caption="Teamwork, conflict and impact, told the STAR way."
        surface="bg-[#F4F4F2] text-[#0F0F0F]"
      >
        <motion.span
          className="font-['Schibsted_Grotesk'] text-4xl font-black tracking-[-0.04em] sm:text-6xl xl:text-7xl"
          initial={{ filter: "blur(0px)" }}
          animate={reduce ? undefined : { filter: ["blur(9px)", "blur(0px)", "blur(0px)", "blur(9px)"] }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.35, 0.75, 1], ease: "easeInOut" }}
        >
          STAR
        </motion.span>
      </Card>

      <Card
        effect="Halftone"
        label="Your Projects"
        caption="Deep-dives grouped by the topics you actually worked on."
        surface="bg-[#E9D352] text-[#0F0F0F]"
      >
        <span
          className="font-['Schibsted_Grotesk'] text-4xl font-black tracking-[-0.04em] transition-[background-size] duration-500 [background-size:6px_6px] group-hover:[background-size:4px_4px] sm:text-6xl xl:text-7xl"
          style={{
            backgroundImage: "radial-gradient(circle, #0F0F0F 56%, transparent 60%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Build
        </span>
      </Card>
    </div>
  );
}
