import { useEffect, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useInView, useReducedMotion } from "framer-motion";
import { Play } from "lucide-react";

/* Small building blocks for the cominvi-inspired dashboard. */

const MONO = "font-['Geist_Mono'] uppercase";

/** Stacked section tag: an outlined index over a filled label, e.g. [S.01] / OVERVIEW. */
export function SectionTag({ index, label, className = "" }: { index: string; label: string; className?: string }) {
  return (
    // font-normal/tracking-normal: tags sit inside big headings and must not inherit their weight or tight tracking.
    <span className={`inline-flex flex-col items-start gap-1 align-top text-[10px] font-normal leading-none tracking-normal ${MONO} ${className}`}>
      <span className="rounded-[3px] border border-hm-ink px-1 py-[3px] text-hm-ink">{index}</span>
      <span className="rounded-[3px] bg-hm-ink px-1 py-[3px] text-hm-bg">{label}</span>
    </span>
  );
}

/** Solid button with an inset arrow square. Turns accent orange on hover. */
export function ArrowLink({ to, children, className = "" }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-6 rounded-md border border-hm-invert bg-hm-invert py-1 pl-5 pr-1 text-xs text-hm-on-invert transition-colors hover:border-hm-accent hover:bg-hm-accent hover:text-[#151515] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hm-accent ${MONO} ${className}`}
    >
      {children}
      <span className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-hm-on-invert text-hm-invert transition-colors group-hover:bg-[#151515] group-hover:text-hm-accent">
        <Play size={11} fill="currentColor" strokeWidth={0} />
      </span>
    </Link>
  );
}

const GLYPHS = "0123456789#%&*+=?ABCDEFGHJKLMNPRSTUVXYZ";

/**
 * Text that scrambles through random glyphs and settles left to right when it
 * scrolls into view (or changes). Writes textContent directly, so no React
 * re-render per frame. Screen readers get the plain text.
 */
export function Scramble({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const reduce = useReducedMotion();

  // Before first paint: show the final text, so nothing flashes empty.
  useLayoutEffect(() => {
    if (ref.current) ref.current.textContent = text;
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || !inView) return;

    const chars = text.split("");
    const frames = 14 + chars.length * 2;
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame += 1;
      const settled = Math.floor((frame / frames) * chars.length);
      el.textContent = chars
        .map((ch, i) => (i < settled || /[\s.,:+/-]/.test(ch) ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
        .join("");
      if (frame < frames) raf = requestAnimationFrame(tick);
      else el.textContent = text;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = text;
    };
  }, [text, inView, reduce]);

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span ref={ref} aria-hidden="true" />
    </span>
  );
}
