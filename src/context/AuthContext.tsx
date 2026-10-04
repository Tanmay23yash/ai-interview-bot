import { createContext, useCallback, useContext, useEffect, useState } from "react";

type AuthContextType = {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

/** Milliseconds until the token's exp claim runs out; 0 once it has, or if it can't be read. */
function msUntilExpiry(token: string): number {
  try {
    const payload = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === "number" ? Math.max(0, exp * 1000 - Date.now()) : 0;
  } catch {
    return 0;
  }
}

/** The saved token, unless it has expired (then it is cleared, so the user is signed out). */
function savedToken(): string | null {
  const token = localStorage.getItem("token");
  if (token && msUntilExpiry(token) > 0) return token;
  localStorage.removeItem("token");
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Read synchronously: with an effect, the first render had no token and
  // ProtectedRoute bounced every page reload to /login.
  const [token, setToken] = useState<string | null>(savedToken);

  const login = useCallback((newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
  }, []);

  // Sign out when the token expires. The API rejects it from then on (401), so pages
  // would otherwise look signed in while every request fails. The visibility check
  // covers a computer that slept through the timer.
  useEffect(() => {
    if (!token) return;
    const checkExpiry = () => {
      if (msUntilExpiry(token) === 0) logout();
    };
    const timer = window.setTimeout(logout, msUntilExpiry(token));
    document.addEventListener("visibilitychange", checkExpiry);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkExpiry);
    };
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
