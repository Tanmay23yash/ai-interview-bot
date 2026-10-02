import { useRef } from "react";
import type { ReactNode } from "react";
import { motion, useInView, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

/**
 * Fades and lifts content once it is on screen and the intro has finished.
 * Opacity + transform only: animating filter: blur() on large cards forced a
 * full re-raster every frame and stuttered the entrance.
 */
export function Reveal({
  children,
  ready,
  delay = 0,
  y = 34,
  className = "",
}: {
  children: ReactNode;
  ready: boolean;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -80px 0px" });
  const show = reduce || (inView && ready);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={show ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Wraps a button so it drifts slightly toward the cursor. */
export function Magnetic({ children, strength = 0.28 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.2 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.2 });

  return (
    <motion.div
      ref={ref}
      className="inline-block"
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
        y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Endless horizontal ticker. Content is duplicated so the loop is seamless.
 * Runs as a CSS animation (see index.css) so it stays smooth even when the main thread is busy.
 */
export function Marquee({ children, duration = 38 }: { children: ReactNode; duration?: number }) {
  const reduce = useReducedMotion();
  const mask = "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)";

  return (
    <div className="overflow-hidden" style={{ maskImage: mask, WebkitMaskImage: mask }}>
      <div
        className="flex w-max will-change-transform"
        style={reduce ? undefined : { animation: `marquee ${duration}s linear infinite` }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
