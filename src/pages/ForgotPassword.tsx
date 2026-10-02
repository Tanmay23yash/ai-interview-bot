import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../lib/api";
import { ArrowLeft } from "lucide-react";
import AuthShell from "../components/auth/AuthShell";
import { Notice, SubmitButton, TextField } from "../components/auth/AuthFields";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Please enter a valid email"
        );
      }

      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to reset it."
      prompt={{ text: "Remembered it?", label: "Log in", to: "/login" }}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
        />

        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}

        <div className="pt-2">
          <SubmitButton loading={loading} loadingText="Sending…">
            Send reset link
          </SubmitButton>
        </div>

        <Link
          to="/login"
          className="flex items-center justify-center gap-2 pt-2 text-sm text-lp-ink/55 transition hover:text-lp-ink"
        >
          <ArrowLeft size={16} /> Back to log in
        </Link>
      </form>
    </AuthShell>
  );
}
