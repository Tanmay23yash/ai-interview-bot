import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, UserPlus } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Signup failed");
      }

      setSuccess("Account created successfully!");
      setTimeout(() => navigate("/"), 1200); // go to login
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <form
        onSubmit={handleSignup}
        className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/10 p-8 shadow-xl space-y-5"
      >
        <div className="text-center space-y-1">
          <div className="mx-auto w-14 h-14 rounded-xl bg-indigo-600/20 flex items-center justify-center">
            <UserPlus className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-zinc-400 text-sm">
            Sign up to start your AI interview prep
          </p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/40 border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/40 border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        {success && (
          <p className="text-green-400 text-sm text-center">{success}</p>
        )}

        <button
          disabled={loading}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>

        <p className="text-sm text-center text-zinc-400">
          Already have an account?{" "}
          <span
            onClick={() => navigate("/")}
            className="text-indigo-400 cursor-pointer hover:underline"
          >
            Sign in
          </span>
        </p>
      </form>
    </div>
  );
}
