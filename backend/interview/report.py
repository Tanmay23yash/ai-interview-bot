"""
Final interview report. The numbers (scores, topic and skill breakdowns,
difficulty curve, weak topics) are computed here; Gemini only writes the
debrief text. If that call fails, a rule-based debrief is used instead, so a
finished interview always gets a report.
"""
import logging
from datetime import datetime
from statistics import mean

from gemini import AIServiceError
from interview import agents
from interview.policy import LEVELS

logger = logging.getLogger("hiremind.report")

READINESS = ((80, "Interview-ready"), (65, "Nearly there"), (45, "Needs practice"), (0, "Not ready yet"))
WEAK_TOPIC_SCORE = 5.0


def readiness(score: float) -> str:
    return next(label for threshold, label in READINESS if score >= threshold)


def _group(turns: list[dict], key: str) -> list[list[dict]]:
    """Groups turns case-insensitively by `key`, in order of first appearance."""
    groups: dict[str, list[dict]] = {}
    for t in turns:
        groups.setdefault(t[key].lower(), []).append(t)
    return list(groups.values())


def compute_analytics(turns: list[dict]) -> dict:
    """`turns` are the answered turns (see InterviewOrchestrator._turn_dict), oldest first."""
    overall = round(mean(t["score"] for t in turns) * 10, 1)

    topic_performance = [
        {
            "topic": group[0]["topic"],
            "skill": group[0]["skill"],
            "category": group[0]["category"],
            "questions": len(group),
            "avg_score": round(mean(t["score"] for t in group), 1),
            "peak_difficulty": max(t["difficulty"] for t in group),
        }
        for group in _group(turns, "topic")
    ]
    skill_scores = sorted(
        (
            {"skill": group[0]["skill"], "questions": len(group), "score": round(mean(t["score"] for t in group) * 10, 1)}
            for group in _group(turns, "skill")
        ),
        key=lambda s: s["score"],
        reverse=True,
    )

    weak: dict[str, dict] = {}
    for name in [w for t in turns for w in t["evaluation"]["weak_topics"]] + [
        p["topic"] for p in topic_performance if p["avg_score"] < WEAK_TOPIC_SCORE
    ]:
        weak.setdefault(name.lower(), {"topic": name, "mentions": 0})["mentions"] += 1

    return {
        "overall_score": overall,
        "readiness": readiness(overall),
        "questions_answered": len(turns),
        "questions_skipped": sum(t["skipped"] for t in turns),
        "dimension_scores": {
            name: round(mean(t["evaluation"]["scores"][name] for t in turns), 1) for name in agents.DIMENSION_WEIGHTS
        },
        "skill_scores": skill_scores,
        "topic_performance": topic_performance,
        "difficulty_progression": [
            {"turn": t["turn_index"], "difficulty": t["difficulty"], "score": t["score"], "topic": t["topic"]} for t in turns
        ],
        "weak_topics": sorted(weak.values(), key=lambda w: w["mentions"], reverse=True)[:8],
        "peak_difficulty": max(t["difficulty"] for t in turns),
    }


def fallback_narrative(analytics: dict) -> dict:
    ranked = sorted(analytics["topic_performance"], key=lambda p: p["avg_score"], reverse=True)
    best = [p for p in ranked if p["avg_score"] >= 6][:3]
    worst = [p for p in reversed(ranked) if p["avg_score"] < 6][:3]
    return {
        "summary": (
            f"You scored {analytics['overall_score']:.0f}/100 across {analytics['questions_answered']} questions "
            f"and reached {LEVELS[analytics['peak_difficulty']]} difficulty. "
            "Focus your next practice session on the weak topics below."
        ),
        "strengths": [f"{p['topic']} ({p['avg_score']}/10)" for p in best],
        "weaknesses": [f"{p['topic']} ({p['avg_score']}/10)" for p in worst],
        "recommendations": [
            {
                "area": w["topic"],
                "why": f"Flagged {w['mentions']} time{'s' if w['mentions'] > 1 else ''} while grading your answers.",
                "actions": [f"Review the fundamentals of {w['topic']}", "Practise explaining it out loud in two or three minutes"],
            }
            for w in analytics["weak_topics"][:4]
        ],
    }


def build_report(session, turns: list[dict], gap: dict | None) -> dict:
    analytics = compute_analytics(turns)
    try:
        narrative, source = agents.write_report(analytics, session.plan, turns), "ai"
    except AIServiceError:
        logger.warning("report.narrative_fallback")
        narrative, source = fallback_narrative(analytics), "fallback"

    return {
        "session_id": session.id,
        "title": session.title,
        "role": session.plan.get("role"),
        "generated_at": datetime.utcnow().isoformat(),
        **analytics,
        "final_difficulty": session.difficulty,
        **narrative,
        "narrative_source": source,
        "job_alignment": (
            {
                "role_title": gap["role_title"],
                "match_score": gap["match_score"],
                "missing": gap["missing"],
                "partial": gap["partial"],
            }
            if gap
            else None
        ),
    }
