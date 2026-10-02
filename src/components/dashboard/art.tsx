import type { CSSProperties, ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

/*
 * Decorative line art for the dashboard. All motion is CSS transform
 * animation (keyframes in index.css), so it runs on the compositor.
 */

const RINGS = 9;
const TUNNEL_SECONDS = 10;

/** Wireframe tunnel: rounded frames flowing out of a vanishing point, toward the viewer. */
export function Tunnel({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute left-[64%] top-[44%]">
        {Array.from({ length: RINGS }, (_, i) => (
          <div
            key={i}
            className="absolute -ml-[480px] -mt-[310px] h-[620px] w-[960px] rounded-[56px] border-[1.5px] border-hm-faint will-change-transform"
            style={
              reduce
                ? { transform: `scale(${0.15 + (i / RINGS) * 1.2})` }
                : { animation: `tunnel ${TUNNEL_SECONDS}s linear ${(-i * TUNNEL_SECONDS) / RINGS}s infinite` }
            }
          />
        ))}
        {/* headlamp at the far end of the tunnel */}
        <div
          className="absolute -ml-[90px] -mt-[90px] h-[180px] w-[180px]"
          style={{ background: "radial-gradient(closest-side, rgba(244,121,32,0.55), rgba(244,121,32,0.12) 45%, transparent)" }}
        />
        <div className="absolute -ml-[3px] -mt-[3px] h-[6px] w-[6px] rounded-full bg-hm-accent" />
      </div>
    </div>
  );
}

/** A resume page drawn in lines, with an accent scan beam sweeping down it. */
export function ResumeArt({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const bar = (w: string, color = "bg-hm-on-block/25") => <div className={`h-[3px] rounded-full ${color}`} style={{ width: w }} />

  return (
    <div aria-hidden="true" className={`relative overflow-hidden rounded-md border border-hm-on-block/30 p-[9%] ${className}`}>
      <div className="mb-[12%] flex items-center gap-3">
        <div className="aspect-square w-[18%] rounded-full border border-hm-on-block/40" />
        <div className="flex-1 space-y-2">
          {bar("70%", "bg-hm-on-block/50")}
          {bar("45%")}
        </div>
      </div>
      <div className="space-y-[7%]">
        {bar("100%")}
        {bar("88%")}
        {bar("36%", "bg-hm-accent")}
        {bar("94%")}
        {bar("72%")}
        {bar("84%")}
        {bar("58%")}
      </div>
      {!reduce && (
        <div
          className="absolute inset-x-0 top-0 h-[18%] bg-gradient-to-b from-transparent via-hm-accent/25 to-transparent will-change-transform"
          style={{ animation: "scan 3.8s ease-in-out infinite" }}
        />
      )}
    </div>
  );
}

/** A few markdown-ish question lines, as generated for a resume. */
export function QuestionsArt({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`space-y-2 font-['Geist_Mono'] text-[9px] leading-tight text-hm-on-block/70 ${className}`}>
      <div className="text-hm-on-block">## TECHNICAL</div>
      <div className="flex gap-1.5"><span className="text-hm-accent">-</span><span className="h-[3px] w-[78%] translate-y-1.5 rounded-full bg-hm-on-block/30" /></div>
      <div className="flex gap-1.5"><span className="text-hm-accent">-</span><span className="h-[3px] w-[62%] translate-y-1.5 rounded-full bg-hm-on-block/30" /></div>
      <div className="pt-1 text-hm-on-block">## BEHAVIORAL</div>
      <div className="hidden gap-1.5 sm:flex"><span className="text-hm-accent">-</span><span className="h-[3px] w-[70%] translate-y-1.5 rounded-full bg-hm-on-block/30" /></div>
    </div>
  );
}

/** Large line icon inside two thin rings, with an accent dot orbiting the outer ring. */
export function OrbitArt({ children, seconds = 16 }: { children: ReactNode; seconds?: number }) {
  const reduce = useReducedMotion();
  const spin: CSSProperties | undefined = reduce ? undefined : { animation: `orbit ${seconds}s linear infinite` };

  return (
    <div aria-hidden="true" className="relative aspect-square w-[62%] text-hm-on-block">
      <div className="absolute inset-0 rounded-full border border-hm-on-block/20" />
      <div className="absolute inset-[16%] rounded-full border border-dashed border-hm-on-block/25" />
      <div className="absolute inset-0 will-change-transform" style={spin}>
        <span className="absolute left-1/2 top-0 -ml-[5px] -mt-[5px] h-[10px] w-[10px] rounded-full bg-hm-accent" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
