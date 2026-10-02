import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { LEVEL_LABELS, pad } from "../../lib/interview";
import { MONO } from "./ui";

/*
 * Report charts. One hue (--hm-chart, validated for both themes) on a
 * same-hue track; text always in ink tokens; hairline solid grid; every value
 * also visible as a label or in the tables below, so tooltips never gate.
 */

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // ResizeObserver reports the initial size as soon as observation starts.
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/* ---------------- meter list ---------------- */

export type MeterItem = { label: string; value: number; detail?: string };

/** Horizontal score bars against a fixed max, value at the end of each row. */
export function MeterList({ items, max, label }: { items: MeterItem[]; max: number; label: string }) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <ul aria-label={label} className="space-y-4" onPointerLeave={() => setActive(null)}>
      {items.map((item, i) => {
        const pct = Math.max(0, Math.min(100, (item.value / max) * 100));
        const dimmed = active !== null && active !== i;
        return (
          <li
            key={item.label}
            tabIndex={0}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            aria-label={`${item.label}: ${fmt(item.value)} out of ${max}${item.detail ? `, ${item.detail}` : ""}`}
            className="relative grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-hm-accent focus-visible:ring-offset-4 focus-visible:ring-offset-hm-card"
          >
            <span className="truncate text-sm">{item.label}</span>
            <span className="text-sm font-medium tabular-nums">
              {fmt(item.value)}
              <span className="font-normal text-hm-muted">/{max}</span>
            </span>
            <span aria-hidden="true" className="relative col-span-2 block h-2.5 rounded-r-[4px] bg-hm-chart/15">
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] bg-hm-chart transition-opacity duration-200"
                style={{ width: `${pct}%`, opacity: dimmed ? 0.45 : 1 }}
              />
            </span>
            {active === i && item.detail && (
              <span
                role="tooltip"
                className="pointer-events-none absolute -top-9 right-0 z-10 whitespace-nowrap rounded-md border border-hm-line bg-hm-bg px-2.5 py-1.5 text-xs shadow-sm"
              >
                <strong className="font-medium tabular-nums">{fmt(item.value)}</strong>
                <span className="text-hm-muted"> · {item.detail}</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- difficulty + score, as two aligned small multiples ---------------- */

export type ProgressPoint = { turn: number; difficulty: number; score: number; topic: string };

const MARGIN = { left: 34, right: 10 };
const TITLE_H = 22;
const DIFF_H = 104;
const GAP = 26;
const SCORE_H = 124;
const AXIS_H = 26;

/**
 * Difficulty (1-5, step line) above score (0-10, columns), sharing the
 * question axis and one crosshair. Two plots, never two y-scales on one.
 */
export function ProgressionChart({ points }: { points: ProgressPoint[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const width = useWidth(boxRef);
  const [active, setActive] = useState<number | null>(null);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const band = points.length ? plotW / points.length : 0;
  const x = (i: number) => MARGIN.left + band * (i + 0.5);

  const diffTop = TITLE_H;
  const yDiff = (level: number) => diffTop + DIFF_H - ((level - 1) / 4) * DIFF_H;
  const scoreTop = diffTop + DIFF_H + GAP + TITLE_H;
  const base = scoreTop + SCORE_H;
  const yScore = (score: number) => base - (score / 10) * SCORE_H;
  const height = base + AXIS_H;
  const barW = Math.max(4, Math.min(24, band * 0.55));
  const best = points.reduce((b, p, i) => (p.score > points[b].score ? i : b), 0);
  const labelEvery = band < 26 ? 2 : 1;

  // Step-after line: each question holds its level across its band.
  const stepPath = points
    .map((p, i) => {
      const left = MARGIN.left + band * i;
      const y = yDiff(p.difficulty);
      return i === 0 ? `M${left},${y} H${left + band}` : `V${y} H${left + band}`;
    })
    .join(" ");

  function column(p: ProgressPoint, i: number): string {
    const top = yScore(p.score);
    const left = x(i) - barW / 2;
    const r = Math.min(4, (base - top) / 2, barW / 2);
    return `M${left},${base} V${top + r} Q${left},${top} ${left + r},${top} H${left + barW - r} Q${left + barW},${top} ${left + barW},${top + r} V${base} Z`;
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    setActive((a) => Math.max(0, Math.min(points.length - 1, (a ?? -1) + step)));
  }

  const current = active !== null ? points[active] : null;
  const describe = (p: ProgressPoint) =>
    `Question ${p.turn}, ${p.topic}: scored ${fmt(p.score)} out of 10 at ${LEVEL_LABELS[p.difficulty]} difficulty`;

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      role="group"
      aria-label="Difficulty and score by question. Use the left and right arrow keys to step through questions."
      onKeyDown={onKeyDown}
      onFocus={() => setActive((a) => a ?? points.length - 1)}
      onBlur={() => setActive(null)}
      onPointerLeave={() => setActive(null)}
      className="relative rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-hm-accent focus-visible:ring-offset-4 focus-visible:ring-offset-hm-card"
    >
      <p className="sr-only" aria-live="polite">
        {current ? describe(current) : ""}
      </p>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true" className="block overflow-visible">
          {/* titles */}
          <text x={0} y={12} className={`fill-hm-muted text-[10px] ${MONO}`}>
            Difficulty level
          </text>
          <text x={0} y={scoreTop - 10} className={`fill-hm-muted text-[10px] ${MONO}`}>
            Score out of 10
          </text>

          {/* grids + y ticks */}
          {[1, 2, 3, 4, 5].map((level) => (
            <g key={level}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yDiff(level)} y2={yDiff(level)} className="stroke-hm-line" strokeWidth={1} />
              <text x={MARGIN.left - 10} y={yDiff(level)} dy="0.32em" textAnchor="end" className="fill-hm-muted text-[10px] tabular-nums">
                {level}
              </text>
            </g>
          ))}
          {[0, 5, 10].map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yScore(tick)} y2={yScore(tick)} className="stroke-hm-line" strokeWidth={1} />
              <text x={MARGIN.left - 10} y={yScore(tick)} dy="0.32em" textAnchor="end" className="fill-hm-muted text-[10px] tabular-nums">
                {tick}
              </text>
            </g>
          ))}

          {/* crosshair */}
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={diffTop} y2={base} className="stroke-hm-muted" strokeWidth={1} />
          )}

          {/* difficulty: step line + dots with a surface ring */}
          <path d={stepPath} fill="none" className="stroke-hm-ink" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle
              key={`d${p.turn}`}
              cx={x(i)}
              cy={yDiff(p.difficulty)}
              r={active === i ? 5.5 : 4}
              className="fill-hm-ink stroke-hm-card"
              strokeWidth={2}
            />
          ))}

          {/* score columns */}
          {points.map((p, i) =>
            p.score > 0 ? (
              <path
                key={`s${p.turn}`}
                d={column(p, i)}
                className="fill-hm-chart transition-opacity duration-200"
                opacity={active !== null && active !== i ? 0.45 : 1}
              />
            ) : null
          )}
          {/* direct label on the extreme only */}
          {points.length > 0 && (
            <text x={x(best)} y={yScore(points[best].score) - 6} textAnchor="middle" className="fill-hm-ink text-[10px] font-medium tabular-nums">
              {fmt(points[best].score)}
            </text>
          )}

          {/* x axis */}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text key={`x${p.turn}`} x={x(i)} y={base + 17} textAnchor="middle" className={`fill-hm-muted text-[10px] ${MONO}`}>
                Q{pad(p.turn)}
              </text>
            ) : null
          )}

          {/* hit areas: the whole band, both plots */}
          {points.map((p, i) => (
            <rect
              key={`h${p.turn}`}
              x={MARGIN.left + band * i}
              y={diffTop}
              width={band}
              height={base - diffTop}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
            />
          ))}
        </svg>
      )}

      {current && active !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 z-10 w-max max-w-[220px] rounded-md border border-hm-line bg-hm-bg px-3 py-2 text-xs shadow-sm"
          style={{
            left: Math.min(Math.max(x(active), 110), Math.max(110, width - 110)),
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="text-base font-medium tabular-nums">
            {fmt(current.score)}
            <span className="text-xs font-normal text-hm-muted"> / 10</span>
          </div>
          <div className="mt-0.5">
            {LEVEL_LABELS[current.difficulty]} <span className="text-hm-muted">· level {current.difficulty}</span>
          </div>
          <div className={`mt-1 text-[10px] text-hm-muted ${MONO}`}>
            Q{pad(current.turn)} · {current.topic}
          </div>
        </div>
      )}
    </div>
  );
}
