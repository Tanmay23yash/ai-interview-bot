import { useRef } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

type Props = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  label?: string;
};

const BORDER_MASK: CSSProperties = {
  padding: 1,
  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
};

/**
 * Glass card with a cursor-following glow, a lit border and a gentle 3D tilt.
 * Pass onClick to make the whole card act as a button.
 */
export default function SpotlightCard({ children, className = "", onClick, label }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const mx = useMotionValue(-300);
  const my = useMotionValue(-300);
  const tiltX = useSpring(useMotionValue(0), { stiffness: 160, damping: 18 });
  const tiltY = useSpring(useMotionValue(0), { stiffness: 160, damping: 18 });

  const glow = useMotionTemplate`radial-gradient(380px circle at ${mx}px ${my}px, rgba(139,92,246,0.16), transparent 65%)`;
  const edge = useMotionTemplate`radial-gradient(260px circle at ${mx}px ${my}px, rgba(196,181,253,0.85), transparent 65%)`;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mx.set(x);
    my.set(y);
    if (!reduce) {
      tiltY.set((x / rect.width - 0.5) * 6);
      tiltX.set(-(y / rect.height - 0.5) * 6);
    }
  }

  function handleLeave() {
    mx.set(-300);
    my.set(-300);
    tiltX.set(0);
    tiltY.set(0);
  }

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  }

  const interactive = Boolean(onClick);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onClick}
      onKeyDown={handleKey}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? label : undefined}
      style={{ rotateX: tiltX, rotateY: tiltY, transformPerspective: 1000 }}
      whileTap={interactive ? { scale: 0.985 } : undefined}
      className={`group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-zinc-900/40 backdrop-blur-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-violet-400/70 ${
        interactive ? "cursor-pointer" : ""
      } ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: glow }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: edge, ...BORDER_MASK }}
      />
      <div className="relative h-full">{children}</div>
    </motion.div>
  );
}
