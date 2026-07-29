import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Github, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";

/* ---------------- ICONS ---------------- */
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path d="M23.52 12.29C23.52 11.46 23.45 10.66 23.32 9.9H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.94 21.1C22.2 19.01 23.52 15.92 23.52 12.29Z" fill="#4285F4" />
    <path d="M12 24C15.24 24 17.96 22.92 19.94 21.1L16.08 18.1C15 18.82 13.62 19.24 12 19.24C8.87 19.24 6.22 17.12 5.27 14.29L1.29 17.38C3.26 21.3 7.31 24 12 24Z" fill="#34A853" />
    <path d="M5.27 14.29C5.02 13.57 4.89 12.8 4.89 12C4.89 11.2 5.02 10.43 5.27 9.71L1.29 6.62C0.47 8.24 0 10.06 0 12C0 13.94 0.47 15.76 1.29 17.38L5.27 14.29Z" fill="#FBBC05" />
    <path d="M12 4.75C13.77 4.75 15.35 5.36 16.6 6.55L20.02 3.13C17.95 1.19 15.24 0 12 0C7.31 0 3.26 2.7 1.29 6.62L5.27 9.71C6.22 6.88 8.87 4.75 12 4.75Z" fill="#EA4335" />
  </svg>
);

/* ---------------- UTILITY COMPONENTS ---------------- */
// A subtle noise overlay for that "film grain" texture seen on premium sites
const NoiseOverlay = () => (
  <div className="absolute inset-0 w-full h-full pointer-events-none z-50 opacity-[0.03]"
    style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }}></div>
);

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [introFinished, setIntroFinished] = useState(false);

  // Reference for the video element
  const videoRef = useRef<HTMLVideoElement>(null);

  /* --- MOUSE SPOTLIGHT LOGIC --- */
  // We use spring physics for the mouse movement to give it a "lag" feel like high-end websites
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth out the mouse movement
  const smoothX = useSpring(mouseX, { stiffness: 150, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 150, damping: 20 });

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  // Effect to handle Intro and forceful Video Play
  useEffect(() => {
    // 1. Trigger the panel split animation
    const timer = setTimeout(() => setIntroFinished(true), 2500); // Increased slightly for dramatic effect

    // 2. Force video play
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.85; // Slow down slightly for a more cinematic feel
      videoRef.current.play().catch(e => console.error("Auto-play failed:", e));
    }

    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));

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

  const leftPanelContentVariants = {
    centered: { x: 0, scale: 1, opacity: 1 },
    split: {
      x: "-25vw",
      scale: 0.95, // Slight shrink for depth
      opacity: 0.8,
      transition: { type: "spring" as const, stiffness: 30, damping: 15, mass: 1 }
    }
  };

  const rightPanelVariants = {
    closed: { x: "100%" },
    open: {
      x: "0%",
      transition: { type: "spring" as const, stiffness: 35, damping: 15, mass: 1 }
    }
  };

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-black text-white font-['Outfit'] selection:bg-violet-500/30">

      {/* ---------------- LEFT PANEL CONTENT ---------------- */}
      <div className="fixed inset-0 z-0 flex items-center justify-center cursor-default bg-black">

       {/* VIDEO BACKGROUND - HIGH CLARITY VERSION */}
        <div className="absolute inset-0 z-0 overflow-hidden bg-black">
             <video
                ref={videoRef}
                src="public\bg.mp4" 
                autoPlay
                muted
                loop
                playsInline
                // FIX 1: Removed 'opacity-80'. 
                // FIX 2: Added 'contrast-125' and 'brightness-110' to artificially sharpen the look.
                className="w-full h-full object-cover opacity-100 contrast-125 brightness-110 saturate-125" 
                style={{ pointerEvents: 'none' }}
            />
            
             {/* FIX 3: Simplified Gradient. Only darkens the very bottom/top for text readability, keeping the center crisp. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40"></div>
            
            {/* FIX 4: Removed the <NoiseOverlay /> component completely */}
        </div>

        <motion.div
          initial="centered"
          animate={introFinished ? "split" : "centered"}
          variants={leftPanelContentVariants}
          className="relative z-10 text-center px-12 max-w-2xl min-w-[350px] will-change-transform flex flex-col items-center"
        >
          {/* Logo / Icon Container */}
          <motion.div
            initial={{ opacity: 0, y: 30, rotate: -10 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 1.2, type: "spring" }}
            className="mb-8 relative"
          >
            <div className="absolute inset-0 bg-violet-500 blur-2xl opacity-20 animate-pulse"></div>
            <div className="relative p-4 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(124,58,237,0.5)]">
              <Sparkles className="w-10 h-10 text-violet-300" strokeWidth={1.5} />
            </div>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, letterSpacing: "-0.05em" }}
            animate={{ opacity: 1, letterSpacing: "-0.02em" }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="text-7xl md:text-8xl font-bold tracking-tighter text-white mb-6 drop-shadow-2xl"
          >
            HireMind
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, delay: 0.8 }}
            className="text-2xl text-zinc-400 font-light leading-relaxed max-w-lg mx-auto"
          >
            The future of interview preparation. <br />
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent font-medium">Powered by Gemini AI.</span>
          </motion.p>
        </motion.div>
      </div>


      {/* ---------------- RIGHT PANEL SLIDER ---------------- */}
      <motion.div
        initial="closed"
        animate={introFinished ? "open" : "closed"}
        variants={rightPanelVariants}
        onMouseMove={handleMouseMove}
        // FIX: Changed w-[100vw] md:w-[50vw] to just w-[50vw] to ensure split is always visible
        className="fixed top-0 right-0 h-full w-[50vw] bg-zinc-950/80 backdrop-blur-3xl border-l border-white/10 z-20 flex flex-col justify-center items-center will-change-transform shadow-2xl"
      >
        {/* --- DYNAMIC BACKGROUND GLOW --- */}
        <motion.div
          className="pointer-events-none absolute -inset-px opacity-0 transition duration-500 group-hover:opacity-100"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                800px circle at ${smoothX}px ${smoothY}px,
                rgba(124, 58, 237, 0.08),
                transparent 80%
              )
            `,
          }}
        />

        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

        <div className="w-full max-w-[420px] px-8 relative z-10">
          <AnimatePresence>
            {introFinished && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.08, delayChildren: 0.3 }
                  }
                }}
                className="space-y-8"
              >
                {/* Header */}
                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="text-left space-y-2">
                  <h2 className="text-4xl font-semibold tracking-tighter text-white">Welcome back</h2>
                  <p className="text-zinc-500 text-base">Enter your credentials to access your workspace.</p>
                </motion.div>

                <motion.form variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} onSubmit={handleSubmit} className="space-y-6">

                  {/* EMAIL INPUT */}
                  <div className="space-y-2 group">
                    <label className="text-xs uppercase tracking-widest text-zinc-500 font-semibold group-focus-within:text-violet-400 transition-colors ml-1">Email</label>
                    <div className="relative transition-all duration-300 group-focus-within:shadow-[0_0_30px_-10px_rgba(124,58,237,0.3)] rounded-xl">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="peer w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-zinc-700 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all duration-300"
                      />
                    </div>
                  </div>

                  {/* PASSWORD INPUT */}
                  <div className="space-y-2 group">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-xs uppercase tracking-widest text-zinc-500 font-semibold group-focus-within:text-violet-400 transition-colors">Password</label>
                      <a href="#" className="text-xs text-zinc-500 hover:text-white transition-colors">Forgot password?</a>
                    </div>
                    <div className="relative transition-all duration-300 group-focus-within:shadow-[0_0_30px_-10px_rgba(124,58,237,0.3)] rounded-xl">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="peer w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-4 pr-12 text-white placeholder-zinc-700 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all duration-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* ERROR MESSAGE */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, scale: 0.95 }}
                      animate={{ opacity: 1, height: "auto", scale: 1 }}
                      className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-500/20 p-3 rounded-lg"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      {error}
                    </motion.div>
                  )}

                  {/* SUBMIT BUTTON */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={loading}
                    className="relative w-full py-4 rounded-xl bg-white text-black font-semibold text-lg hover:bg-zinc-100 transition-all flex items-center justify-center gap-2 overflow-hidden shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                  >
                    {/* Button Shine Effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-20" />

                    <span className="relative z-10 flex items-center gap-2">
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-800 rounded-full animate-spin" />
                          <span>Signing in...</span>
                        </>
                      ) : (
                        <>
                          Sign In <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </span>
                  </motion.button>
                </motion.form>

                {/* DIVIDER */}
                <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-widest">
                    <span className="bg-[#09090b] px-3 text-zinc-500">Or continue with</span>
                  </div>
                </motion.div>

                {/* SOCIAL BUTTONS */}
                <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} className="grid grid-cols-2 gap-4">
                  <button className="flex items-center justify-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl py-3.5 transition-all group">
                    <GoogleIcon />
                    <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Google</span>
                  </button>
                  <button className="flex items-center justify-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl py-3.5 transition-all group">
                    <Github className="w-5 h-5 text-white" />
                    <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">GitHub</span>
                  </button>
                </motion.div>

                {/* SIGN UP LINK */}
                <motion.p variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="text-center text-sm text-zinc-500">
                  Don’t have an account?{" "}
                  <Link to="/signup" className="text-white hover:text-violet-400 font-medium underline underline-offset-4 decoration-zinc-700 hover:decoration-violet-400 transition-all">Sign up for free</Link>
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}