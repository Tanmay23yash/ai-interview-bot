import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";
import { Notice, PasswordField, SubmitButton, TextField } from "../components/auth/AuthFields";
import GoogleButton from "../components/auth/GoogleButton";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Login failed");
      login(data.access_token);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back."
      subtitle="Log in to see your resumes and the questions written for them."
      prompt={{ text: "New here?", label: "Create an account", to: "/signup" }}
    >
      <GoogleButton mode="signin" />
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
        <PasswordField
          label="Password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          labelAside={
            <Link
              to="/forgot-password"
              className="-my-3 py-3 text-xs text-lp-ink/55 underline-offset-4 transition hover:text-lp-ink hover:underline"
            >
              Forgot password?
            </Link>
          }
        />

        {error && <Notice tone="error">{error}</Notice>}

        <div className="pt-2">
          <SubmitButton loading={loading} loadingText="Logging in…">
            Log in
          </SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}
