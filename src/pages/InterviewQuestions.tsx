import ReactMarkdown from "react-markdown";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Menu,
  X,
  Sparkles,
  Clock,
  ChevronRight,
  Bot,
  Terminal,
  Trash2,
  MoreVertical
} from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import type { PanInfo } from "framer-motion";

/* ---------------- TYPES ---------------- */

type Resume = {
  id: number;
  filename: string;
  created_at: string;
  questions: string;
};

/* ---------------- OPTIMIZED ANIMATIONS ---------------- */

// 1. Simple Opacity Fade (No Blur calculation during fade)
const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.2 } 
  },
};

// 2. GPU-Optimized Sidebar
const sidebarVariants: Variants = {
  hidden: { 
    x: "-100%",
  },
  visible: { 
    x: "0%",
    transition: { 
      type: "spring", 
      stiffness: 300, // Lower stiffness = softer, less jittery movement
      damping: 30,
      mass: 0.8
    },
  },
  exit: { 
    x: "-100%",
    transition: { 
      type: "spring", 
      stiffness: 300, 
      damping: 30 
    }
  },
};

const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.1 },
  },
};

const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0, 
    transition: { duration: 0.2 } // Simple tween is faster than spring for lists
  },
};

const mainContentVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2, ease: "easeIn" }
  },
};

/* ---------------- COMPONENT ---------------- */

export default function InterviewQuestions() {
  const navigate = useNavigate();
  const { resumeId } = useParams();
  const token = localStorage.getItem("token");

  const [open, setOpen] = useState(false);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [active, setActive] = useState<Resume | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  /* ---------------- FETCHES ---------------- */
  useEffect(() => {
    fetch("http://127.0.0.1:8000/resumes", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setResumes)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!resumeId) return;
    fetch(`http://127.0.0.1:8000/resumes/${resumeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setActive)
      .catch(console.error);
  }, [resumeId]);

  /* ---------------- HANDLERS ---------------- */

  async function handleDelete(resumeId: number) {
    if (!confirm("Delete this resume?")) return;
    try {
      await fetch(`http://127.0.0.1:8000/resumes/${resumeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setResumes((prev) => prev.filter((r) => r.id !== resumeId));
      if (active?.id === resumeId) {
        setActive(null);
        navigate("/questions");
      }
      setMenuOpenId(null);
    } catch (err) {
      console.error(err);
    }
  }

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.x < -100) {
      setOpen(false);
    }
  };

  return (
    <>
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');`}
      </style>

      <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative selection:bg-violet-500/30 font-['Outfit']">
        
        {/* --- STATIC Background (Optimized) --- 
            We removed the 'fixed' overlay container to reduce layer compositing. 
            Just putting blobs absolutely positioned. 
        */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-900/20 blur-[100px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-900/20 blur-[100px] rounded-full mix-blend-screen" />
          {/* Static noise texture - no animation */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
        </div>

        {/* --- SIDEBAR DRAWER --- */}
        <AnimatePresence>
          {open && (
            <>
              {/* PERFORMANCE FIX 1: Removed 'backdrop-blur-sm'
                 Blurring the whole screen while fading opacity is the #1 cause of lag.
                 We use a simple dark overlay instead.
              */}
              <motion.div
                variants={backdropVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                onClick={() => setOpen(false)}
                className="fixed inset-0 bg-black/70 z-40"
              />

              {/* Sidebar Panel */}
              <motion.aside
                variants={sidebarVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                drag="x" 
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.1, right: 0 }}
                onDragEnd={handleDragEnd}
                // PERFORMANCE FIX 2: 'will-change-transform' tells the browser to prep the GPU
                className="fixed inset-y-0 left-0 z-50 w-80 md:w-96 bg-[#0a0a0a] border-r border-white/10 flex flex-col shadow-2xl will-change-transform"
              >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0a0a0a]">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                    History
                  </h2>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </motion.button>
                </div>

                {/* Resume List */}
                <motion.div
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-[#0a0a0a]"
                >
                  {resumes.map((r) => {
                    const isActive = active?.id === r.id;
                    return (
                      <motion.div
                        key={r.id}
                        variants={listItemVariants}
                        className="relative group"
                        onMouseLeave={() => setMenuOpenId(null)}
                      >
                        <button
                          onClick={() => {
                            navigate(`/questions/${r.id}`);
                            setOpen(false);
                          }}
                          className={`relative w-full text-left p-4 rounded-xl transition-colors duration-200 z-10 flex flex-col gap-1
                            ${isActive ? "text-white" : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"}
                          `}
                        >
                          {/* We keep LayoutId because it's efficient enough on small elements */}
                          {isActive && (
                            <motion.div
                              layoutId="active-pill"
                              className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-blue-600/20 border border-violet-500/30 rounded-xl"
                              initial={false}
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          )}

                          <span className="relative z-10 font-medium truncate pr-6">{r.filename}</span>
                          
                          <div className="relative z-10 flex items-center gap-2 text-[10px] opacity-60 uppercase tracking-wider font-semibold">
                            <Clock size={10} />
                            {new Date(r.created_at).toLocaleDateString()}
                          </div>
                        </button>

                        {/* Menu Trigger */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === r.id ? null : r.id);
                          }}
                          className="absolute right-2 top-3 z-20 p-2 rounded-lg text-zinc-500 opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Dropdown */}
                        {menuOpenId === r.id && (
                          <div
                            className="absolute right-0 top-10 z-50 w-36 bg-zinc-900 border border-white/10 shadow-xl rounded-lg overflow-hidden py-1"
                          >
                            <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(r.id)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* --- MAIN CONTENT --- */}
        <div className="relative z-10 w-full min-h-screen flex flex-col px-6 md:px-12 py-8">
          
          {/* Top Navigation */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-3 rounded-xl border border-white/5 transition-all hover:bg-white/5 text-zinc-400 hover:text-white hover:scale-105 active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={() => setOpen(true)}
              className="p-3 rounded-xl border border-white/5 transition-all hover:bg-white/5 text-zinc-400 hover:text-white hover:scale-105 active:scale-95 relative"
            >
              <Menu size={20} />
              {!active && <span className="absolute top-2 right-2 w-2 h-2 bg-violet-500 rounded-full animate-pulse" />}
            </button>
            
            <div className="h-8 w-px bg-white/10 mx-2" />
            
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Terminal className="text-violet-500" size={20} />
              Interview<span className="text-zinc-500 font-normal">Prep</span>
            </h1>
          </div>

          {/* Content Switcher */}
          <AnimatePresence mode="wait">
            {!active ? (
              // --- EMPTY STATE ---
              <motion.div
                key="empty"
                variants={mainContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex-1 flex flex-col justify-center items-start max-w-2xl"
              >
                <div className="relative mb-8 group cursor-default">
                  <div className="absolute inset-0 bg-violet-600/20 blur-3xl rounded-full" />
                  <div className="relative h-24 w-24 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-2xl">
                    <Bot size={48} className="text-violet-400" />
                  </div>
                </div>

                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-[1.1]">
                  Ready to ace <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
                    your interview?
                  </span>
                </h2>

                <p className="text-lg text-zinc-400 mb-10 leading-relaxed max-w-lg">
                  Select a previously analyzed resume from the history to review your AI-generated questions and feedback.
                </p>

                <button
                  onClick={() => setOpen(true)}
                  className="group flex items-center gap-3 px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Select Resume
                  <ChevronRight className="transition-transform group-hover:translate-x-1" size={20} />
                </button>
              </motion.div>
            ) : (
              // --- CONTENT STATE ---
              <motion.div
                key={active.id}
                variants={mainContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex-1 flex flex-col w-full max-w-5xl"
              >
                <div className="w-full rounded-[2rem] bg-[#0a0a0a]/90 border border-white/10 overflow-hidden shadow-2xl relative">
                  
                  {/* Decorative Gradient Line */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-cyan-500 to-violet-500 opacity-50" />

                  <div className="p-8 md:p-10 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-4 mb-3">
                      <span className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold tracking-wider uppercase">
                        AI Generated
                      </span>
                      <span className="text-zinc-500 text-xs flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(active.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white truncate leading-tight">
                      {active.filename}
                    </h2>
                  </div>

                  <div className="p-8 md:p-12 overflow-y-auto max-h-[70vh] custom-scrollbar">
                    <div className="prose prose-invert prose-lg max-w-none">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => (
                            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 mb-8 pb-4 border-b border-white/10">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <div className="mt-12 mb-6 group">
                              <h2 className="text-2xl font-bold text-violet-200 flex items-center gap-3">
                                <span className="p-2 rounded-lg bg-violet-500/10 text-violet-400 transition-colors">
                                  <Sparkles size={20} />
                                </span>
                                {children}
                              </h2>
                            </div>
                          ),
                          h3: ({ children }) => (
                            <h3 className="mt-8 mb-3 text-xl font-semibold text-white pl-4 border-l-2 border-cyan-500/50">
                              {children}
                            </h3>
                          ),
                          ul: ({ children }) => <ul className="space-y-4 my-6">{children}</ul>,
                          li: ({ children }) => (
                            <li className="flex gap-4 text-zinc-300 items-start">
                              <span className="mt-2.5 h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                              <span className="leading-relaxed hover:text-white transition-colors">{children}</span>
                            </li>
                          ),
                          p: ({ children }) => <p className="text-zinc-400 leading-relaxed mb-6">{children}</p>,
                          strong: ({ children }) => <strong className="text-white font-semibold bg-white/5 px-1 rounded">{children}</strong>,
                          code: ({ children }) => <code className="bg-[#151515] border border-white/10 rounded px-1.5 py-0.5 text-sm text-cyan-300 font-mono">{children}</code>
                        }}
                      >
                        {active.questions}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scrollbar Styles */}
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(139, 92, 246, 0.5); }
        `}</style>
      </div>
    </>
  );
}