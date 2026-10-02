import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Copy } from "lucide-react";

import AppShell from "../components/interview/AppShell";
import { MeterList, ProgressionChart } from "../components/interview/charts";
import { BulletList, Chip, ErrorNote, Eyebrow, MONO, SectionTitle } from "../components/interview/ui";
import { ArrowLink, SectionTag } from "../components/dashboard/ui";
import { ApiError, isAbort, useApi } from "../lib/api";
import type { InterviewSession, Report } from "../lib/interview";
import { DIMENSIONS, LEVEL_LABELS, fmtDate, pad } from "../lib/interview";

/* Final analytics for a finished interview: scores, adaptation, topics, study plan. */

export default function InterviewReport() {
  const { sessionId = "" } = useParams();
  const api = useApi();
  const [report, setReport] = useState<Report | null>(null);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      api<Report>(`/interviews/${sessionId}/report`, { signal: ctrl.signal }),
      api<InterviewSession>(`/interviews/${sessionId}`, { signal: ctrl.signal }),
    ])
      .then(([r, s]) => {
        setReport(r);
        setSession(s);
      })
      .catch((err) => {
        if (!isAbort(err)) setError(err);
      });
    return () => ctrl.abort();
  }, [api, sessionId]);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked; the ID is still visible to select */
    }
  }

  if (error) {
    const unfinished = error instanceof ApiError && error.status === 404;
    return (
      <AppShell>
        <ErrorNote error={error} />
        <Link
          to={unfinished ? `/interview/session/${sessionId}` : "/interview"}
          className={`mt-6 inline-block text-xs hover:text-hm-accent ${MONO}`}
        >
          {unfinished ? "Continue the interview" : "Back to interviews"}
        </Link>
      </AppShell>
    );
  }

  if (!report) {
    return (
      <AppShell>
        <div className="space-y-6" aria-busy="true">
          <div className="h-16 w-2/3 animate-pulse rounded-md bg-hm-panel" />
          <div className="h-64 animate-pulse rounded-md bg-hm-panel" />
        </div>
      </AppShell>
    );
  }

  const answered = session?.turns.filter((t) => t.answered) ?? [];
  const usage = report.usage;
  const tiles = [
    { value: pad(report.questions_answered), label: "Questions answered" },
    { value: pad(report.questions_skipped), label: "Skipped" },
    { value: LEVEL_LABELS[report.peak_difficulty], label: "Peak difficulty" },
    { value: LEVEL_LABELS[report.final_difficulty], label: "Finished at" },
  ];

  return (
    <AppShell>
      {/* ---------------- headline ---------------- */}
      <header>
        <SectionTag index="R.00" label="Interview report" />
        <h1 className="mt-6 max-w-4xl break-words text-4xl font-medium leading-[1.02] tracking-[-0.04em] sm:text-6xl">
          {report.title}
        </h1>
        <p className={`mt-4 text-[11px] text-hm-muted ${MONO}`}>
          {report.role ? `${report.role} · ` : ""}
          {fmtDate(report.generated_at)}
        </p>
      </header>

      <section aria-label="Overall result" className="mt-12 grid gap-10 border-t border-hm-line pt-10 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-16">
        <div>
          <Eyebrow>Overall score</Eyebrow>
          <div className="mt-1 text-[96px] font-medium leading-none tracking-[-0.06em] sm:text-[128px]">
            {Math.round(report.overall_score)}
            <span className="text-3xl tracking-[-0.03em] text-hm-muted">/100</span>
          </div>
          <div className="mt-3">
            <Chip accent>{report.readiness}</Chip>
          </div>
        </div>
        <div className="min-w-0">
          <p className="max-w-3xl text-xl leading-relaxed tracking-[-0.01em]">{report.summary}</p>
          {report.narrative_source === "fallback" && (
            <p className="mt-3 text-sm text-hm-muted">
              The AI debrief wasn't available, so this summary was built from your scores alone.
            </p>
          )}
          <dl className="mt-8 grid grid-cols-2 gap-x-4 sm:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="flex flex-col-reverse border-t border-hm-line py-4">
                <dt className={`mt-1 text-[11px] text-hm-muted ${MONO}`}>{t.label}</dt>
                <dd className="text-2xl font-medium tracking-[-0.03em]">{t.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------- scores ---------------- */}
      <section aria-labelledby="scores" className="mt-20">
        <SectionTitle index="01">
          <span id="scores">Scores</span>
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-hm-line bg-hm-card p-5 sm:p-6">
            <Eyebrow className="mb-1">By dimension</Eyebrow>
            <p className="mb-6 text-sm text-hm-muted">Average across your answers, out of 10.</p>
            <MeterList
              label="Average score by dimension"
              max={10}
              items={DIMENSIONS.map((d) => ({ label: d.label, value: report.dimension_scores[d.key] }))}
            />
          </div>
          <div className="rounded-md border border-hm-line bg-hm-card p-5 sm:p-6">
            <Eyebrow className="mb-1">By skill</Eyebrow>
            <p className="mb-6 text-sm text-hm-muted">Out of 100, from the questions that tested each skill.</p>
            <MeterList
              label="Score by skill"
              max={100}
              items={report.skill_scores.map((s) => ({
                label: s.skill,
                value: s.score,
                detail: `${s.questions} question${s.questions === 1 ? "" : "s"}`,
              }))}
            />
          </div>
        </div>
      </section>

      {/* ---------------- adaptation ---------------- */}
      <section aria-labelledby="adaptation" className="mt-20">
        <SectionTitle index="02">
          <span id="adaptation">How the interview adapted</span>
        </SectionTitle>
        <div className="rounded-md border border-hm-line bg-hm-card p-5 pt-10 sm:p-6 sm:pt-12">
          <ProgressionChart points={report.difficulty_progression} />
        </div>
        <p className="mt-3 text-sm text-hm-muted">
          Strong answers raised the next question's difficulty; weak ones lowered it. Every value is also in the
          question-by-question table below.
        </p>
      </section>

      {/* ---------------- topics ---------------- */}
      <section aria-labelledby="topics" className="mt-20">
        <SectionTitle index="03">
          <span id="topics">Topics</span>
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm sm:min-w-[620px]">
            <caption className="sr-only">Performance by topic</caption>
            <thead>
              <tr className={`border-b border-hm-line text-[11px] text-hm-muted ${MONO}`}>
                <th scope="col" className="py-3 pr-4 font-normal">Topic</th>
                <th scope="col" className="hidden py-3 pr-4 font-normal sm:table-cell">Skill</th>
                <th scope="col" className="hidden py-3 pr-4 text-right font-normal sm:table-cell">Questions</th>
                <th scope="col" className="w-[30%] py-3 pr-4 font-normal">Average score</th>
                <th scope="col" className="py-3 font-normal">Peak difficulty</th>
              </tr>
            </thead>
            <tbody>
              {report.topic_performance.map((t) => (
                <tr key={t.topic} className="border-b border-hm-line align-middle">
                  <th scope="row" className="py-3 pr-4 font-medium">{t.topic}</th>
                  <td className="hidden py-3 pr-4 text-hm-muted sm:table-cell">{t.skill}</td>
                  <td className="hidden py-3 pr-4 text-right tabular-nums sm:table-cell">{t.questions}</td>
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-3">
                      <span className="w-9 shrink-0 font-medium tabular-nums">{t.avg_score.toFixed(1)}</span>
                      <span aria-hidden="true" className="relative block h-2 flex-1 rounded-r-[4px] bg-hm-chart/15">
                        <span
                          className="absolute inset-y-0 left-0 rounded-r-[4px] bg-hm-chart"
                          style={{ width: `${t.avg_score * 10}%` }}
                        />
                      </span>
                    </span>
                  </td>
                  <td className="py-3">{LEVEL_LABELS[t.peak_difficulty]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------- strengths / weaknesses ---------------- */}
      <section aria-labelledby="sw" className="mt-20">
        <SectionTitle index="04">
          <span id="sw">Strengths and weaknesses</span>
        </SectionTitle>
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <Eyebrow className="mb-3">Strengths</Eyebrow>
            <BulletList items={report.strengths} empty="Nothing stood out yet. Longer interviews give a clearer picture." />
          </div>
          <div>
            <Eyebrow className="mb-3">Weaknesses</Eyebrow>
            <BulletList items={report.weaknesses} empty="No clear weaknesses." />
          </div>
        </div>
        {report.weak_topics.length > 0 && (
          <div className="mt-8">
            <Eyebrow className="mb-2">Weak topics flagged while grading</Eyebrow>
            <div className="flex flex-wrap gap-1.5">
              {report.weak_topics.map((w) => (
                <Chip key={w.topic}>
                  {w.topic}
                  {w.mentions > 1 && <span className="text-hm-ink">×{w.mentions}</span>}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ---------------- study plan ---------------- */}
      {report.recommendations.length > 0 && (
        <section aria-labelledby="plan" className="mt-20">
          <SectionTitle index="05">
            <span id="plan">What to study next</span>
          </SectionTitle>
          <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {report.recommendations.map((r, i) => (
              <li key={r.area} className="flex flex-col rounded-md bg-hm-panel p-6">
                <span className={`text-[11px] text-hm-muted ${MONO}`}>Priority {pad(i + 1)}</span>
                <h3 className="mt-2 text-xl font-medium leading-tight tracking-[-0.02em]">{r.area}</h3>
                <p className="mt-2 text-sm text-hm-muted">{r.why}</p>
                <div className="mt-4">
                  <BulletList items={r.actions} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ---------------- job alignment ---------------- */}
      {report.job_alignment && (
        <section aria-labelledby="job" className="mt-20">
          <SectionTitle index="06">
            <span id="job">Fit for {report.job_alignment.role_title}</span>
          </SectionTitle>
          <div className="grid gap-8 md:grid-cols-[auto_1fr]">
            <div>
              <Eyebrow>Resume match</Eyebrow>
              <div className="mt-1 text-6xl font-medium leading-none tracking-[-0.05em]">
                {Math.round(report.job_alignment.match_score)}
                <span className="text-2xl text-hm-muted">%</span>
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <Eyebrow className="mb-2">Missing from your resume</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {report.job_alignment.missing.length
                    ? report.job_alignment.missing.map((s) => <Chip key={s}>{s}</Chip>)
                    : <span className="text-sm text-hm-muted">None</span>}
                </div>
              </div>
              <div>
                <Eyebrow className="mb-2">Only partly shown</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {report.job_alignment.partial.length
                    ? report.job_alignment.partial.map((s) => <Chip key={s}>{s}</Chip>)
                    : <span className="text-sm text-hm-muted">None</span>}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- question by question ---------------- */}
      {answered.length > 0 && (
        <section aria-labelledby="questions" className="mt-20">
          <SectionTitle index="07">
            <span id="questions">Question by question</span>
          </SectionTitle>
          <div className={`hidden grid-cols-[48px_minmax(0,1fr)_120px_64px] gap-4 border-b border-hm-line pb-3 text-[11px] text-hm-muted sm:grid ${MONO}`}>
            <span>#</span>
            <span>Topic</span>
            <span>Difficulty</span>
            <span className="text-right">Score</span>
          </div>
          <ul className="divide-y divide-hm-line border-b border-hm-line">
            {answered.map((t) => (
              <li key={t.id}>
                <details className="group">
                  <summary className="grid cursor-pointer list-none grid-cols-[48px_minmax(0,1fr)_64px] items-baseline gap-4 py-4 sm:grid-cols-[48px_minmax(0,1fr)_120px_64px] [&::-webkit-details-marker]:hidden">
                    <span className={`text-[11px] text-hm-muted ${MONO}`}>Q{pad(t.turn_index)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium group-open:whitespace-normal">{t.topic}</span>
                      {t.is_follow_up && <Chip accent>Follow-up</Chip>}
                    </span>
                    <span className="hidden text-sm sm:block">{LEVEL_LABELS[t.difficulty]}</span>
                    <span className="text-right font-medium tabular-nums">{t.skipped ? "Skipped" : t.score?.toFixed(1)}</span>
                  </summary>
                  <div className="grid gap-6 pb-6 sm:pl-16 lg:grid-cols-2">
                    <div>
                      <Eyebrow className="mb-2">Question</Eyebrow>
                      <p className="leading-relaxed">{t.question}</p>
                      {t.answer && (
                        <>
                          <Eyebrow className="mb-2 mt-5">Your answer</Eyebrow>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-hm-muted">{t.answer}</p>
                        </>
                      )}
                    </div>
                    {t.evaluation && (
                      <div>
                        <Eyebrow className="mb-2">Feedback</Eyebrow>
                        <p className="text-sm leading-relaxed">{t.evaluation.feedback}</p>
                        <Eyebrow className="mb-2 mt-5">Missed</Eyebrow>
                        <BulletList items={t.evaluation.missed_points} empty="Nothing major" />
                      </div>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------- footer ---------------- */}
      <footer className="mt-24 flex flex-col gap-8 border-t border-hm-line pt-8 lg:flex-row lg:items-end lg:justify-between">
        <div className={`space-y-2 text-[11px] text-hm-muted ${MONO}`}>
          <div className="flex flex-wrap items-center gap-2">
            Session <span className="break-all normal-case text-hm-ink">{sessionId}</span>
            <button
              type="button"
              onClick={copyId}
              aria-label="Copy session ID"
              className="-my-1.5 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-hm-panel hover:text-hm-ink"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
          {usage && (
            <div>
              {usage.calls} AI calls · {usage.total_tokens.toLocaleString()} tokens · {(usage.latency_ms / 1000).toFixed(1)} s model
              time
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <ArrowLink to={session?.resume_id ? `/interview?resume=${session.resume_id}` : "/interview"}>Practice again</ArrowLink>
        </div>
      </footer>
    </AppShell>
  );
}
