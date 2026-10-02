/* Types for the adaptive interview API (backend/routers/interviews.py and jobs.py). */

export type Resume = { id: number; filename: string; created_at: string };

export type JobDescription = {
  id: number;
  title: string;
  company: string | null;
  filename: string | null;
  preview: string;
  created_at: string;
  content?: string;
};

export type Level = "strong" | "partial" | "missing";

export type Requirement = {
  skill: string;
  category: string;
  importance: "must_have" | "nice_to_have";
  candidate_level: Level;
  evidence: string;
};

export type GapAnalysis = {
  id: number;
  resume_id: number;
  job_description_id: number;
  created_at: string;
  role_title: string;
  seniority: string;
  match_score: number;
  summary: string;
  matched: string[];
  partial: string[];
  missing: string[];
  must_have_coverage: { met: number; total: number };
  requirements: Requirement[];
  extra_strengths: string[];
  focus_topics: string[];
};

export type Dimension = "technical_accuracy" | "relevance" | "depth" | "clarity" | "completeness";

export const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "technical_accuracy", label: "Technical accuracy" },
  { key: "relevance", label: "Relevance" },
  { key: "depth", label: "Depth" },
  { key: "clarity", label: "Clarity" },
  { key: "completeness", label: "Completeness" },
];

export const LEVEL_LABELS = ["", "Warm-up", "Foundational", "Intermediate", "Advanced", "Expert"];

export type Evaluation = {
  scores: Record<Dimension, number>;
  overall: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  missed_points: string[];
  weak_topics: string[];
};

export type TraceStep = { agent: string; duration_ms: number; tokens: number; [detail: string]: unknown };

export type Turn = {
  id: number;
  turn_index: number;
  topic: string;
  skill: string;
  category: string;
  difficulty: number;
  difficulty_label: string;
  is_follow_up: boolean;
  question: string;
  question_type: string;
  selection_reason: string | null;
  asked_at: string;
  answered: boolean;
  // Present once answered:
  answer?: string | null;
  skipped?: boolean;
  score?: number;
  evaluation?: Evaluation;
  expected_points?: string[];
  answered_at?: string;
  trace?: TraceStep[];
};

export type PlanTopic = { topic: string; skill: string; category: string; priority: number; source: string };

export type Usage = {
  calls: number;
  failed_calls: number;
  prompt_tokens: number;
  output_tokens: number;
  total_tokens: number;
  latency_ms: number;
  by_operation: Record<string, { calls: number; total_tokens: number; latency_ms: number }>;
};

export type SessionSummary = {
  session_id: string;
  title: string;
  status: "active" | "completed";
  resume_id: number | null;
  job_description_id: number | null;
  role: string | null;
  max_questions: number;
  questions_asked: number;
  questions_answered: number;
  difficulty: number;
  difficulty_label: string;
  overall_score: number | null;
  created_at: string;
  completed_at: string | null;
};

export type InterviewSession = SessionSummary & {
  plan: { candidate_summary: string | null; topics: PlanTopic[] };
  usage: Usage;
  turns: Turn[];
  current_question: Turn | null;
};

export type DifficultyDecision = {
  previous: number;
  level: number;
  label: string;
  change: "up" | "down" | "hold";
  reason: string;
};

export type AnswerResult = {
  turn: Turn;
  difficulty: DifficultyDecision;
  interview_complete: boolean;
  session: SessionSummary;
};

export type Report = {
  session_id: string;
  title: string;
  role: string | null;
  generated_at: string;
  overall_score: number;
  readiness: string;
  questions_answered: number;
  questions_skipped: number;
  dimension_scores: Record<Dimension, number>;
  skill_scores: { skill: string; questions: number; score: number }[];
  topic_performance: {
    topic: string;
    skill: string;
    category: string;
    questions: number;
    avg_score: number;
    peak_difficulty: number;
  }[];
  difficulty_progression: { turn: number; difficulty: number; score: number; topic: string }[];
  weak_topics: { topic: string; mentions: number }[];
  peak_difficulty: number;
  final_difficulty: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: { area: string; why: string; actions: string[] }[];
  narrative_source: "ai" | "fallback";
  job_alignment: { role_title: string; match_score: number; missing: string[]; partial: string[] } | null;
  usage: Usage;
};

/** The API sends naive UTC timestamps; mark them as UTC before parsing. */
export function parseDate(iso: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

export function fmtDate(iso: string): string {
  return parseDate(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export const pad = (n: number) => String(n).padStart(2, "0");

/** The difficulty decision recorded in an answered turn's agent trace. */
export function decisionFromTrace(turn: Turn): DifficultyDecision | null {
  const step = turn.trace?.find((s) => s.agent === "difficulty_controller");
  return step ? (step as unknown as DifficultyDecision) : null;
}
