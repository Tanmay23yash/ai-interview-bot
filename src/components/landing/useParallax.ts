import type { MouseEvent } from "react";
import { useMotionValue, useSpring } from "framer-motion";

/** Cursor-follow offsets (springy) for parallax charms. Spread `onMouseMove` on the tracking area. */
export function useParallax(strength = 36) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const px = useSpring(mx, { stiffness: 60, damping: 18 });
  const py = useSpring(my, { stiffness: 60, damping: 18 });

  function onMouseMove(e: MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * strength);
    my.set(((e.clientY - r.top) / r.height - 0.5) * strength);
  }

  return { px, py, onMouseMove };
}
