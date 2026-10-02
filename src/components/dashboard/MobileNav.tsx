import { NavLink } from "react-router-dom";

/**
 * The header's page links, as a row of full-height tap targets for screens
 * below md, where the header has no room for them. It sits in the page flow
 * (not the sticky header), so it scrolls away instead of eating screen height.
 */
export default function MobileNav({
  links,
  className = "",
}: {
  links: { to: string; label: string }[];
  className?: string;
}) {
  return (
    <nav aria-label="Pages" className={`border-b border-hm-line md:hidden ${className}`}>
      <ul className="flex">
        {links.map(({ to, label }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex min-h-12 items-center justify-center px-2 text-center font-['Geist_Mono'] text-[11px] uppercase tracking-[0.08em] underline-offset-[7px] transition-colors ${
                  isActive ? "text-hm-ink underline decoration-hm-accent decoration-2" : "text-hm-muted hover:text-hm-ink"
                }`
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
