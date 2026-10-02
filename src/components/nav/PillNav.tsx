import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { MotionProps } from "framer-motion";
import { Menu, X } from "lucide-react";

/*
 * The site's navigation bar: a floating dark pill with the brand on the left,
 * page links centred, and one white call-to-action pill on the right. Below lg
 * the links move into a rounded panel that drops under the bar. Colours come
 * from --nav-* (index.css): black on light pages, a lifted grey on dark ones.
 */

export type PillNavLink = { label: string; to?: string; href?: string; end?: boolean };
export type PillNavAction = { label: string; to?: string; href?: string; onClick?: () => void; icon?: ReactNode };

// No display class here: each use sets one (inline-flex, or hidden lg:inline-flex),
// since two display utilities on one element do not reliably resolve by class order.
const CTA =
  "h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-4 text-[15px] font-medium text-[#0f0f0f] transition-colors hover:bg-white/85 sm:px-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const QUIET =
  "h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[15px] font-medium text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

function ActionLink({ action, className, onDone }: { action: PillNavAction; className: string; onDone?: () => void }) {
  const content = (
    <>
      {action.icon}
      {action.label}
    </>
  );
  if (action.to)
    return (
      <Link to={action.to} onClick={onDone} className={className}>
        {content}
      </Link>
    );
  if (action.href)
    return (
      <a href={action.href} onClick={onDone} className={className}>
        {content}
      </a>
    );
  return (
    <button
      type="button"
      onClick={() => {
        onDone?.();
        action.onClick?.();
      }}
      className={className}
    >
      {content}
    </button>
  );
}

function NavItem({ link, inPanel, onDone }: { link: PillNavLink; inPanel: boolean; onDone?: () => void }) {
  const style = (active: boolean) =>
    `${inPanel ? "block px-6 py-2.5 text-lg" : "px-4 py-2 text-[15px]"} rounded-full font-medium transition-colors ${FOCUS} ${
      active ? "bg-white/10 text-white" : "text-white/70 hover:text-white"
    }`;
  if (link.href)
    return (
      <a href={link.href} onClick={onDone} className={style(false)}>
        {link.label}
      </a>
    );
  return (
    <NavLink to={link.to ?? "/"} end={link.end} onClick={onDone} className={({ isActive }) => style(isActive)}>
      {link.label}
    </NavLink>
  );
}

export default function PillNav({
  label = "Main",
  brand,
  brandTo,
  brandLabel,
  links = [],
  tools,
  note,
  secondary,
  cta,
  ctaOnPhone = true,
  position = "sticky",
  inset = true,
  surface = "auto",
  intro,
}: {
  label?: string;
  /** Contents of the brand link (left). */
  brand: ReactNode;
  brandTo: string;
  brandLabel: string;
  /** Page links: centred from lg up, in the drop-down panel below. */
  links?: PillNavLink[];
  /** Small round controls before the CTA, at every size (theme switch, History). */
  tools?: ReactNode;
  /** Short text before the CTA from sm up, e.g. "New here?". */
  note?: string;
  /** A quiet text link before the CTA from lg up (e.g. Log in); in the panel below lg. */
  secondary?: PillNavAction;
  /** The white pill on the right. */
  cta?: PillNavAction;
  /** false moves the CTA into the panel below lg, for bars without room for it. */
  ctaOnPhone?: boolean;
  position?: "fixed" | "sticky" | "static";
  /** Space around the floating bar; off when the page already pads it. */
  inset?: boolean;
  /** "dark" for pages that are always dark, so the bar still stands out. */
  surface?: "auto" | "dark";
  /** Optional entrance animation for the bar. */
  intro?: MotionProps;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  const ctaInPanel = !!cta && !ctaOnPhone;
  const hasPanel = links.length > 0 || !!secondary || ctaInPanel;
  const close = () => setOpen(false);

  // Escape or a tap outside closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const place = position === "fixed" ? "fixed inset-x-0 top-0" : position === "sticky" ? "sticky top-0" : "relative";

  return (
    <motion.header
      {...intro}
      className={`${place} pointer-events-none z-50 ${inset ? "px-3 pt-3 sm:px-5 sm:pt-4" : ""}`}
    >
      <div ref={root} className={`pointer-events-auto mx-auto max-w-6xl ${surface === "dark" ? "nav-on-dark" : ""}`}>
        <nav
          aria-label={label}
          className="flex h-[60px] items-center justify-between gap-2 rounded-full bg-nav-bg p-2 font-['Geist',sans-serif] text-white shadow-[0_18px_40px_-20px_var(--nav-shadow)] ring-1 ring-nav-ring lg:grid lg:grid-cols-[1fr_auto_1fr]"
        >
          <Link
            to={brandTo}
            aria-label={brandLabel}
            onClick={close}
            className={`flex min-w-0 items-center gap-3 rounded-full lg:justify-self-start ${FOCUS}`}
          >
            {brand}
          </Link>

          {links.length > 0 ? (
            <ul className="hidden items-center gap-1 lg:flex">
              {links.map((l) => (
                <li key={l.label}>
                  <NavItem link={l} inPanel={false} />
                </li>
              ))}
            </ul>
          ) : (
            <span className="hidden lg:block" />
          )}

          <div className="flex shrink-0 items-center gap-2 lg:justify-self-end">
            {tools}
            {note && <span className="hidden whitespace-nowrap pl-1 text-sm text-white/55 sm:inline">{note}</span>}
            {secondary && <ActionLink action={secondary} className={`${QUIET} hidden lg:inline-flex`} />}
            {cta && <ActionLink action={cta} className={`${CTA} ${ctaInPanel ? "hidden lg:inline-flex" : "inline-flex"}`} />}
            {hasPanel && (
              <button
                ref={toggle}
                type="button"
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((o) => !o)}
                className={`grid h-11 w-11 place-items-center rounded-full text-white transition-colors hover:bg-white/10 lg:hidden ${FOCUS}`}
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
          </div>
        </nav>

        <AnimatePresence>
          {open && (
            <motion.div
              id={panelId}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 origin-top rounded-[28px] bg-nav-bg px-5 py-6 text-white shadow-[0_24px_48px_-24px_var(--nav-shadow)] ring-1 ring-nav-ring lg:hidden"
            >
              {links.length > 0 && (
                <ul className="flex flex-col items-center gap-1">
                  {links.map((l) => (
                    <li key={l.label}>
                      <NavItem link={l} inPanel onDone={close} />
                    </li>
                  ))}
                </ul>
              )}
              {(secondary || ctaInPanel) && (
                <div className={`flex flex-col gap-2 ${links.length > 0 ? "mt-5 border-t border-white/10 pt-5" : ""}`}>
                  {secondary && (
                    <ActionLink action={secondary} className={`${QUIET} flex w-full ring-1 ring-white/20`} onDone={close} />
                  )}
                  {cta && ctaInPanel && <ActionLink action={cta} className={`${CTA} flex w-full`} onDone={close} />}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
