from interview.policy import (
    TurnSummary,
    add_weak_topic,
    choose_next_topic,
    max_follow_ups,
    next_difficulty,
    next_question_options,
)

PLAN = [
    {"topic": "Payments API", "skill": "API design", "category": "project_deep_dive", "priority": 1, "source": "resume", "rationale": ""},
    {"topic": "Kubernetes", "skill": "Kubernetes", "category": "technical", "priority": 2, "source": "gap", "rationale": ""},
    {"topic": "Redis", "skill": "Caching", "category": "technical", "priority": 1, "source": "resume", "rationale": ""},
]


def turns(*items):
    """(topic, difficulty, score[, skipped, follow_up]) tuples -> TurnSummary list."""
    return [TurnSummary(*item) for item in items]


# ---------------- difficulty ----------------

def test_strong_answer_raises_and_weak_answer_lowers():
    assert next_difficulty(2, turns(("a", 2, 8.5))).level == 3
    assert next_difficulty(3, turns(("a", 3, 3.0))).level == 2


def test_middling_answer_holds():
    decision = next_difficulty(3, turns(("a", 3, 6.0)))
    assert decision.level == 3 and decision.change == "hold"
    assert "staying at Intermediate" in decision.reason


def test_two_solid_answers_at_the_same_level_raise():
    assert next_difficulty(3, turns(("a", 3, 7.2), ("b", 3, 7.5))).level == 4
    # The earlier 7.5 was at a different level, so it doesn't count toward the streak.
    assert next_difficulty(3, turns(("a", 2, 7.5), ("b", 3, 7.2))).level == 3


def test_two_shaky_answers_lower():
    assert next_difficulty(3, turns(("a", 3, 5.0), ("b", 3, 4.5))).level == 2


def test_levels_are_clamped_with_an_explanation():
    top = next_difficulty(5, turns(("a", 5, 9.5)))
    assert top.level == 5 and "already at Expert" in top.reason
    assert next_difficulty(1, turns(("a", 1, 0.0))).level == 1


def test_unanswered_turns_are_ignored():
    assert next_difficulty(2, turns(("a", 2, 9.0), ("b", 2, None))).level == 3


# ---------------- topic selection ----------------

def test_first_pick_is_highest_priority_in_plan_order():
    choice = choose_next_topic(PLAN, [], 8)
    assert choice.topic["topic"] == "Payments API" and not choice.follow_up


def test_priority_beats_plan_order():
    choice = choose_next_topic(PLAN, turns(("Payments API", 2, 8.0)), 8)
    assert choice.topic["topic"] == "Redis"


def test_partial_answer_gets_one_follow_up():
    choice = choose_next_topic(PLAN, turns(("Payments API", 2, 5.5)), 8)
    assert choice.follow_up and choice.topic["topic"] == "Payments API"
    assert "Partial answer" in choice.reason

    # A follow-up never gets its own follow-up.
    after = choose_next_topic(PLAN, turns(("Payments API", 2, 5.5), ("Payments API", 2, 5.0, False, True)), 8)
    assert not after.follow_up and after.topic["topic"] == "Redis"


def test_no_follow_up_for_strong_weak_or_skipped_answers():
    for history in (turns(("Payments API", 2, 9.0)), turns(("Payments API", 2, 2.0)), turns(("Payments API", 2, 0.0, True))):
        assert not choose_next_topic(PLAN, history, 8).follow_up


def test_follow_up_budget():
    assert max_follow_ups(4) == 1 and max_follow_ups(12) == 3
    history = turns(("Payments API", 2, 5.0), ("Payments API", 2, 5.0, False, True), ("Redis", 2, 5.0))
    assert not choose_next_topic(PLAN, history, 4).follow_up


def test_revisits_weakest_topic_when_plan_is_exhausted():
    history = turns(("Payments API", 2, 9.0), ("Redis", 2, 3.0), ("Kubernetes", 2, 8.0))
    choice = choose_next_topic(PLAN, history, 8)
    assert choice.topic["topic"] == "Redis" and "revisiting the weakest" in choice.reason


# ---------------- weak topic injection ----------------

def test_weak_topic_is_added_once_and_capped():
    source = PLAN[0]
    plan, added = add_weak_topic(PLAN, ["redis", "Idempotency keys", "Retries"], source)
    assert added["topic"] == "Idempotency keys" and added["source"] == "weakness"
    assert len(plan) == len(PLAN) + 1 and PLAN[-1]["topic"] == "Redis"  # original untouched

    for name in ("A", "B", "C"):
        plan, _ = add_weak_topic(plan, [name], source)
    assert sum(t["source"] == "weakness" for t in plan) == 3


# ---------------- next-question options (one-call grading) ----------------

def _summary(options):
    return [(o.label, o.choice.topic["topic"], o.choice.follow_up, o.level, o.ranges) for o in options]


def test_options_cover_every_score_once():
    options = next_question_options(PLAN, turns(("Payments API", 2, None)), 2, 8)
    assert _summary(options) == [
        ("A", "Redis", False, 1, ((0.0, 3.9),)),
        ("B", "Payments API", True, 2, ((4.0, 6.9),)),
        ("C", "Redis", False, 2, ((7.0, 7.9),)),
        ("D", "Redis", False, 3, ((8.0, 10.0),)),
    ]
    covered = sum(round((hi - lo) * 10) + 1 for o in options for lo, hi in o.ranges)
    assert covered == 101


def test_options_follow_the_policies_for_any_score():
    history = turns(("Payments API", 3, 7.5), ("Redis", 3, None))
    options = next_question_options(PLAN, history, 3, 8)
    for tenth in range(101):
        score = tenth / 10
        real = [*history[:-1], TurnSummary("Redis", 3, score)]
        option = next(o for o in options if any(lo <= score <= hi for lo, hi in o.ranges))
        assert option.matches(choose_next_topic(PLAN, real, 8), next_difficulty(3, real).level)


def test_no_follow_up_option_after_a_follow_up_and_clamped_levels_merge():
    options = next_question_options(PLAN, turns(("Payments API", 1, 5.0), ("Payments API", 1, None, False, True)), 1, 8)
    assert not any(o.choice.follow_up for o in options)
    # At the bottom level "easier" and "same" are both level 1, so they merge into one option.
    assert _summary(options)[0] == ("A", "Redis", False, 1, ((0.0, 7.9),))


def test_an_option_can_cover_separate_score_ranges():
    # At level 1, weak (<4) and solid (7-7.9) answers both lead to Redis at level 1; partial ones get a follow-up.
    options = next_question_options(PLAN, turns(("Payments API", 1, None)), 1, 8)
    assert _summary(options)[0] == ("A", "Redis", False, 1, ((0.0, 3.9), (7.0, 7.9)))
    assert _summary(options)[1][2] is True
