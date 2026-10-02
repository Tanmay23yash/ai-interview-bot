import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { MotionProps } from "framer-motion";
import { LogOut } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import type { Theme } from "../../hooks/useDocumentTheme";
import ThemeToggle from "../dashboard/ThemeToggle";
import PillNav from "./PillNav";

const LINKS = [
  { to: "/dashboard", label: "Dashboard", end: true },
  { to: "/upload", label: "Upload" },
  { to: "/questions", label: "My questions" },
  { to: "/interview", label: "Mock interview" },
];

/** The nav pill for signed-in pages: wordmark only, the app's pages, theme switch and Sign out. */
export default function AppNav({
  theme,
  onThemeChange,
  tools,
  position,
  surface,
  intro,
}: {
  /** Omit on pages that are always dark (no theme switch there). */
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  /** Page-specific controls before the theme switch (e.g. History). */
  tools?: ReactNode;
  position?: "fixed" | "sticky" | "static";
  surface?: "auto" | "dark";
  intro?: MotionProps;
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <PillNav
      brand={<span className="pl-3 pr-1 font-['Schibsted_Grotesk'] text-lg font-bold tracking-tight">HireMind</span>}
      brandTo="/dashboard"
      brandLabel="HireMind dashboard"
      links={LINKS}
      tools={
        <>
          {tools}
          {theme && onThemeChange && <ThemeToggle theme={theme} onChange={onThemeChange} showLabel={false} tone="inverse" />}
        </>
      }
      cta={{
        label: "Sign out",
        icon: <LogOut size={15} strokeWidth={1.75} />,
        onClick: () => {
          logout();
          navigate("/");
        },
      }}
      ctaOnPhone={false}
      position={position}
      surface={surface}
      intro={intro}
    />
  );
}
