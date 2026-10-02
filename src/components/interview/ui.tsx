import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Check, Loader2, Play, RotateCcw } from "lucide-react";
import { ApiError } from "../../lib/api";
import { LEVEL_LABELS } from "../../lib/interview";

/* Building blocks shared by the interview pages, in the dashboard's visual language. */

export const MONO = "font-['Geist_Mono'] uppercase";

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[11px] tracking-wide text-hm-muted ${MONO} ${className}`}>{children}</div>;
}

/** The dashboard's solid button with an inset play square, as a <button>. */
export function ArrowButton({
  children,
  onClick,
  disabled,
  busy,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`group inline-flex items-center gap-6 rounded-md border border-hm-invert bg-hm-invert py-1 pl-5 pr-1 text-xs text-hm-on-invert transition-colors hover:border-hm-accent hover:bg-hm-accent hover:text-[#151515] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hm-accent disabled:pointer-events-none disabled:opacity-45 ${MONO} ${className}`}
    >
      {children}
      <span className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-hm-on-invert text-hm-invert transition-colors group-hover:bg-[#151515] group-hover:text-hm-accent">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={11} fill="currentColor" strokeWidth={0} />}
      </span>
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center gap-2 rounded-full border border-hm-line px-4 text-xs transition-colors hover:border-hm-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hm-accent disabled:pointer-events-none disabled:opacity-45 ${MONO} ${className}`}
    >
      {children}
    </button>
  );
}

/** A row of mutually exclusive options (radio semantics). */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={`min-h-10 rounded-md border px-3.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hm-accent ${
              selected ? "border-hm-ink bg-hm-ink text-hm-bg" : "border-hm-line hover:border-hm-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[3px] px-1.5 py-[3px] text-[11px] leading-none ${MONO} ${
        accent ? "bg-hm-accent text-[#151515]" : "border border-hm-line text-hm-muted"
      }`}
    >
      {children}
    </span>
  );
}

/** Five ticks, filled up to the level. */
export function DifficultyMeter({ level, className = "" }: { level: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`Difficulty ${level} of 5, ${LEVEL_LABELS[level]}`}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <span aria-hidden="true" className="flex items-end gap-[3px]">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`w-[5px] rounded-[1px] ${n <= level ? "bg-hm-chart" : "bg-hm-faint"}`}
            style={{ height: 6 + n * 2.5 }}
          />
        ))}
      </span>
      <span className={`text-[11px] ${MONO}`}>{LEVEL_LABELS[level]}</span>
    </span>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const ref = error instanceof ApiError ? error.correlationId : null;
  return (
    <div role="alert" className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-hm-accent/50 bg-hm-accent/10 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{message}</p>
        {ref && <p className={`mt-1 break-all text-[11px] text-hm-muted ${MONO}`}>Ref {ref}</p>}
      </div>
      {onRetry && (
        <GhostButton onClick={onRetry}>
          <RotateCcw size={13} /> Retry
        </GhostButton>
      )}
    </div>
  );
}

/**
 * The agent steps behind a slow request. The server answers in one go, so the
 * steps advance on typical timings; the list completes when the request does.
 */
export function AgentSteps({ steps, title }: { steps: { label: string; ms: number }[]; title: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= steps.length - 1) return;
    const timer = setTimeout(() => setActive((a) => a + 1), steps[active].ms);
    return () => clearTimeout(timer);
  }, [active, steps]);

  return (
    <div role="status" aria-live="polite" className="rounded-md border border-hm-line bg-hm-card p-5">
      <Eyebrow>{title}</Eyebrow>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={s.label} className={`flex items-center gap-3 text-sm ${i > active ? "text-hm-muted" : ""}`}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              {i < active ? (
                <Check size={15} className="text-hm-accent" />
              ) : i === active ? (
                <Loader2 size={15} className="animate-spin text-hm-accent" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-hm-faint" />
              )}
            </span>
            {s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SectionTitle({ index, children, aside }: { index: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-hm-line pb-4">
      <h2 className="flex items-baseline gap-4 text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
        <span className={`text-[11px] font-normal tracking-normal text-hm-muted ${MONO}`}>{index}</span>
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function BulletList({ items, empty = "None" }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-hm-muted">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
          <span aria-hidden="true" className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-hm-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
