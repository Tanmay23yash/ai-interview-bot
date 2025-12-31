import { useState, useEffect } from "react";
import { Eye, EyeOff, Lock, Github } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

/* ---------------- ICONS ---------------- */
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path d="M23.52 12.29C23.52 11.46 23.45 10.66 23.32 9.9H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.94 21.1C22.2 19.01 23.52 15.92 23.52 12.29Z" fill="#4285F4" />
    <path d="M12 24C15.24 24 17.96 22.92 19.94 21.1L16.08 18.1C15 18.82 13.62 19.24 12 19.24C8.87 19.24 6.22 17.12 5.27 14.29L1.29 17.38C3.26 21.3 7.31 24 12 24Z" fill="#34A853" />
    <path d="M5.27 14.29C5.02 13.57 4.89 12.8 4.89 12C4.89 11.2 5.02 10.43 5.27 9.71L1.29 6.62C0.47 8.24 0 10.06 0 12C0 13.94 0.47 15.76 1.29 17.38L5.27 14.29Z" fill="#FBBC05" />
    <path d="M12 4.75C13.77 4.75 15.35 5.36 16.6 6.55L20.02 3.13C17.95 1.19 15.24 0 12 0C7.31 0 3.26 2.7 1.29 6.62L5.27 9.71C6.22 6.88 8.87 4.75 12 4.75Z" fill="#EA4335" />
  </svg>
);

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // State to trigger the split screen
  const [isExpanded, setIsExpanded] = useState(false);
  // State to trigger the form appearance
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    // 1. Initial Phase: Text slowly fades in (Wait 3.5s)
    // We increased this from 2000 to 3500 to allow the 3s fade-in to complete comfortably
    const splitTimer = setTimeout(() => {
      setIsExpanded(true);
    }, 3500);

    // 2. Form Phase: Form starts appearing after the split animation stabilizes (Wait 4.8s)
    const formTimer = setTimeout(() => {
      setShowForm(true);
    }, 4800);

    return () => {
      clearTimeout(splitTimer);
      clearTimeout(formTimer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");

      login(data.access_token);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      
      {/* ---------------- LEFT PANEL (ANIMATED WIDTH) ---------------- */}
      <motion.div
        initial={{ width: "100%" }} 
        animate={{ width: isExpanded ? "50%" : "100%" }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} 
        className="relative flex flex-col justify-center items-center bg-gradient-to-br from-[#7A4076] via-[#923C6D] to-[#AD3155] z-20 shadow-[4px_0_24px_rgba(0,0,0,0.1)]"
      >
        <div className="absolute inset-0 bg-black/5 pointer-events-none" />
        
        <div className="relative z-10 text-center px-12 max-w-lg min-w-[300px]">
          {/* UPDATED ANIMATION:
              duration: 3.0 (Very slow, cinematic fade in)
          */}
          <motion.h1 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 3.0, ease: "easeOut" }} 
            className="text-5xl font-bold text-white mb-6 whitespace-nowrap"
          >
            Welcome to HireMind
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 3.0, delay: 0.5, ease: "easeOut" }}
            className="text-lg text-white/90 leading-relaxed"
          >
            Sign in to continue to your account.
          </motion.p>
        </div>
      </motion.div>

      {/* ---------------- RIGHT PANEL (ANIMATED WIDTH) ---------------- */}
      <motion.div
        initial={{ width: "0%" }}
        animate={{ width: isExpanded ? "50%" : "0%" }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative bg-white flex flex-col justify-center items-center overflow-hidden"
      >
        <div className="w-full max-w-md px-8 min-w-[320px]">
          
          {showForm && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 1.0, 
                    staggerChildren: 0.15
                  }
                }
              }}
              className="space-y-8"
            >
              
              {/* Header */}
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="text-center">
                <div className="inline-flex w-12 h-12 bg-pink-600 rounded-lg mb-4 items-center justify-center shadow-lg shadow-pink-600/30">
                  <Lock className="text-white w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
                <p className="text-gray-500 text-sm mt-2">Enter your credentials to continue</p>
              </motion.div>

              {/* Social Buttons */}
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="space-y-3">
                <button className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2.5 text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  <GoogleIcon /> Continue with Google
                </button>
                <button className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2.5 text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  <Github className="w-5 h-5" /> Continue with GitHub
                </button>
              </motion.div>

              {/* Divider */}
              <motion.div variants={{ hidden: { opacity: 0, scaleX: 0 }, visible: { opacity: 1, scaleX: 1 } }} className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">Or continue with email</span>
                </div>
              </motion.div>

              {/* Form */}
              <motion.form variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                   <label className="text-sm font-medium text-gray-700">Password</label>
                   <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded text-center">{error}</p>}

                <button
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </motion.form>

              <motion.p variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="text-center text-sm text-gray-600">
                Don’t have an account?{" "}
                <Link to="/signup" className="text-pink-600 font-medium hover:text-pink-700">Sign up</Link>
              </motion.p>
              
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}