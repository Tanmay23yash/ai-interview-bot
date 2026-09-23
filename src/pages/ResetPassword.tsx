import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, ShieldCheck } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
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
      const res = await fetch("http://127.0.0.1:8000/auth/reset-password", {
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

      setSuccess("Password updated. Redirecting to sign in...");
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
        <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/10 p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">Invalid reset link</h1>
          <p className="text-zinc-400 text-sm">This link is missing its token.</p>
          <Link to="/forgot-password" className="text-indigo-400 hover:text-indigo-300 underline">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/10 p-8 shadow-xl space-y-5"
      >
        <div className="text-center space-y-1">
          <div className="mx-auto w-14 h-14 rounded-xl bg-indigo-600/20 flex items-center justify-center">
            <ShieldCheck className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="text-zinc-400 text-sm">Choose a password with at least 8 characters.</p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg pl-10 pr-4 py-3 outline-none focus:border-indigo-500"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg pl-10 pr-4 py-3 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm">
            {error}{" "}
            {error.includes("invalid or has expired") && (
              <Link to="/forgot-password" className="underline">
                Request a new link
              </Link>
            )}
          </p>
        )}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        <button
          disabled={loading || !!success}
          className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 font-semibold transition"
        >
          {loading ? "Saving..." : "Reset password"}
        </button>
      </form>
    </div>
  );
}
