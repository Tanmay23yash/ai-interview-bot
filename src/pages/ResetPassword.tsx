import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "../lib/api";
import { ArrowRight } from "lucide-react";
import AuthShell from "../components/auth/AuthShell";
import { Notice, PasswordField, SubmitButton } from "../components/auth/AuthFields";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Could not reset password"
        );
      }

      setSuccess("Password updated. Redirecting to log in…");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="This link doesn't work."
        subtitle="The reset link is missing its token. Request a fresh one and try again."
        prompt={{ text: "Remembered it?", label: "Log in", to: "/login" }}
      >
        <Link
          to="/forgot-password"
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-lp-ink px-6 py-4 text-base font-medium text-lp-bg transition hover:bg-lp-button-hover"
        >
          Request a new link
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password."
      subtitle="Choose a password with at least 8 characters."
      prompt={{ text: "Remembered it?", label: "Log in", to: "/login" }}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <PasswordField
          label="New password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
        <PasswordField
          label="Confirm password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type it again"
        />

        {error && (
          <Notice tone="error">
            {error}{" "}
            {error.includes("invalid or has expired") && (
              <Link to="/forgot-password" className="font-medium underline underline-offset-2">
                Request a new link
              </Link>
            )}
          </Notice>
        )}
        {success && <Notice tone="success">{success}</Notice>}

        <div className="pt-2">
          <SubmitButton loading={loading} loadingText="Saving…" disabled={!!success}>
            Reset password
          </SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}
