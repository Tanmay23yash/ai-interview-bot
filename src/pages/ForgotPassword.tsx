import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, KeyRound, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/forgot-password", {
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
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/10 p-8 shadow-xl space-y-5"
      >
        <div className="text-center space-y-1">
          <div className="mx-auto w-14 h-14 rounded-xl bg-indigo-600/20 flex items-center justify-center">
            <KeyRound className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold">Forgot password?</h1>
          <p className="text-zinc-400 text-sm">
            Enter your email and we will send you a link to reset it.
          </p>
        </div>

        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="w-full bg-zinc-800 border border-white/10 rounded-lg pl-10 pr-4 py-3 outline-none focus:border-indigo-500"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {message && <p className="text-green-400 text-sm">{message}</p>}

        <button
          disabled={loading}
          className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 font-semibold transition"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>

        <Link
          to="/"
          className="flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft size={16} /> Back to sign in
        </Link>
      </form>
    </div>
  );
}
