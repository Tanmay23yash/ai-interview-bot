import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../lib/api";
import { Notice } from "./AuthFields";

/*
 * "Sign up / Sign in with Google". Google Identity Services draws the button
 * and hands back an ID token; the backend verifies it (POST /auth/google) and
 * swaps it for our usual access token. Renders nothing until the backend says
 * GOOGLE_CLIENT_ID is set, so the email form keeps working on its own.
 */

type CredentialResponse = { credential?: string };
type GoogleIdentity = {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    ux_mode?: "popup" | "redirect";
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";
// Google's button is 200-400px wide; the auth form column tops out at 400.
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

// Module-level, so moving between login and signup neither refetches nor re-initialises Google.
let configRequest: Promise<string | null> | null = null;
let scriptRequest: Promise<GoogleIdentity> | null = null;
let initializedFor: string | null = null;
// Google keeps the callback passed to initialize(); this points it at the mounted button.
let onCredential: ((response: CredentialResponse) => void) | null = null;

function loadClientId(): Promise<string | null> {
  configRequest ??= apiRequest<{ client_id: string | null }>("/auth/google/config").then(
    (config) => config.client_id,
    (err) => {
      configRequest = null;
      throw err;
    }
  );
  return configRequest;
}

function loadGoogle(): Promise<GoogleIdentity> {
  scriptRequest ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () =>
      window.google ? resolve(window.google.accounts.id) : reject(new Error("Google sign-in didn't start"));
    script.onerror = () => {
      script.remove();
      scriptRequest = null;
      reject(new Error("Google sign-in script failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptRequest;
}

// The auth pages set data-theme on <html>; follow it so Google's button switches with the page.
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function EmailDivider() {
  return (
    <div className="flex items-center gap-4 font-['Geist_Mono'] text-[11px] uppercase tracking-[0.16em] text-lp-ink/40">
      <span className="h-px flex-1 bg-lp-ink/10" />
      or with email
      <span className="h-px flex-1 bg-lp-ink/10" />
    </div>
  );
}

/** Development only: marks where the button goes, so a missing client ID isn't a silent blank. */
function SetupHint({ mode }: { mode: "signup" | "signin" }) {
  return (
    <div className="mb-6 space-y-5">
      <div className="rounded-2xl border border-dashed border-lp-ink/25 px-4 py-3 text-sm leading-relaxed text-lp-ink/60">
        <span className="font-medium text-lp-ink">{mode === "signup" ? "Sign up" : "Sign in"} with Google</span> appears
        here once <code className="font-['Geist_Mono'] text-[13px] text-lp-ink">GOOGLE_CLIENT_ID</code> is set in
        backend/.env and the backend is restarted. Only shown in development.
      </div>
      <EmailDivider />
    </div>
  );
}

export default function GoogleButton({ mode }: { mode: "signup" | "signin" }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const theme = useSyncExternalStore(subscribeTheme, readTheme);
  const slot = useRef<HTMLDivElement>(null);

  // undefined while asking the backend; null when Google sign-in isn't configured.
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const [width, setWidth] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    loadClientId().then(
      (id) => {
        if (live) setClientId(id);
      },
      // Backend unreachable: leave the button out; the email form reports the problem on submit.
      () => {}
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    onCredential = async ({ credential }) => {
      if (!credential) return;
      setError("");
      setBusy(true);
      try {
        const { access_token } = await apiRequest<{ access_token: string }>("/auth/google", {
          method: "POST",
          json: { credential },
        });
        login(access_token);
        navigate("/dashboard");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google sign-in failed. Please try again.");
        setBusy(false);
      }
    };
    return () => {
      onCredential = null;
    };
  });

  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [clientId]);

  useEffect(() => {
    const el = slot.current;
    if (!clientId || !el || !width) return;
    let live = true;
    loadGoogle().then(
      (google) => {
        if (!live) return;
        if (initializedFor !== clientId) {
          google.initialize({ client_id: clientId, callback: (response) => onCredential?.(response), ux_mode: "popup" });
          initializedFor = clientId;
        }
        el.replaceChildren();
        google.renderButton(el, {
          type: "standard",
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text: mode === "signup" ? "signup_with" : "signin_with",
          logo_alignment: "center",
          width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)),
        });
        setStatus("ready");
      },
      () => {
        if (live) setStatus("failed");
      }
    );
    return () => {
      live = false;
    };
  }, [clientId, mode, theme, width]);

  if (clientId === null && import.meta.env.DEV) return <SetupHint mode={mode} />;
  if (!clientId) return null;

  return (
    <div className="mb-6 space-y-5">
      {status === "failed" ? (
        <Notice tone="error">Google sign-in couldn't load. Check your connection, or use your email below.</Notice>
      ) : (
        <div className="relative min-h-[44px]">
          {status === "loading" && (
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-10 animate-pulse rounded-full bg-lp-surface" />
          )}
          <div
            ref={slot}
            aria-busy={busy}
            className={`relative flex justify-center transition-opacity ${busy ? "pointer-events-none opacity-50" : ""}`}
          />
        </div>
      )}

      {busy && (
        <p role="status" className="flex items-center justify-center gap-2 text-sm text-lp-ink/55">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-lp-ink/20 border-t-lp-ink" />
          Signing you in with Google…
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <EmailDivider />
    </div>
  );
}
