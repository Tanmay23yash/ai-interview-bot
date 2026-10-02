import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../lib/api";
import AuthShell from "../components/auth/AuthShell";
import { Notice, PasswordField, SubmitButton, TextField } from "../components/auth/AuthFields";
import GoogleButton from "../components/auth/GoogleButton";

export default function Signup() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Signup failed");
      }

      setSuccess("Account created. Taking you to log in…");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account."
      subtitle="Upload a resume and HireMind writes the interview questions for you."
      prompt={{ text: "Already have an account?", label: "Log in", to: "/login" }}
    >
      <GoogleButton mode="signup" />
      <form onSubmit={handleSignup} className="space-y-5">
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
        />
        <PasswordField
          label="Password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a password"
        />

        {error && <Notice tone="error">{error}</Notice>}
        {success && <Notice tone="success">{success}</Notice>}

        <div className="pt-2">
          <SubmitButton loading={loading} loadingText="Creating account…" disabled={!!success}>
            Create account
          </SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}
