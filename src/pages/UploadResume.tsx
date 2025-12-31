import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, FileText, CheckCircle, AlertCircle, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function UploadResume() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // --- Handlers ---

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
      setMessage("");
    } else {
      setMessage("Please upload a PDF file.");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage("");
    }
  };

  async function handleUpload() {
    if (!file) {
      setMessage("Please select a PDF file");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("You are not logged in");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("http://127.0.0.1:8000/resume/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");

      navigate(`/questions/${data.resume_id}`);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Inject Font */}
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');`}
      </style>

      <div className="min-h-screen bg-[#050505] text-white font-['Outfit'] relative overflow-hidden flex flex-col">
        
        {/* --- Background Ambience --- */}
        <div className="fixed inset-0 pointer-events-none">
           <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-900/20 blur-[120px] rounded-full mix-blend-screen animate-pulse" />
           <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-cyan-900/10 blur-[120px] rounded-full mix-blend-screen" />
           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
        </div>

        {/* --- Navigation --- */}
        <div className="relative z-10 p-6 md:p-12">
            <motion.button 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all text-zinc-400 hover:text-white w-fit"
            >
              <ArrowLeft size={18} />
              <span className="font-medium">Dashboard</span>
            </motion.button>
        </div>

        {/* --- Main Content --- */}
        <div className="flex-1 flex items-center justify-center p-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-lg bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl p-8 md:p-12 relative overflow-hidden"
          >
             {/* Gradient Border Top */}
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-cyan-500 to-violet-500 opacity-50"></div>

            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-zinc-400 mb-3">
                Upload Resume
              </h1>
              <p className="text-zinc-400 text-lg">
                Upload your PDF to generate personalized interview questions.
              </p>
            </div>

            {/* --- Drag & Drop Area --- */}
            <div className="space-y-6">
                {!file ? (
                    <motion.div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        whileHover={{ scale: 1.01, borderColor: "rgba(139, 92, 246, 0.5)" }}
                        whileTap={{ scale: 0.99 }}
                        animate={{ 
                            backgroundColor: isDragging ? "rgba(139, 92, 246, 0.1)" : "rgba(255, 255, 255, 0.02)",
                            borderColor: isDragging ? "rgba(139, 92, 246, 0.5)" : "rgba(255, 255, 255, 0.1)"
                        }}
                        className="border-2 border-dashed rounded-3xl h-64 flex flex-col items-center justify-center cursor-pointer transition-colors group relative overflow-hidden"
                    >
                        <input
                            type="file"
                            accept="application/pdf"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        
                        <div className="p-4 rounded-full bg-gradient-to-br from-violet-500/10 to-cyan-500/10 mb-4 group-hover:scale-110 transition-transform duration-300">
                             <UploadCloud size={40} className="text-violet-400" />
                        </div>
                        <p className="text-zinc-300 font-medium text-lg mb-1">Click to upload or drag & drop</p>
                        <p className="text-zinc-500 text-sm">PDF (MAX. 5MB)</p>
                    </motion.div>
                ) : (
                    // --- File Selected State ---
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-4 overflow-hidden">
                            <div className="p-3 bg-red-500/10 rounded-xl">
                                <FileText className="text-red-400" size={24} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-white font-medium truncate">{file.name}</p>
                                <p className="text-zinc-500 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setFile(null); }}
                            className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-red-400 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </motion.div>
                )}

                {/* --- Message Display --- */}
                <AnimatePresence>
                    {message && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-sm justify-center"
                        >
                            <AlertCircle size={16} />
                            {message}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- Upload Button --- */}
                <motion.button
                    onClick={handleUpload}
                    disabled={!file || loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-xl font-bold text-lg relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-cyan-600 group-hover:from-violet-500 group-hover:to-cyan-500 transition-colors"></div>
                    
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analyzing Resume...
                            </>
                        ) : (
                            <>
                                Generate Questions
                                <CheckCircle size={20} className={file ? "opacity-100" : "opacity-50"} />
                            </>
                        )}
                    </span>
                </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}