"""
Deterministic interview policies: question difficulty and next-topic choice.

These are plain rules rather than LLM calls so the interview's pacing is
predictable, explainable (every decision carries a reason) and testable.
"""
from collections import defaultdict
from dataclasses import dataclass, replace

LEVELS = {1: "Warm-up", 2: "Foundational", 3: "Intermediate", 4: "Advanced", 5: "Expert"}
LEVEL_GUIDE = {
    1: "Basic recall: definitions and what a tool or concept is for.",
    2: "Fundamentals applied: how it works and when to use it, with a simple example.",
    3: "Practical: a realistic scenario, debugging task, or comparison of approaches with trade-offs.",
    4: "Advanced: internals, edge cases, failure modes and design trade-offs at scale.",
    5: "Expert: an open-ended design or diagnosis problem with competing constraints; the candidate must justify decisions.",
}
MIN_LEVEL, MAX_LEVEL = 1, 5

RAISE_AT = 8.0  # one answer this good -> harder
LOWER_BELOW = 4.0  # one answer this weak -> easier
STEADY_HIGH = 7.0  # two answers at this level at least this good -> harder
STEADY_LOW = 5.5  # two answers at this level both below this -> easier

FOLLOW_UP_BAND = (4.0, 7.0)  # partial answers earn one follow-up on the same topic
MAX_INJECTED_TOPICS = 3


@dataclass(frozen=True)
class TurnSummary:
    topic: str
    difficulty: int
    score: float | None  # None while unanswered
    skipped: bool = False
    is_follow_up: bool = False


@dataclass(frozen=True)
class DifficultyDecision:
    previous: int
    level: int
    reason: str

    @property
    def change(self) -> str:
        return "up" if self.level > self.previous else "down" if self.level < self.previous else "hold"

    def as_dict(self) -> dict:
        return {
            "previous": self.previous,
            "level": self.level,
            "label": LEVELS[self.level],
            "change": self.change,
            "reason": self.reason,
        }


def next_difficulty(current: int, history: list[TurnSummary]) -> DifficultyDecision:
    """
    Decides the level for the next question from the answers so far.
    Streak rules only look at answers given at the current level, so a run
    of good answers raises the level once per two answers, not every turn.
    """
    answered = [t for t in history if t.score is not None]
    last = answered[-1].score
    at_level = []
    for turn in reversed(answered):
        if turn.difficulty != current:
            break
        at_level.insert(0, turn.score)
    pair = at_level[-2:]

    if last >= RAISE_AT:
        step, why = 1, f"Strong answer ({last:.1f}/10)"
    elif last < LOWER_BELOW:
        step, why = -1, f"Struggled with that one ({last:.1f}/10)"
    elif len(pair) == 2 and min(pair) >= STEADY_HIGH:
        step, why = 1, f"Two solid answers at {LEVELS[current]}"
    elif len(pair) == 2 and max(pair) < STEADY_LOW:
        step, why = -1, f"Two shaky answers at {LEVELS[current]}"
    else:
        step, why = 0, f"Steady answer ({last:.1f}/10)"

    level = max(MIN_LEVEL, min(MAX_LEVEL, current + step))
    if step and level == current:
        reason = f"{why}; already at {LEVELS[level]}."
    elif level > current:
        reason = f"{why}, so raising to {LEVELS[level]}."
    elif level < current:
        reason = f"{why}, so easing to {LEVELS[level]}."
    else:
        reason = f"{why}, so staying at {LEVELS[level]}."
    return DifficultyDecision(current, level, reason)


@dataclass(frozen=True)
class TopicChoice:
    topic: dict  # a plan topic: {topic, skill, category, priority, source, rationale}
    follow_up: bool
    reason: str


def max_follow_ups(max_questions: int) -> int:
    return max(1, max_questions // 4)


def choose_next_topic(plan_topics: list[dict], history: list[TurnSummary], max_questions: int) -> TopicChoice:
    """
    1. A partial answer gets one follow-up on the same topic (budget permitting).
    2. Otherwise the highest-priority topic not yet asked, in plan order.
    3. Once every topic has been asked, revisit the weakest one.
    """
    last = history[-1] if history else None
    follow_ups_used = sum(t.is_follow_up for t in history)
    if (
        last
        and last.score is not None
        and not last.skipped
        and not last.is_follow_up
        and FOLLOW_UP_BAND[0] <= last.score < FOLLOW_UP_BAND[1]
        and follow_ups_used < max_follow_ups(max_questions)
    ):
        topic = _find(plan_topics, last.topic) or {
            "topic": last.topic, "skill": last.topic, "category": "technical", "priority": 1, "source": "follow_up", "rationale": "",
        }
        return TopicChoice(topic, True, f"Partial answer on {last.topic} ({last.score:.1f}/10), so probing it once more.")

    asked = defaultdict(list)
    for turn in history:
        asked[turn.topic.lower()].append(turn.score)

    fresh = [t for t in plan_topics if t["topic"].lower() not in asked]
    if fresh:
        best = min(fresh, key=lambda t: (t["priority"], plan_topics.index(t)))
        return TopicChoice(best, False, f"Next planned topic (priority {best['priority']}, from {best['source']}).")

    def average(topic: dict) -> float:
        scores = [s for s in asked[topic["topic"].lower()] if s is not None]
        return sum(scores) / len(scores) if scores else 0.0

    weakest = min(plan_topics, key=lambda t: (average(t), len(asked[t["topic"].lower()])))
    return TopicChoice(
        weakest, False, f"Every planned topic is covered; revisiting the weakest, {weakest['topic']} ({average(weakest):.1f}/10)."
    )


@dataclass(frozen=True)
class NextOption:
    """One possible next question, and the scores for the current answer that lead to it."""

    label: str  # "A", "B", ...
    choice: TopicChoice
    level: int
    ranges: tuple[tuple[float, float], ...]  # inclusive overall-score ranges, one decimal

    def matches(self, choice: TopicChoice, level: int) -> bool:
        return (
            self.level == level
            and self.choice.follow_up == choice.follow_up
            and self.choice.topic["topic"].lower() == choice.topic["topic"].lower()
        )


def next_question_options(
    plan_topics: list[dict], history: list[TurnSummary], current_level: int, max_questions: int
) -> list[NextOption]:
    """
    Runs the policies above for every score (0.0-10.0) the answer being
    graded (the last turn in `history`) could get, and groups the outcomes
    into score ranges. One LLM call can then grade the answer and write the
    next question for its own range, while these rules still decide.
    """
    groups: dict[tuple, dict] = {}
    for tenth in range(101):
        score = tenth / 10
        hypothetical = [*history[:-1], replace(history[-1], score=score)]
        choice = choose_next_topic(plan_topics, hypothetical, max_questions)
        level = next_difficulty(current_level, hypothetical).level
        group = groups.setdefault(
            (choice.topic["topic"].lower(), choice.follow_up, level), {"choice": choice, "level": level, "ranges": []}
        )
        ranges = group["ranges"]
        if ranges and round(ranges[-1][1] + 0.1, 1) == score:
            ranges[-1][1] = score
        else:
            ranges.append([score, score])
    return [
        NextOption(chr(ord("A") + i), g["choice"], g["level"], tuple((low, high) for low, high in g["ranges"]))
        for i, g in enumerate(groups.values())
    ]


def add_weak_topic(plan_topics: list[dict], weak_topics: list[str], source: dict) -> tuple[list[dict], dict | None]:
    """
    Adds the first weak topic the evaluator flagged that the plan doesn't
    already cover, so later questions can come back to it. At most one per
    answer and MAX_INJECTED_TOPICS per interview. Returns (new plan, added).
    """
    if sum(t["source"] == "weakness" for t in plan_topics) >= MAX_INJECTED_TOPICS:
        return plan_topics, None
    known = {t["topic"].lower() for t in plan_topics}
    for name in weak_topics:
        name = name.strip()
        if name and name.lower() not in known:
            added = {
                "topic": name,
                "skill": source["skill"],
                "category": source["category"],
                "priority": 2,
                "source": "weakness",
                "rationale": f"Flagged as a weak spot while answering about {source['topic']}.",
            }
            return [*plan_topics, added], added
    return plan_topics, None


def _find(plan_topics: list[dict], name: str) -> dict | None:
    return next((t for t in plan_topics if t["topic"].lower() == name.lower()), None)
