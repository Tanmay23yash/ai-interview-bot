import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, Minus } from "lucide-react";

import AppShell from "../components/interview/AppShell";
import { MeterList } from "../components/interview/charts";
import {
  AgentSteps,
  ArrowButton,
  BulletList,
  Chip,
  DifficultyMeter,
  ErrorNote,
  Eyebrow,
  GhostButton,
  MONO,
} from "../components/interview/ui";
import { isAbort, useApi } from "../lib/api";
import type { AnswerResult, DifficultyDecision, InterviewSession as Session, SessionSummary, Turn } from "../lib/interview";
import { DIMENSIONS, decisionFromTrace, pad } from "../lib/interview";

/*
 * The live interview: one question at a time. After each answer the feedback
 * shows while the next question is generated in the background.
 */

// Grading and the next question come from one call (see backend/interview/orchestrator.py).
const GRADE_STEPS = [
  { label: "Re-reading the resume context for this question", ms: 900 },
  { label: "Grading your answer against the rubric", ms: 6000 },
  { label: "Choosing the next difficulty and writing the next question", ms: 1500 },
];
const REPORT_STEPS = [
  { label: "Scoring every topic and skill", ms: 900 },
  { label: "Writing your debrief and study plan", ms: 9000 },
];
const DRAFT_KEY = (turnId: number) => `hiremind_answer_${turnId}`;

function loadDraft(turnId: number): string {
  try {
    return localStorage.getItem(DRAFT_KEY(turnId)) ?? "";
  } catch {
    return "";
  }
}

function saveDraft(turnId: number, text: string) {
  try {
    if (text) localStorage.setItem(DRAFT_KEY(turnId), text);
    else localStorage.removeItem(DRAFT_KEY(turnId));
  } catch {
    /* drafts are a convenience; the answer still submits without them */
  }
}

type NextState = { status: "idle" | "loading" | "ready" | "error"; turn?: Turn; error?: unknown };

export default function InterviewSession() {
  const { sessionId = "" } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [question, setQuestion] = useState<Turn | null>(null);
  const [feedback, setFeedback] = useState<{ turn: Turn; decision: DifficultyDecision | null } | null>(null);
  const [next, setNext] = useState<NextState>({ status: "idle" });
  const [complete, setComplete] = useState(false);
  const [answer, setAnswer] = useState("");
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<unknown>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<unknown>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      setSession(await api<Session>(`/interviews/${sessionId}`));
    } catch {
      /* the side panel just stays as it was */
    }
  }, [api, sessionId]);

  const fetchNext = useCallback(async () => {
    setNext({ status: "loading" });
    try {
      const res = await api<{ question: Turn; session: SessionSummary }>(`/interviews/${sessionId}/next`, { method: "POST" });
      setNext({ status: "ready", turn: res.question });
      void refreshSession();
    } catch (err) {
      setNext({ status: "error", error: err });
    }
  }, [api, sessionId, refreshSession]);

  useEffect(() => {
    const ctrl = new AbortController();
    api<Session>(`/interviews/${sessionId}`, { signal: ctrl.signal })
      .then((s) => {
        if (s.status === "completed") {
          navigate(`/interview/session/${sessionId}/report`, { replace: true });
          return;
        }
        setSession(s);
        if (s.current_question) {
          setQuestion(s.current_question);
          setAnswer(loadDraft(s.current_question.id));
          return;
        }
        const last = s.turns[s.turns.length - 1];
        if (last) setFeedback({ turn: last, decision: decisionFromTrace(last) });
        if (s.questions_asked >= s.max_questions) setComplete(true);
        else void fetchNext();
      })
      .catch((err) => {
        if (!isAbort(err)) setLoadError(err);
      });
    return () => ctrl.abort();
  }, [api, sessionId, navigate, fetchNext]);

  // Move focus to each new question (or feedback) so keyboard and screen-reader users land on it.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [question?.id, feedback?.turn.id]);

  async function submit(skipped = false) {
    if (!question || grading || (!skipped && !answer.trim())) return;
    setGrading(true);
    setGradeError(null);
    try {
      const res = await api<AnswerResult>(`/interviews/${sessionId}/answer`, {
        method: "POST",
        json: { answer: skipped ? "" : answer, skipped },
      });
      saveDraft(question.id, "");
      setFeedback({ turn: res.turn, decision: res.difficulty });
      setQuestion(null);
      setAnswer("");
      setComplete(res.interview_complete);
      if (!res.interview_complete) void fetchNext();
      void refreshSession();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setGradeError(err); // the draft stays in the box, so nothing is lost
    } finally {
      setGrading(false);
    }
  }

  function goNext() {
    if (next.status !== "ready" || !next.turn) return;
    setQuestion(next.turn);
    setAnswer(loadDraft(next.turn.id));
    setFeedback(null);
    setNext({ status: "idle" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finish() {
    setFinishing(true);
    setFinishError(null);
    try {
      await api(`/interviews/${sessionId}/finish`, { method: "POST" });
      navigate(`/interview/session/${sessionId}/report`);
    } catch (err) {
      setFinishError(err);
      setFinishing(false);
      setConfirmEnd(false);
    }
  }

  function onAnswerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit();
    }
  }

  if (loadError) {
    return (
      <AppShell>
        <ErrorNote error={loadError} />
        <Link to="/interview" className={`mt-6 inline-block text-xs hover:text-hm-accent ${MONO}`}>
          Back to interviews
        </Link>
      </AppShell>
    );
  }

  const turns = session?.turns ?? [];
  const answeredCount = turns.filter((t) => t.answered).length;
  const currentIndex = question?.turn_index ?? feedback?.turn.turn_index ?? 0;
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  return (
    <AppShell>
      {/* ---------------- header + progress ---------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow>Mock interview{session?.role ? ` · ${session.role}` : ""}</Eyebrow>
          <p className="mt-1 truncate text-lg font-medium tracking-[-0.02em]">{session?.title ?? " "}</p>
        </div>
        {session && !complete && answeredCount > 0 && (
          <div className="flex items-center gap-2">
            {confirmEnd ? (
              <>
                <span className="text-sm text-hm-muted">End now and get your report?</span>
                <GhostButton onClick={() => setConfirmEnd(false)}>Keep going</GhostButton>
                <ArrowButton onClick={finish} busy={finishing}>
                  End
                </ArrowButton>
              </>
            ) : (
              <GhostButton onClick={() => setConfirmEnd(true)}>End interview</GhostButton>
            )}
          </div>
        )}
      </div>

      {session && (
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div
            role="progressbar"
            aria-label="Interview progress"
            aria-valuemin={0}
            aria-valuemax={session.max_questions}
            aria-valuenow={answeredCount}
            className="flex min-w-[200px] flex-1 gap-1"
          >
            {Array.from({ length: session.max_questions }, (_, i) => {
              const n = i + 1;
              const done = n <= answeredCount;
              const current = n === currentIndex && !done;
              return (
                <span
                  key={n}
                  className={`h-1.5 flex-1 rounded-full ${done ? "bg-hm-ink" : current ? "bg-hm-accent" : "bg-hm-faint"}`}
                />
              );
            })}
          </div>
          <span className={`text-[11px] ${MONO}`}>
            {pad(answeredCount)} / {pad(session.max_questions)} answered
          </span>
          <DifficultyMeter level={session.difficulty} />
        </div>
      )}

      {finishError !== null && (
        <div className="mt-6">
          <ErrorNote error={finishError} />
        </div>
      )}

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {!session && <div className="h-72 animate-pulse rounded-md bg-hm-panel" />}

          {/* ---------------- question ---------------- */}
          {question && (
            <article aria-labelledby="question-text">
              <div className="flex flex-wrap items-center gap-2">
                <Chip>Q{pad(question.turn_index)}</Chip>
                <Chip>{question.topic}</Chip>
                {question.is_follow_up && <Chip accent>Follow-up</Chip>}
                <DifficultyMeter level={question.difficulty} className="ml-1" />
              </div>
              <h1
                id="question-text"
                ref={headingRef}
                tabIndex={-1}
                className="mt-6 text-2xl font-medium leading-snug tracking-[-0.03em] outline-none sm:text-[32px] sm:leading-tight"
              >
                {question.question}
              </h1>
              {question.selection_reason && (
                <p className="mt-3 text-sm text-hm-muted">Why this question: {question.selection_reason}</p>
              )}

              <label htmlFor="answer" className="sr-only">
                Your answer
              </label>
              <textarea
                id="answer"
                value={answer}
                disabled={grading}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  saveDraft(question.id, e.target.value);
                }}
                onKeyDown={onAnswerKey}
                maxLength={8000}
                rows={10}
                placeholder="Answer as you would out loud: context, what you did and why, trade-offs, results."
                className="mt-8 w-full resize-y rounded-md border border-hm-line bg-hm-card p-4 text-base leading-relaxed outline-none transition-colors placeholder:text-hm-muted focus:border-hm-ink disabled:opacity-60"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                <span className={`text-[11px] text-hm-muted ${MONO}`}>
                  {words} words · Ctrl + Enter to submit
                </span>
                <div className="flex items-center gap-3">
                  <GhostButton onClick={() => submit(true)} disabled={grading}>
                    Skip
                  </GhostButton>
                  <ArrowButton onClick={() => submit()} disabled={!answer.trim()} busy={grading}>
                    Submit answer
                  </ArrowButton>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {grading && <AgentSteps title="Evaluating" steps={GRADE_STEPS} />}
                {gradeError !== null && <ErrorNote error={gradeError} onRetry={() => submit()} />}
              </div>
            </article>
          )}

          {/* ---------------- feedback ---------------- */}
          {!question && feedback && (
            <FeedbackView
              turn={feedback.turn}
              decision={feedback.decision}
              headingRef={headingRef}
              footer={
                complete ? (
                  <div className="space-y-4">
                    <p className="text-lg font-medium tracking-[-0.02em]">That was the last question.</p>
                    <ArrowButton onClick={finish} busy={finishing}>
                      See your report
                    </ArrowButton>
                    {finishing && <AgentSteps title="Building your report" steps={REPORT_STEPS} />}
                  </div>
                ) : next.status === "error" ? (
                  <ErrorNote error={next.error} onRetry={fetchNext} />
                ) : (
                  <ArrowButton onClick={goNext} busy={next.status !== "ready"}>
                    {next.status === "ready" ? "Next question" : "Preparing next question"}
                  </ArrowButton>
                )
              }
            />
          )}
        </div>

        {/* ---------------- side panel ---------------- */}
        {session && (
          <aside className="space-y-8 lg:sticky lg:top-[100px] lg:self-start">
            <div>
              <Eyebrow>Topics</Eyebrow>
              <ul className="mt-3 space-y-2.5">
                {session.plan.topics.map((t) => {
                  const same = (topic: string) => topic.toLowerCase() === t.topic.toLowerCase();
                  const answered = turns.some((turn) => turn.answered && same(turn.topic));
                  const current = question !== null && same(question.topic);
                  return (
                    <li key={t.topic} className="flex items-start gap-2.5 text-sm" aria-current={current ? "step" : undefined}>
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                        {answered ? (
                          <Check size={14} className="text-hm-accent" aria-label="Answered" />
                        ) : current ? (
                          <span className="h-2 w-2 rounded-full bg-hm-accent" aria-label="Current" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-hm-faint" />
                        )}
                      </span>
                      <span className={answered || current ? "" : "text-hm-muted"}>
                        {t.topic}
                        {(t.source === "gap" || t.source === "weakness") && (
                          <span className={`ml-2 whitespace-nowrap text-[10px] text-hm-muted ${MONO}`}>
                            · {t.source === "gap" ? "job gap" : "weak spot"}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {answeredCount > 0 && (
              <div>
                <Eyebrow>Scores so far</Eyebrow>
                <ul className="mt-3 divide-y divide-hm-line">
                  {turns
                    .filter((t) => t.answered)
                    .map((t) => (
                      <li key={t.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate">
                          <span className={`mr-2 text-[10px] text-hm-muted ${MONO}`}>Q{pad(t.turn_index)}</span>
                          {t.topic}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">{t.skipped ? "—" : t.score?.toFixed(1)}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>
    </AppShell>
  );
}

function FeedbackView({
  turn,
  decision,
  footer,
  headingRef,
}: {
  turn: Turn;
  decision: DifficultyDecision | null;
  footer: ReactNode;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const evaluation = turn.evaluation;
  const DecisionIcon = decision?.change === "up" ? ArrowUp : decision?.change === "down" ? ArrowDown : Minus;

  return (
    <section aria-labelledby="feedback-title">
      <div className="flex flex-wrap items-center gap-2">
        <Chip>Q{pad(turn.turn_index)}</Chip>
        <Chip>{turn.topic}</Chip>
      </div>
      <h1 id="feedback-title" ref={headingRef} tabIndex={-1} className="sr-only">
        Feedback on question {turn.turn_index}
      </h1>

      <div className="mt-6 grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
        <div>
          <Eyebrow>Score</Eyebrow>
          <div className="text-7xl font-medium leading-none tracking-[-0.05em]">
            {turn.skipped ? "0" : turn.score?.toFixed(1)}
            <span className="text-2xl text-hm-muted">/10</span>
          </div>
        </div>
        {decision && (
          <div className="flex items-start gap-3 rounded-md bg-hm-panel p-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hm-ink text-hm-bg">
              <DecisionIcon size={14} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium">
                Next question: {decision.label}
                <span className="sr-only"> ({decision.change === "hold" ? "same level" : decision.change === "up" ? "harder" : "easier"})</span>
              </p>
              <p className="mt-0.5 text-sm text-hm-muted">{decision.reason}</p>
            </div>
          </div>
        )}
      </div>

      {evaluation && (
        <>
          <p className="mt-8 max-w-3xl text-lg leading-relaxed">{evaluation.feedback}</p>

          {!turn.skipped && (
            <div className="mt-8 rounded-md border border-hm-line bg-hm-card p-5 sm:p-6">
              <Eyebrow className="mb-5">Breakdown</Eyebrow>
              <MeterList
                label="Score by dimension"
                max={10}
                items={DIMENSIONS.map((d) => ({ label: d.label, value: evaluation.scores[d.key] }))}
              />
            </div>
          )}

          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            <div>
              <Eyebrow className="mb-3">What worked</Eyebrow>
              <BulletList items={evaluation.strengths} />
            </div>
            <div>
              <Eyebrow className="mb-3">To improve</Eyebrow>
              <BulletList items={evaluation.improvements} />
            </div>
            <div>
              <Eyebrow className="mb-3">Missed</Eyebrow>
              <BulletList items={evaluation.missed_points} empty="Nothing major" />
            </div>
          </div>

          {evaluation.weak_topics.length > 0 && (
            <div className="mt-8">
              <Eyebrow className="mb-2">Weak spots noted</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {evaluation.weak_topics.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 divide-y divide-hm-line border-y border-hm-line">
            <details className="group py-4">
              <summary className={`cursor-pointer text-xs ${MONO}`}>What a strong answer covers</summary>
              <div className="mt-4">
                <BulletList items={turn.expected_points ?? []} />
              </div>
            </details>
            {turn.answer && (
              <details className="py-4">
                <summary className={`cursor-pointer text-xs ${MONO}`}>Your answer</summary>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-hm-muted">{turn.answer}</p>
              </details>
            )}
          </div>
        </>
      )}

      <div className="mt-10">{footer}</div>
    </section>
  );
}
