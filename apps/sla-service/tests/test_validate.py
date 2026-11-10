"""Starts from a correct extraction, breaks one thing, and checks that the break is caught."""
from pathlib import Path

import pytest

from pdf_text import extract_pages
from schema import Commitment, CreditRule, Exclusion, LLMExtraction, Source, UncertainClause
from validate import validate

SAMPLES = Path(__file__).resolve().parent.parent / "samples"
if not SAMPLES.exists():
    SAMPLES = Path(__file__).resolve().parents[3] / "samples"


@pytest.fixture(scope="module")
def pages():
    return extract_pages((SAMPLES / "tiered_sla.pdf").read_bytes())


def good() -> LLMExtraction:
    """What a correct LLM should return for tiered_sla.pdf."""
    table = lambda quote: Source(page=2, quote=quote)
    return LLMExtraction(
        provider="Nimbus API Cloud",
        service="Nimbus Payments API",
        measurement_period="calendar month",
        timezone="UTC",
        commitments=[
            Commitment(
                id="c1", metric="uptime_percent", operator=">=", threshold=99.9, confidence=0.98,
                # The real PDF breaks this sentence across two lines.
                source=Source(page=1, quote="Monthly Uptime Percentage of at least 99.9%"),
            ),
            Commitment(
                id="c2", metric="p95_latency_ms", operator="<=", threshold=500, confidence=0.95,
                source=Source(page=2, quote="will not exceed 500 milliseconds"),
            ),
        ],
        credit_rules=[
            CreditRule(commitment_id="c1", if_below=99.9, credit_percent=10, confidence=0.95, source=table("99.0% to below 99.9% 10%")),
            CreditRule(commitment_id="c1", if_below=99.0, credit_percent=25, confidence=0.95, source=table("95.0% to below 99.0% 25%")),
            CreditRule(commitment_id="c1", if_below=95.0, credit_percent=50, confidence=0.95, source=table("Below 95.0% 50%")),
        ],
        credit_cap_percent=50,
        credit_cap_source=Source(page=3, quote="will not exceed 50% of the monthly fee"),
        exclusions=[
            Exclusion(
                type="scheduled_maintenance", max_hours_per_month=2, confidence=0.95,
                source=Source(page=3, quote="Scheduled maintenance of up to 2 hours per month"),
            )
        ],
    )


def issues_after(pages, change) -> str:
    data = good()
    change(data)
    result = validate(data, pages)
    assert result.status == "needs_review"
    return " | ".join(result.issues)


def test_a_correct_extraction_passes(pages):
    result = validate(good(), pages)
    assert result.issues == []
    assert result.status == "ok"


def test_curly_quotes_and_line_breaks_still_match():
    pages = {1: "Provider's   uptime is at\nleast 99.9%"}
    data = good()
    data.commitments = [data.commitments[0]]
    data.commitments[0].source = Source(page=1, quote="Provider’s uptime is at least 99.9%")
    assert not any("Commitment c1" in issue for issue in validate(data, pages).issues)


# --- Hallucinations ---
def test_invented_quote(pages):
    def change(d):
        d.commitments[0].source.quote = "guarantees 99.9% uptime forever"
    assert "quote not found in the PDF" in issues_after(pages, change)


@pytest.mark.parametrize("wrong_page", [3, 99])
def test_real_quote_with_wrong_page_is_corrected_by_code(pages, wrong_page):
    """Seen live: Groq copied tier rows exactly but cited page 3 instead of 2."""
    data = good()
    data.credit_rules[1].source.page = wrong_page
    result = validate(data, pages)
    assert result.status == "ok"
    assert data.credit_rules[1].source.page == 2


def test_quote_on_several_pages_is_not_guessed():
    pages = {1: "Uptime is at least 99.9%", 2: "Uptime is at least 99.9%"}
    data = good()
    data.commitments = [data.commitments[0].model_copy(update={"source": Source(page=5, quote="Uptime is at least 99.9%")})]
    assert any("page is unclear" in issue for issue in validate(data, pages).issues)


def test_wrong_page_does_not_excuse_a_wrong_number(pages):
    def change(d):
        d.credit_rules[1].source.page = 3
        d.credit_rules[1].credit_percent = 30
    assert "value 30 does not appear" in issues_after(pages, change)


def test_right_quote_but_wrong_number(pages):
    def change(d):
        d.commitments[0].threshold = 99.5
    assert "value 99.5 does not appear" in issues_after(pages, change)


def test_wrong_credit_percent_is_not_hidden_by_a_real_quote(pages):
    def change(d):
        d.credit_rules[1].credit_percent = 30
    assert "value 30 does not appear" in issues_after(pages, change)


def test_number_match_is_exact_not_a_substring(pages):
    def change(d):
        d.credit_rules[1].credit_percent = 5  # "5" is inside "25%" but isn't the value.
    assert "value 5 does not appear" in issues_after(pages, change)


def test_empty_quote(pages):
    def change(d):
        d.commitments[0].source.quote = "   "
    assert "quote is empty" in issues_after(pages, change)


# --- Ranges ---
def test_uptime_over_100(pages):
    def change(d):
        d.commitments[0].threshold = 199.9
    assert "outside 0-100" in issues_after(pages, change)


def test_negative_latency(pages):
    def change(d):
        d.commitments[1].threshold = -500
    assert "must be positive" in issues_after(pages, change)


def test_credit_over_100(pages):
    def change(d):
        d.credit_rules[2].credit_percent = 150
    assert "credit 150% is outside 0-100" in issues_after(pages, change)


def test_credit_above_the_cap(pages):
    def change(d):
        d.credit_cap_percent = 20
    assert "above the 20% cap" in issues_after(pages, change)


def test_impossible_exclusion_hours(pages):
    def change(d):
        d.exclusions[0].max_hours_per_month = 1000
    assert "not possible" in issues_after(pages, change)


def test_unknown_metric(pages):
    def change(d):
        d.commitments[1].metric = "vibes"
    assert "unknown metric" in issues_after(pages, change)


# --- Tiers ---
def test_worse_outage_paying_less_is_caught(pages):
    def change(d):
        d.credit_rules[1].credit_percent, d.credit_rules[2].credit_percent = 50, 25
    assert "not monotonic" in issues_after(pages, change)


def test_tier_order_from_the_llm_does_not_matter(pages):
    data = good()
    data.credit_rules.reverse()
    assert validate(data, pages).status == "ok"


def test_latency_tiers_get_worse_as_the_number_goes_up():
    pages = {1: "If latency is above 300 ms, credit 5%. If latency is above 600 ms, credit 20%."}
    data = good()
    source = Source(page=1, quote="If latency is above 300 ms, credit 5%.")
    data.credit_rules = [
        CreditRule(commitment_id="c2", if_above=300, credit_percent=5, confidence=0.9, source=source),
        CreditRule(commitment_id="c2", if_above=600, credit_percent=2, confidence=0.9, source=source),
    ]
    assert any("not monotonic" in issue for issue in validate(data, pages).issues)


def test_uptime_credit_with_the_wrong_direction(pages):
    def change(d):
        d.credit_rules[0].if_above, d.credit_rules[0].if_below = 99.9, None
    assert "must use if_below" in issues_after(pages, change)


def test_rule_with_both_directions(pages):
    def change(d):
        d.credit_rules[0].if_above = 99.9
    assert "exactly one" in issues_after(pages, change)


def test_rule_for_a_commitment_that_does_not_exist(pages):
    def change(d):
        d.credit_rules[0].commitment_id = "c404"
    assert "unknown commitment" in issues_after(pages, change)


# --- Edge cases: missing data ---
@pytest.mark.parametrize("field", ["provider", "service", "measurement_period", "timezone"])
def test_missing_top_level_field(pages, field):
    def change(d):
        setattr(d, field, None)
    assert f"Missing {field}" in issues_after(pages, change)


def test_no_commitments(pages):
    def change(d):
        d.commitments = []
    assert "No measurable commitments" in issues_after(pages, change)


def test_no_credit_rules(pages):
    def change(d):
        d.credit_rules = []
    assert "No credit rules" in issues_after(pages, change)


def test_no_cap(pages):
    def change(d):
        d.credit_cap_percent = None
    assert "No credit cap" in issues_after(pages, change)


def test_cap_without_a_source(pages):
    def change(d):
        d.credit_cap_source = None
    assert "Credit cap has no source" in issues_after(pages, change)


# --- Edge cases: contradictions ---
def test_two_different_uptime_promises(pages):
    def change(d):
        d.commitments.append(d.commitments[0].model_copy(update={"id": "c3", "threshold": 99.5}))
    assert "Contradiction: uptime_percent" in issues_after(pages, change)


def test_two_credits_at_the_same_limit(pages):
    def change(d):
        d.credit_rules[1].if_below = 99.9
    assert "two credits at the same limit" in issues_after(pages, change)


def test_duplicate_commitment_id(pages):
    def change(d):
        d.commitments[1].id = "c1"
    assert "duplicate id" in issues_after(pages, change)


# --- Edge cases: vague wording ---
def test_low_confidence(pages):
    def change(d):
        d.commitments[0].confidence = 0.79
    assert "low confidence" in issues_after(pages, change)


def test_confidence_of_exactly_the_threshold_passes(pages):
    data = good()
    data.commitments[0].confidence = 0.8
    assert validate(data, pages).status == "ok"


def test_confidence_given_as_a_percentage(pages):
    def change(d):
        d.commitments[0].confidence = 95
    assert "not between 0 and 1" in issues_after(pages, change)


def test_clause_the_llm_found_vague(pages):
    def change(d):
        d.uncertain_clauses = [
            UncertainClause(reason="Credit is at Provider's discretion", source=Source(page=2, quote="Service credits are"))
        ]
    assert "Provider's discretion" in issues_after(pages, change)


def test_exclusion_with_no_hour_limit(pages):
    def change(d):
        d.exclusions[0].max_hours_per_month = None
    assert "no hour limit" in issues_after(pages, change)


def test_dollar_credit_is_flagged(pages):
    pages = {**pages, 2: pages[2] + "\nBelow 90% pays $500 or 60%"}
    def change(d):
        d.credit_rules.append(
            CreditRule(commitment_id="c1", if_below=90, credit_percent=60, confidence=0.9, source=Source(page=2, quote="Below 90% pays $500 or 60%"))
        )
    assert "dollar amount" in issues_after(pages, change)


# --- Edge cases: vague wording the LLM reported as certain ---
@pytest.mark.parametrize("quote, word", [
    ("If uptime falls below 98%, a credit of up to 15% may apply.", "up to"),
    ("Credits may be granted at Provider's discretion: below 98% pays 15%.", "may"),
])
def test_hedged_credit_rule_is_flagged_even_at_high_confidence(quote, word):
    pages = {1: "Provider guarantees 99.9% uptime.", 2: quote}
    data = good()
    data.commitments = [data.commitments[0].model_copy(update={"source": Source(page=1, quote="guarantees 99.9% uptime")})]
    data.credit_rules = [CreditRule(commitment_id="c1", if_below=98, credit_percent=15, confidence=1.0, source=Source(page=2, quote=quote))]
    issues = " | ".join(validate(data, pages).issues)
    assert f'vague wording "{word}"' in issues


def test_target_is_not_a_guarantee():
    pages = {1: "Provider targets uptime of 99.5% in a typical month."}
    data = good()
    data.commitments = [data.commitments[0].model_copy(update={"threshold": 99.5, "source": Source(page=1, quote="targets uptime of 99.5%")})]
    data.credit_rules = []
    assert any('vague wording "targets"' in issue for issue in validate(data, pages).issues)


def test_caps_and_exclusions_may_say_up_to(pages):
    """'up to 2 hours' is a normal exclusion limit, so it must not be flagged as vague."""
    assert validate(good(), pages).status == "ok"
