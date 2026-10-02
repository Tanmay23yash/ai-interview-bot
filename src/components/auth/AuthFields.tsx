import { useId, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

/* Form controls for the auth pages, in the landing page style. Colours are --lp-* tokens, so they follow light/dark. */

type FieldProps = {
  label: string;
  /** Rendered on the label row, right-aligned (e.g. a "Forgot password?" link). */
  labelAside?: ReactNode;
  /** Rendered inside the input, right-aligned (e.g. a show/hide toggle). */
  trailing?: ReactNode;
} & ComponentProps<"input">;

export function TextField({ label, labelAside, trailing, id, className = "", ...props }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <label htmlFor={inputId} className="font-['Geist_Mono'] text-[11px] uppercase tracking-[0.16em] text-lp-ink/50">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          id={inputId}
          className={`w-full rounded-2xl bg-lp-surface px-4 py-3.5 text-[15px] text-lp-ink outline-none ring-1 ring-transparent transition placeholder:text-lp-ink/30 hover:bg-lp-surface-hover focus:bg-lp-field-focus focus:ring-lp-ink ${trailing ? "pr-12" : ""} ${className}`}
          {...props}
        />
        {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-lp-ink/45 transition hover:bg-lp-ink/5 hover:text-lp-ink"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      }
    />
  );
}

export function SubmitButton({
  loading,
  loadingText,
  disabled,
  children,
}: {
  loading: boolean;
  loadingText: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="group flex w-full items-center justify-center gap-2 rounded-full bg-lp-ink px-6 py-4 text-base font-medium text-lp-bg shadow-[0_18px_40px_-20px_rgba(15,15,15,0.7)] transition hover:bg-lp-button-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-lp-bg/30 border-t-lp-bg" />
          {loadingText}
        </>
      ) : (
        <>
          {children}
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
        </>
      )}
    </button>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const error = tone === "error";

  return (
    <motion.div
      role={error ? "alert" : "status"}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        error ? "bg-[#ea2a8e]/10 text-lp-error" : "bg-[#63AD45]/15 text-lp-success"
      }`}
    >
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${error ? "bg-[#ea2a8e]" : "bg-[#63AD45]"}`} />
      <div>{children}</div>
    </motion.div>
  );
}
