import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect } from "react";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/**
 * Fixed page background: drifting aurora blobs, a masked dot grid,
 * film grain and a soft spotlight that trails the cursor.
 */
export default function Backdrop() {
  const reduce = useReducedMotion();

  const mx = useMotionValue(-600);
  const my = useMotionValue(-600);
  const sx = useSpring(mx, { stiffness: 90, damping: 22 });
  const sy = useSpring(my, { stiffness: 90, damping: 22 });
  const spotlight = useMotionTemplate`radial-gradient(520px circle at ${sx}px ${sy}px, rgba(139,92,246,0.13), transparent 70%)`;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my]);

  const drift = (x: number[], y: number[], duration: number) =>
    reduce
      ? undefined
      : {
          x,
          y,
          transition: { duration, repeat: Infinity, repeatType: "mirror" as const, ease: "easeInOut" as const },
        };

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#07070b]">
      {/* aurora blobs */}
      <motion.div
        className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-violet-600/25 blur-[130px]"
        animate={drift([0, 120, -40], [0, 80, 140], 22)}
      />
      <motion.div
        className="absolute -right-32 top-1/4 h-[30rem] w-[30rem] rounded-full bg-fuchsia-600/20 blur-[130px]"
        animate={drift([0, -140, 40], [0, 100, -60], 26)}
      />
      <motion.div
        className="absolute bottom-[-12rem] left-1/3 h-[32rem] w-[32rem] rounded-full bg-cyan-500/15 blur-[140px]"
        animate={drift([0, 160, -80], [0, -60, 40], 30)}
      />

      {/* dot grid, faded toward the edges */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, #000 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, #000 30%, transparent 100%)",
        }}
      />

      {/* cursor spotlight */}
      <motion.div className="absolute inset-0" style={{ background: spotlight }} />

      {/* film grain */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
    </div>
  );
}
