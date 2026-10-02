import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { GapAnalysis, Level } from "../../lib/interview";
import { Chip, Eyebrow, MONO } from "./ui";

// Status is carried by icon + label, never by colour alone.
const LEVEL: Record<Level, { label: string; Icon: typeof CheckCircle2; iconClass: string }> = {
  strong: { label: "Strong", Icon: CheckCircle2, iconClass: "" },
  partial: { label: "Partial", Icon: CircleDashed, iconClass: "" },
  missing: { label: "Missing", Icon: XCircle, iconClass: "text-hm-accent" },
};

const ORDER: Record<Level, number> = { missing: 0, partial: 1, strong: 2 };

export default function GapAnalysisPanel({ analysis }: { analysis: GapAnalysis }) {
  const requirements = [...analysis.requirements].sort(
    (a, b) =>
      Number(b.importance === "must_have") - Number(a.importance === "must_have") ||
      ORDER[a.candidate_level] - ORDER[b.candidate_level]
  );
  const { met, total } = analysis.must_have_coverage;

  return (
    <div className="rounded-md border border-hm-line bg-hm-card">
      <div className="grid gap-6 border-b border-hm-line p-5 sm:grid-cols-[auto_1fr] sm:p-6">
        <div>
          <Eyebrow>Resume match</Eyebrow>
          <div className="mt-1 text-6xl font-medium leading-none tracking-[-0.05em]">
            {Math.round(analysis.match_score)}
            <span className="text-2xl text-hm-muted">%</span>
          </div>
        </div>
        <div className="min-w-0 sm:pt-5">
          <p className="text-lg font-medium leading-snug tracking-[-0.02em]">
            {analysis.role_title}
            {analysis.seniority && <span className="text-hm-muted"> · {analysis.seniority}</span>}
          </p>
          <p className="mt-1 text-sm text-hm-muted">
            {total > 0 ? `${met} of ${total} must-have skills clearly shown on your resume.` : "No hard requirements listed."}
          </p>
          <p className="mt-3 text-sm leading-relaxed">{analysis.summary}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Job requirements and how your resume covers them</caption>
          <thead>
            <tr className={`border-b border-hm-line text-[11px] text-hm-muted ${MONO}`}>
              <th scope="col" className="px-5 py-3 font-normal sm:px-6">Skill</th>
              <th scope="col" className="px-3 py-3 font-normal">Need</th>
              <th scope="col" className="px-3 py-3 font-normal">Your resume</th>
              <th scope="col" className="px-5 py-3 font-normal sm:px-6">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((r) => {
              const { label, Icon, iconClass } = LEVEL[r.candidate_level];
              return (
                <tr key={r.skill} className="border-b border-hm-line last:border-0 align-top">
                  <th scope="row" className="px-5 py-3 font-medium sm:px-6">{r.skill}</th>
                  <td className="px-3 py-3">
                    {r.importance === "must_have" ? <Chip accent>Must</Chip> : <Chip>Nice</Chip>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon size={15} strokeWidth={1.8} aria-hidden="true" className={iconClass} />
                      {label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-hm-muted sm:px-6">{r.evidence}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(analysis.focus_topics.length > 0 || analysis.extra_strengths.length > 0) && (
        <div className="grid gap-5 border-t border-hm-line p-5 sm:grid-cols-2 sm:p-6">
          {analysis.focus_topics.length > 0 && (
            <div>
              <Eyebrow>The interview will probe</Eyebrow>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {analysis.focus_topics.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
            </div>
          )}
          {analysis.extra_strengths.length > 0 && (
            <div>
              <Eyebrow>Bonus strengths</Eyebrow>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {analysis.extra_strengths.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
