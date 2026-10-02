import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import MobileNav from "../dashboard/MobileNav";
import ThemeToggle from "../dashboard/ThemeToggle";
import Logo from "../landing/Logo";
import { MONO } from "./ui";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/interview", label: "Mock interview" },
  { to: "/questions", label: "My questions" },
];

/** Page frame for the interview screens: the dashboard's nav, theme and type, without its intro. */
export default function AppShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useDocumentTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div
      data-theme={theme}
      className="min-h-svh bg-hm-bg font-['Geist',sans-serif] text-hm-ink antialiased selection:bg-hm-accent/30"
    >
      <header className="sticky top-0 z-40 border-b border-hm-line bg-hm-bg">
        <nav aria-label="Main" className="flex h-[68px] items-center justify-between gap-4 px-4 sm:px-8">
          <Link to="/dashboard" aria-label="HireMind dashboard">
            <Logo />
          </Link>

          <div className={`hidden items-center gap-8 text-xs md:flex ${MONO}`}>
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `underline-offset-[7px] transition-colors hover:text-hm-accent ${isActive ? "underline decoration-hm-accent decoration-2" : ""}`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle theme={theme} onChange={setTheme} />
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/");
              }}
              aria-label="Sign out"
              className={`flex h-11 items-center gap-2 rounded-full border border-hm-line px-4 text-xs transition-colors hover:border-hm-ink ${MONO}`}
            >
              <LogOut size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </nav>
      </header>
      <MobileNav links={NAV} />

      <main className="mx-auto max-w-[1280px] px-4 pb-24 pt-10 sm:px-8 sm:pt-14">{children}</main>
    </div>
  );
}
