import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Upload, MessageSquare, LogOut, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  
  // State: true = centered (intro), false = top-left (content)
  const [isIntro, setIsIntro] = useState(true);

  useEffect(() => {
    // Wait 2 seconds for the typewriter effect, then switch layout
    const timer = setTimeout(() => {
      setIsIntro(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* 1. Import a Modern Font (Outfit) */}
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');`}
      </style>

      <div 
        className={`min-h-screen relative bg-zinc-950 text-white transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] flex flex-col ${isIntro ? "justify-center items-center" : "justify-start items-start pt-16 px-8 md:px-16"}`}
        style={{ fontFamily: "'Outfit', sans-serif" }} // Apply the font
      >

        {/* Subtle Background Gradients */}
        <div className="fixed -top-40 -left-40 h-96 w-96 bg-indigo-500/10 blur-[100px] pointer-events-none" />
        <div className="fixed top-1/2 -right-40 h-96 w-96 bg-purple-500/10 blur-[100px] pointer-events-none" />
        {/* Grain Texture Overlay for realism */}
        <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-soft-light"></div>

        {/* ---------------- HEADER / TYPEWRITER ---------------- */}
        <motion.div 
          layout 
          transition={{ type: "spring", stiffness: 50, damping: 20 }}
          className="flex items-center gap-3 z-10"
        >
          <motion.div 
            layout
            initial={{ opacity: 0, scale: 0 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.5 }}
          >
            <Sparkles className="h-6 w-6 text-indigo-400" />
          </motion.div>

          {/* Typewriter Text */}
          <div className="relative overflow-hidden whitespace-nowrap border-r-2 border-indigo-400 pr-1">
            <motion.h1
              layout
              initial={{ width: 0 }}
              animate={{ width: "auto" }}
              transition={{ 
                duration: 1.5, 
                ease: "linear",
              }}
              className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400"
            >
              Dashboard
            </motion.h1>
          </div>
        </motion.div>

        {/* ---------------- CONTENT AREA ---------------- */}
        {!isIntro && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-3xl mt-8 z-10 pl-1"
          >
            <p className="text-zinc-400 text-base md:text-lg mb-8 max-w-lg leading-relaxed">
              Welcome back. Upload your resume to generate tailored interview questions or review your previous sessions.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Upload Button */}
              <motion.button
                whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.03)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/upload")}
                className="group flex items-center p-4 gap-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all duration-300 cursor-pointer text-left"
              >
                <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-900/20 group-hover:shadow-indigo-500/30 transition-shadow">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors">Upload Resume</h3>
                  <p className="text-xs text-zinc-500 font-medium">Generate new questions</p>
                </div>
              </motion.button>

              {/* View Questions Button */}
              <motion.button
                whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.03)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/questions")}
                className="group flex items-center p-4 gap-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all duration-300 cursor-pointer text-left"
              >
                <div className="p-3 rounded-xl bg-zinc-800 shadow-lg group-hover:shadow-zinc-700/30 transition-shadow">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors">View Questions</h3>
                  <p className="text-xs text-zinc-500 font-medium">Review generated list</p>
                </div>
              </motion.button>
            </div>

            {/* Logout - Small and minimal */}
            <motion.div 
              className="mt-8 border-t border-white/5 pt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <button
                 onClick={() => {
                   logout();
                   navigate("/");
                 }}
                 className="flex items-center gap-2 text-zinc-500 hover:text-red-400 text-sm font-medium transition-colors hover:bg-white/5 px-3 py-2 rounded-lg -ml-3"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </>
  );
}