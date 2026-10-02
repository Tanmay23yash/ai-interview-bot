import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FileText, Play, Trash2, Upload } from "lucide-react";

import AppShell from "../components/interview/AppShell";
import GapAnalysisPanel from "../components/interview/GapAnalysisPanel";
import { AgentSteps, ArrowButton, BulletList, Chip, ErrorNote, Eyebrow, GhostButton, MONO, Segmented, SectionTitle } from "../components/interview/ui";
import { SectionTag } from "../components/dashboard/ui";
import { isAbort, useApi } from "../lib/api";
import type { GapAnalysis, InterviewSession, JobDescription, Resume, SessionSummary } from "../lib/interview";
import { LEVEL_LABELS, fmtDate, parseDate } from "../lib/interview";

/*
 * Set up an adaptive interview: pick a resume, optionally a target job (with a
 * resume-vs-JD gap analysis), choose length and starting difficulty.
 */

const START_STEPS = [
  { label: "Indexing your resume for retrieval", ms: 1800 },
  { label: "Planning interview topics", ms: 5500 },
  { label: "Writing your first question", ms: 4000 },
];
const START_STEPS_WITH_JOB = [
  { label: "Indexing your resume for retrieval", ms: 1800 },
  { label: "Comparing your resume with the job", ms: 7500 },
  { label: "Planning interview topics", ms: 5500 },
  { label: "Writing your first question", ms: 4000 },
];
const ANALYSIS_STEPS = [
  { label: "Reading the job's requirements", ms: 3000 },
  { label: "Finding evidence on your resume", ms: 4000 },
  { label: "Scoring the fit", ms: 3000 },
];
const LENGTHS = [5, 8, 10, 12].map((n) => ({ value: n, label: `${n} questions` }));
const DIFFICULTIES = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} · ${LEVEL_LABELS[n]}` }));
const JOB_MODES = [
  { value: "none" as const, label: "No job, resume only" },
  { value: "saved" as const, label: "Saved job" },
  { value: "new" as const, label: "Add a job" },
];
const INPUT =
  "w-full rounded-md border border-hm-line bg-hm-bg px-3 py-2.5 text-base outline-none sm:text-sm transition-colors placeholder:text-hm-muted focus:border-hm-ink";

export default function InterviewSetup() {
  const api = useApi();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const wantedResume = Number(params.get("resume")) || null;

  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [pickedResume, setPickedResume] = useState<number | null>(null);
  const [jobMode, setJobMode] = useState<"none" | "saved" | "new">("none");
  const [jobId, setJobId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ title: "", company: "", text: "" });
  const [file, setFile] = useState<File | null>(null);
  const [savingJob, setSavingJob] = useState(false);
  const [analysis, setAnalysis] = useState<{ key: string; data: GapAnalysis } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [jobError, setJobError] = useState<unknown>(null);

  const [length, setLength] = useState(8);
  const [difficulty, setDifficulty] = useState(2);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      api<Resume[]>("/resumes", { signal: ctrl.signal }),
      api<JobDescription[]>("/job-descriptions", { signal: ctrl.signal }),
      api<SessionSummary[]>("/interviews", { signal: ctrl.signal }),
    ])
      .then(([r, j, s]) => {
        setResumes([...r].sort((a, b) => parseDate(b.created_at).getTime() - parseDate(a.created_at).getTime()));
        setJobs(j);
        setSessions(s);
        setLoadError(null);
      })
      .catch((err) => {
        if (!isAbort(err)) setLoadError(err);
      });
    return () => ctrl.abort();
  }, [api, reloadKey]);

  // The resume in the URL, else the latest, until the user picks one.
  const resumeId =
    pickedResume ?? (resumes?.some((r) => r.id === wantedResume) ? wantedResume : resumes?.[0]?.id ?? null);
  const resume = resumes?.find((r) => r.id === resumeId) ?? null;
  const job = jobMode === "saved" ? jobs.find((j) => j.id === jobId) ?? null : null;
  const analysisKey = resumeId && job ? `${resumeId}:${job.id}` : null;
  const shownAnalysis = analysis && analysis.key === analysisKey ? analysis.data : null;

  // Show a previously computed analysis for this resume + job, if there is one.
  useEffect(() => {
    if (!analysisKey || !job || !resumeId) return;
    const ctrl = new AbortController();
    api<GapAnalysis>(`/gap-analyses?resume_id=${resumeId}&job_description_id=${job.id}`, { signal: ctrl.signal })
      .then((data) => setAnalysis({ key: analysisKey, data }))
      .catch(() => {
        /* 404: not analysed yet; the button offers it */
      });
    return () => ctrl.abort();
  }, [api, analysisKey, job, resumeId]);

  async function runAnalysis(targetJobId: number, refresh = false) {
    if (!resumeId) return;
    setAnalyzing(true);
    setJobError(null);
    try {
      const data = await api<GapAnalysis>("/gap-analyses", {
        method: "POST",
        json: { resume_id: resumeId, job_description_id: targetJobId, refresh },
      });
      setAnalysis({ key: `${resumeId}:${targetJobId}`, data });
    } catch (err) {
      setJobError(err);
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveJob(e: FormEvent) {
    e.preventDefault();
    const form = new FormData();
    if (draft.title.trim()) form.append("title", draft.title.trim());
    if (draft.company.trim()) form.append("company", draft.company.trim());
    if (file) form.append("file", file);
    else form.append("text", draft.text);

    setSavingJob(true);
    setJobError(null);
    try {
      const created = await api<JobDescription>("/job-descriptions", { method: "POST", form });
      setJobs((list) => [created, ...list]);
      setJobId(created.id);
      setJobMode("saved");
      setDraft({ title: "", company: "", text: "" });
      setFile(null);
      void runAnalysis(created.id);
    } catch (err) {
      setJobError(err);
    } finally {
      setSavingJob(false);
    }
  }

  async function start() {
    if (!resumeId) return;
    setStarting(true);
    setStartError(null);
    try {
      const session = await api<InterviewSession>("/interviews", {
        method: "POST",
        json: {
          resume_id: resumeId,
          job_description_id: job?.id ?? null,
          max_questions: length,
          starting_difficulty: difficulty,
        },
      });
      navigate(`/interview/session/${session.session_id}`);
    } catch (err) {
      setStartError(err);
      setStarting(false);
    }
  }

  async function deleteSession(id: string) {
    try {
      await api(`/interviews/${id}`, { method: "DELETE" });
      setSessions((list) => list?.filter((s) => s.session_id !== id) ?? null);
    } catch (err) {
      setLoadError(err);
    } finally {
      setConfirmDelete(null);
    }
  }

  const canSaveJob = file !== null || draft.text.trim().length >= 80;

  return (
    <AppShell>
      <header className="max-w-3xl">
        <SectionTag index="I.00" label="Mock interview" />
        <h1 className="mt-6 text-[11vw] font-medium leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[72px]">
          An interview that adapts to you.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-hm-muted">
          One question at a time, written from your resume. Every answer is scored, and the next question gets harder or
          easier depending on how you did.
        </p>
      </header>

      {loadError !== null && (
        <div className="mt-10">
          <ErrorNote error={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
        </div>
      )}

      <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        <div className="min-w-0 space-y-14">
          {/* ---------------- resume ---------------- */}
          <section aria-labelledby="pick-resume">
            <SectionTitle index="01">
              <span id="pick-resume">Resume</span>
            </SectionTitle>
            {resumes === null && !loadError && <div className="h-24 animate-pulse rounded-md bg-hm-panel" />}
            {resumes?.length === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-md bg-hm-panel p-5">
                <p>Upload a resume first. Questions are written from it.</p>
                <Link to="/upload" className={`inline-flex items-center gap-2 text-xs hover:text-hm-accent ${MONO}`}>
                  <Upload size={14} /> Upload resume
                </Link>
              </div>
            )}
            {resumes && resumes.length > 0 && (
              <div role="radiogroup" aria-labelledby="pick-resume" className="grid gap-3 sm:grid-cols-2">
                {resumes.map((r) => {
                  const selected = r.id === resumeId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPickedResume(r.id)}
                      className={`flex min-w-0 items-start gap-3 rounded-md border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hm-accent ${
                        selected ? "border-hm-ink bg-hm-panel" : "border-hm-line hover:border-hm-ink"
                      }`}
                    >
                      <FileText className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.3} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.filename}</span>
                        <span className={`mt-1 block text-[11px] text-hm-muted ${MONO}`}>{fmtDate(r.created_at)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ---------------- job ---------------- */}
          <section aria-labelledby="pick-job">
            <SectionTitle index="02" aside={<Eyebrow>Optional</Eyebrow>}>
              <span id="pick-job">Target job</span>
            </SectionTitle>
            <p className="mb-5 max-w-xl text-sm text-hm-muted">
              Add the job description and the interview will focus on its must-have skills, especially the ones your resume
              shows weakly.
            </p>
            <Segmented label="Target job" options={JOB_MODES} value={jobMode} onChange={setJobMode} />

            <div className="mt-6 space-y-5">
              {jobMode === "saved" && jobs.length === 0 && (
                <p className="text-sm text-hm-muted">No saved jobs yet. Choose “Add a job” to paste one.</p>
              )}

              {jobMode === "saved" && jobs.length > 0 && (
                <div role="radiogroup" aria-label="Saved jobs" className="grid gap-3 sm:grid-cols-2">
                  {jobs.map((j) => {
                    const selected = j.id === jobId;
                    return (
                      <button
                        key={j.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setJobId(j.id)}
                        className={`min-w-0 rounded-md border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hm-accent ${
                          selected ? "border-hm-ink bg-hm-panel" : "border-hm-line hover:border-hm-ink"
                        }`}
                      >
                        <span className="block truncate font-medium">{j.title}</span>
                        {j.company && <span className="block truncate text-sm text-hm-muted">{j.company}</span>}
                        <span className="mt-2 line-clamp-2 block text-xs text-hm-muted">{j.preview}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {jobMode === "new" && (
                <form onSubmit={saveJob} className="space-y-4 rounded-md border border-hm-line p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <Eyebrow className="mb-1.5">Job title</Eyebrow>
                      <input
                        className={INPUT}
                        value={draft.title}
                        maxLength={120}
                        placeholder="Taken from the posting if empty"
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <Eyebrow className="mb-1.5">Company</Eyebrow>
                      <input
                        className={INPUT}
                        value={draft.company}
                        maxLength={120}
                        onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="block">
                    <Eyebrow className="mb-1.5">Job description</Eyebrow>
                    <textarea
                      className={`${INPUT} min-h-[180px] resize-y leading-relaxed`}
                      value={draft.text}
                      disabled={file !== null}
                      placeholder="Paste the full posting: responsibilities and requirements."
                      onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <label className={`inline-flex cursor-pointer items-center gap-2 text-xs hover:text-hm-accent ${MONO}`}>
                      <Upload size={14} />
                      {file ? file.name : "Or upload a PDF"}
                      <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {file && (
                      <GhostButton onClick={() => setFile(null)}>Remove file</GhostButton>
                    )}
                    <ArrowButton type="submit" disabled={!canSaveJob || !resumeId} busy={savingJob}>
                      Save &amp; analyse fit
                    </ArrowButton>
                  </div>
                </form>
              )}

              {jobError !== null && <ErrorNote error={jobError} />}

              {job && !shownAnalysis && !analyzing && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-md bg-hm-panel p-5">
                  <p className="text-sm">See how {resume?.filename ?? "your resume"} matches {job.title}.</p>
                  <ArrowButton onClick={() => runAnalysis(job.id)} disabled={!resumeId}>
                    Analyse fit
                  </ArrowButton>
                </div>
              )}
              {analyzing && <AgentSteps title="Skill gap analysis" steps={ANALYSIS_STEPS} />}
              {shownAnalysis && !analyzing && (
                <>
                  <GapAnalysisPanel analysis={shownAnalysis} />
                  <GhostButton onClick={() => job && runAnalysis(job.id, true)}>Re-run analysis</GhostButton>
                </>
              )}
            </div>
          </section>

          {/* ---------------- settings ---------------- */}
          <section aria-labelledby="settings">
            <SectionTitle index="03">
              <span id="settings">Settings</span>
            </SectionTitle>
            <div className="space-y-6">
              <div>
                <Eyebrow className="mb-2">Length</Eyebrow>
                <Segmented label="Number of questions" options={LENGTHS} value={length} onChange={setLength} />
              </div>
              <div>
                <Eyebrow className="mb-2">Starting difficulty</Eyebrow>
                <Segmented label="Starting difficulty" options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
                <p className="mt-2 text-sm text-hm-muted">It moves up or down from here as you answer.</p>
              </div>
            </div>
          </section>
        </div>

        {/* ---------------- summary + start ---------------- */}
        <aside className="lg:sticky lg:top-[100px] lg:self-start">
          <div className="rounded-md bg-hm-block p-6 text-hm-on-block">
            <Eyebrow className="!text-hm-on-block/60">Your interview</Eyebrow>
            <dl className="mt-5 space-y-3 text-sm">
              {[
                ["Resume", resume?.filename ?? "None selected"],
                ["Target job", job ? job.title : "Resume only"],
                ...(shownAnalysis ? [["Match", `${Math.round(shownAnalysis.match_score)}%`]] : []),
                ["Length", `${length} questions`],
                ["Starts at", LEVEL_LABELS[difficulty]],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-hm-on-block/15 pb-3">
                  <dt className="text-hm-on-block/60">{k}</dt>
                  <dd className="min-w-0 truncate text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={start}
              disabled={!resumeId || starting}
              className={`mt-6 flex w-full items-center justify-between rounded-md bg-hm-accent py-1 pl-5 pr-1 text-xs text-[#151515] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hm-on-block disabled:pointer-events-none disabled:opacity-50 ${MONO}`}
            >
              {starting ? "Starting…" : "Start interview"}
              <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#151515] text-hm-accent">
                <Play size={11} fill="currentColor" strokeWidth={0} />
              </span>
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {starting && <AgentSteps title="Setting up" steps={job ? START_STEPS_WITH_JOB : START_STEPS} />}
            {startError !== null && <ErrorNote error={startError} />}
            <div className="rounded-md border border-hm-line p-5">
              <Eyebrow>How it adapts</Eyebrow>
              <div className="mt-3">
                <BulletList
                  items={[
                    "Questions are grounded in the most relevant parts of your resume.",
                    "Each answer is scored for accuracy, relevance, depth, clarity and completeness.",
                    "Strong answers raise the difficulty; weak ones lower it. Partial answers get one follow-up.",
                    "You finish with skill scores, weak topics and a study plan.",
                  ]}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ---------------- history ---------------- */}
      {sessions && sessions.length > 0 && (
        <section aria-labelledby="past" className="mt-24">
          <SectionTitle index="04">
            <span id="past">Past interviews</span>
          </SectionTitle>
          <ul className="divide-y divide-hm-line">
            {sessions.map((s) => {
              const done = s.status === "completed";
              return (
                <li key={s.session_id} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="truncate font-medium">{s.title}</p>
                    <p className={`mt-1 text-[11px] text-hm-muted ${MONO}`}>
                      {fmtDate(s.created_at)} · {s.questions_answered}/{s.max_questions} answered
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {done ? (
                      <span className="text-2xl font-medium tracking-[-0.03em]">
                        {Math.round(s.overall_score ?? 0)}
                        <span className="text-sm text-hm-muted">/100</span>
                      </span>
                    ) : (
                      <Chip accent>In progress</Chip>
                    )}
                    <Link
                      to={done ? `/interview/session/${s.session_id}/report` : `/interview/session/${s.session_id}`}
                      className={`-my-3 py-3 text-xs underline-offset-4 hover:text-hm-accent hover:underline ${MONO}`}
                    >
                      {done ? "Report" : "Continue"}
                    </Link>
                    {confirmDelete === s.session_id ? (
                      <GhostButton onClick={() => deleteSession(s.session_id)}>Confirm delete</GhostButton>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Delete ${s.title}`}
                        onClick={() => setConfirmDelete(s.session_id)}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-hm-muted transition-colors hover:bg-hm-panel hover:text-hm-ink"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </AppShell>
  );
}

