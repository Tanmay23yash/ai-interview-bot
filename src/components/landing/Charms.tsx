import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";

/*
 * Glossy "3D" stickers drawn purely with gradients and shadows — our take on the
 * chrome / candy keychain charms on butter.video. All are decorative (aria-hidden).
 */

const emboss = "0 1px 0 rgba(255,255,255,0.45), 0 -1px 0 rgba(0,0,0,0.25)";

export function HiredDisc({ size = 132 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-['Schibsted_Grotesk'] font-black tracking-tight"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.24,
        color: "#b3126a",
        textShadow: emboss,
        background:
          "radial-gradient(circle at 32% 26%, #ffd1ea 0%, #ff7fc0 18%, #ea2a8e 48%, #a30d5c 100%)",
        boxShadow:
          "inset -10px -14px 26px rgba(90,0,45,0.45), inset 10px 12px 22px rgba(255,255,255,0.45), 0 30px 50px -18px rgba(163,13,92,0.55)",
      }}
    >
      HIRED
    </div>
  );
}

export function ChromeTile({ size = 112, glyph = "?" }: { size?: number; glyph?: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-[28%] font-['Schibsted_Grotesk'] font-black"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.56,
        background:
          "linear-gradient(145deg, #fdfdfd 0%, #b9bcc2 22%, #f4f5f7 38%, #7d8189 62%, #e9eaec 80%, #9a9ea5 100%)",
        boxShadow:
          "inset 0 2px 1px rgba(255,255,255,0.9), inset 0 -6px 14px rgba(0,0,0,0.25), 0 26px 40px -16px rgba(15,15,15,0.45)",
      }}
    >
      <span
        style={{
          backgroundImage: "linear-gradient(180deg, #4b4f57 0%, #d9dbdf 45%, #3a3d43 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          filter: "drop-shadow(0 2px 0 rgba(255,255,255,0.6))",
        }}
      >
        {glyph}
      </span>
    </div>
  );
}

export function InflatedWord({ children, color = "green" }: { children: ReactNode; color?: "green" | "cyan" }) {
  const palette =
    color === "green"
      ? { fill: "linear-gradient(180deg, #c9ff8f 0%, #7fe03a 45%, #3f9e17 100%)", shade: "#2f7a10", glow: "rgba(99,173,69,0.55)" }
      : { fill: "linear-gradient(180deg, #d4f6ff 0%, #6fd6f2 45%, #1f93b8 100%)", shade: "#167594", glow: "rgba(77,197,229,0.55)" };

  return (
    <span
      className="inline-block font-['Schibsted_Grotesk'] font-black italic leading-none tracking-tight"
      style={{
        backgroundImage: palette.fill,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        filter: `drop-shadow(0 2px 0 ${palette.shade}) drop-shadow(0 4px 0 ${palette.shade}) drop-shadow(0 18px 18px ${palette.glow})`,
      }}
    >
      {children}
    </span>
  );
}

export function GlossyPill({ children, tone = "cyan" }: { children: ReactNode; tone?: "cyan" | "yellow" | "ink" }) {
  const tones: Record<string, CSSProperties> = {
    cyan: {
      color: "#063a4a",
      background: "linear-gradient(180deg, #b8efff 0%, #4dc5e5 55%, #2a9fc1 100%)",
      boxShadow: "inset 0 2px 2px rgba(255,255,255,0.7), inset 0 -4px 8px rgba(0,60,80,0.25), 0 18px 30px -14px rgba(42,159,193,0.7)",
    },
    yellow: {
      color: "#4a3f06",
      background: "linear-gradient(180deg, #fff6b8 0%, #e9d352 55%, #c7ad1f 100%)",
      boxShadow: "inset 0 2px 2px rgba(255,255,255,0.7), inset 0 -4px 8px rgba(80,60,0,0.25), 0 18px 30px -14px rgba(199,173,31,0.7)",
    },
    ink: {
      color: "#fafafa",
      background: "linear-gradient(180deg, #4a4a4a 0%, #161616 60%, #000 100%)",
      boxShadow: "inset 0 1px 1px rgba(255,255,255,0.35), 0 18px 30px -14px rgba(0,0,0,0.6)",
    },
  };

  return (
    <span className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-['Geist_Mono'] text-sm font-medium" style={tones[tone]}>
      {children}
    </span>
  );
}

/** Positions a charm, bobs it gently, and shifts it with the cursor for depth. */
export function FloatingCharm({
  children,
  className,
  depth,
  px,
  py,
  delay = 0,
  rotate = 0,
}: {
  children: ReactNode;
  className: string;
  depth: number;
  px: MotionValue<number>;
  py: MotionValue<number>;
  delay?: number;
  rotate?: number;
}) {
  const reduce = useReducedMotion();
  const x = useTransform(px, (v) => v * depth);
  const y = useTransform(py, (v) => v * depth);

  return (
    <motion.div aria-hidden="true" className={`pointer-events-none absolute ${className}`} style={{ x, y }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.6, rotate: rotate - 12 }}
        animate={
          reduce
            ? { opacity: 1, scale: 1, rotate }
            : { opacity: 1, scale: 1, rotate: [rotate, rotate + 4, rotate], y: [0, -12, 0] }
        }
        transition={{
          opacity: { duration: 0.8, delay },
          scale: { type: "spring", stiffness: 120, damping: 12, delay },
          rotate: { duration: 6, repeat: Infinity, ease: "easeInOut", delay },
          y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay },
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
