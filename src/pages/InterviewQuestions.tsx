import ReactMarkdown from "react-markdown";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Menu,
  X,
  Sparkles,
  FileText,
  Clock,
  ChevronRight,
  Bot,
  Terminal
} from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

/* ---------------- TYPES ---------------- */

type Resume = {
  id: number;
  filename: string;
  created_at: string;
  questions: string;
};

/* ---------------- ANIMATIONS ---------------- */

const sidebarContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.2 },
  },
};

const sidebarItemVariants: Variants = {
  hidden: { x: -20, opacity: 0 },
  show: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

const mainContentVariants: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: "easeOut" }
  },
  exit: {
    opacity: 0,
    y: -20,
    filter: "blur(10px)",
    transition: { duration: 0.3, ease: "easeIn" }
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

  /* ---------------- FETCH ALL RESUMES ---------------- */
  useEffect(() => {
    fetch("http://127.0.0.1:8000/resumes", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setResumes)
      .catch(console.error);
  }, []);

  /* ---------------- FETCH ACTIVE RESUME ---------------- */
  useEffect(() => {
    if (!resumeId) return;
    fetch(`http://127.0.0.1:8000/resumes/${resumeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setActive)
      .catch(console.error);
  }, [resumeId]);

  return (
    <>
      {/* Inject Font */}
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');`}
      </style>

      <div
        className="min-h-screen bg-[#050505] text-white overflow-hidden relative selection:bg-violet-500/30 font-['Outfit']"
      >
        {/* --- Background Ambience --- */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-900/10 blur-[120px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
        </div>

        {/* --- SIDEBAR DRAWER --- */}
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
              />

              {/* Sidebar Panel */}
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{
                  type: "tween",
                  ease: "easeOut",
                  duration: 0.28,
                }}
                className="fixed inset-y-0 left-0 z-50 w-80 bg-slate-900/95 border-r border-white/10 p-6 flex flex-col shadow-xl will-change-transform"
              >

                {/* Sidebar Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                    History
                  </h2>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Resume List */}
                <motion.div
                  variants={sidebarContainerVariants}
                  initial="hidden"
                  animate="show"
                  className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar"
                >
                  {resumes.map((r) => (
                    <motion.button
                      key={r.id}
                      variants={sidebarItemVariants}
                      onClick={() => {
                        navigate(`/questions/${r.id}`);
                        setOpen(false);
                      }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-300 group relative overflow-hidden ${active?.id === r.id
                          ? "bg-violet-500/10 border-violet-500/50"
                          : "bg-white/[0.03] border-white/5 hover:border-white/10 hover:bg-white/[0.05]"
                        }`}
                    >
                      {active?.id === r.id && (
                        <div className="absolute inset-y-0 left-0 w-1 bg-violet-500 rounded-full" />
                      )}
                      <p className={`font-medium truncate text-sm ${active?.id === r.id ? "text-violet-200" : "text-zinc-300 group-hover:text-white"}`}>
                        {r.filename}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold group-hover:text-zinc-400">
                        <Clock size={10} />
                        {new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="relative z-10 w-full min-h-screen flex flex-col px-6 md:px-12 py-8">

          {/* Top Navigation */}
          <div className="flex items-center gap-4 mb-10">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/dashboard")}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all text-zinc-400 hover:text-white"
            >
              <ArrowLeft size={20} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setOpen(true)}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all text-zinc-400 hover:text-white"
            >
              <Menu size={20} />
            </motion.button>
            <div className="h-8 w-px bg-white/10 mx-2"></div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Terminal className="text-violet-500" size={20} />
              Interview Prep
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
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-violet-600/30 blur-3xl rounded-full" />
                  <div className="relative h-24 w-24 rounded-3xl bg-gradient-to-br from-gray-900 to-black border border-white/10 flex items-center justify-center shadow-2xl">
                    <Bot size={48} className="text-violet-400" />
                  </div>
                </div>

                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                  Ready to ace <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
                    your interview?
                  </span>
                </h2>

                <p className="text-lg text-zinc-400 mb-10 leading-relaxed max-w-lg">
                  Select a previously analyzed resume from the sidebar to review your AI-generated questions and feedback.
                </p>

                <motion.button
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setOpen(true)}
                  className="group flex items-center gap-3 px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-zinc-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                >
                  Select Resume
                  <ChevronRight className="transition-transform group-hover:translate-x-1" size={20} />
                </motion.button>
              </motion.div>
            ) : (
              // --- CONTENT STATE ---
              <motion.div
                key="content"
                variants={mainContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex-1 flex flex-col items-start w-full max-w-5xl"
              >
                {/* Glass Card Container */}
                <div className="w-full rounded-[2rem] bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl relative">
                  {/* Gradient Top Border */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-cyan-500 to-violet-500 opacity-50"></div>

                  {/* Card Header */}
                  <div className="p-8 md:p-10 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-4 mb-2">
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

                  {/* Markdown Content */}
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
                                <span className="p-2 rounded-lg bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20 transition-colors">
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
                          ul: ({ children }) => (
                            <ul className="space-y-4 my-6">{children}</ul>
                          ),
                          li: ({ children }) => (
                            <li className="flex gap-4 text-zinc-300 items-start group">
                              <span className="mt-2.5 h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.6)] group-hover:scale-150 transition-transform" />
                              <span className="leading-relaxed group-hover:text-white transition-colors">{children}</span>
                            </li>
                          ),
                          p: ({ children }) => (
                            <p className="text-zinc-400 leading-relaxed mb-6">
                              {children}
                            </p>
                          ),
                          strong: ({ children }) => (
                            <strong className="text-white font-semibold bg-white/5 px-1 rounded">{children}</strong>
                          ),
                          code: ({ children }) => (
                            <code className="bg-[#151515] border border-white/10 rounded px-1.5 py-0.5 text-sm text-cyan-300 font-mono">
                              {children}
                            </code>
                          )
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
          .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.1);
              border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(139, 92, 246, 0.5);
          }
        `}</style>
      </div>
    </>
  );
}