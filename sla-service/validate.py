"""Plain-code checks on what the LLM returned. No LLM runs here, so it can't mark its own work.

Each check adds a readable issue. Any issue means needs_review, and a person takes a look.
"""
import re

from schema import LLMExtraction, Source, Validation

MIN_CONFIDENCE = 0.8
KNOWN_METRICS = {"uptime_percent", "p95_latency_ms"}
HOURS_IN_LONGEST_MONTH = 744
_NUMBER = re.compile(r"\d+(?:\.\d+)?")
_LOOKALIKES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-"})


def _normalize(text: str) -> str:
    """PDF text breaks lines in odd places, so spacing and curly quotes shouldn't fail a match."""
    return " ".join(text.translate(_LOOKALIKES).split()).casefold()


def _check_source(label: str, source: Source, pages: dict[int, str], numbers: tuple[float, ...], issues: list[str]) -> None:
    """The quote must be on the cited page and must contain the numbers we extracted from it."""
    if source.page not in pages:
        issues.append(f"{label}: page {source.page} does not exist in this PDF.")
        return
    quote = _normalize(source.quote)
    if not quote:
        issues.append(f"{label}: source quote is empty.")
        return
    if quote not in _normalize(pages[source.page]):
        issues.append(f"{label}: quote not found on page {source.page}: \"{source.quote}\"")
        return
    in_quote = {float(n) for n in _NUMBER.findall(quote)}
    for number in numbers:
        if number not in in_quote:
            issues.append(f"{label}: value {number:g} does not appear in its quote: \"{source.quote}\"")


def _check_confidence(label: str, confidence: float, issues: list[str]) -> None:
    if not 0 <= confidence <= 1:
        issues.append(f"{label}: confidence {confidence:g} is not between 0 and 1.")
    elif confidence < MIN_CONFIDENCE:
        issues.append(f"{label}: low confidence ({confidence:g}).")


def _check_commitments(data: LLMExtraction, pages: dict[int, str], issues: list[str]) -> None:
    if not data.commitments:
        issues.append("No measurable commitments found.")

    thresholds_by_metric: dict[str, set[float]] = {}
    seen_ids: set[str] = set()
    for c in data.commitments:
        label = f"Commitment {c.id}"
        if c.id in seen_ids:
            issues.append(f"{label}: duplicate id.")
        seen_ids.add(c.id)

        if c.metric not in KNOWN_METRICS:
            issues.append(f"{label}: unknown metric '{c.metric}'.")
        if c.metric == "uptime_percent" and not 0 < c.threshold <= 100:
            issues.append(f"{label}: uptime {c.threshold:g} is outside 0-100.")
        if c.metric == "p95_latency_ms" and c.threshold <= 0:
            issues.append(f"{label}: latency {c.threshold:g} must be positive.")
        _check_source(label, c.source, pages, (c.threshold,), issues)
        _check_confidence(label, c.confidence, issues)
        thresholds_by_metric.setdefault(c.metric, set()).add(c.threshold)

    for metric, thresholds in thresholds_by_metric.items():
        if len(thresholds) > 1:
            values = ", ".join(f"{t:g}" for t in sorted(thresholds))
            issues.append(f"Contradiction: {metric} has different thresholds ({values}).")


def _check_credit_rules(data: LLMExtraction, pages: dict[int, str], issues: list[str]) -> None:
    if not data.credit_rules:
        issues.append("No credit rules found.")

    commitments = {c.id: c for c in data.commitments}
    tiers: dict[tuple[str, str], list[tuple[float, float]]] = {}
    for i, rule in enumerate(data.credit_rules, 1):
        label = f"Credit rule {i}"
        if (rule.if_below is None) == (rule.if_above is None):
            issues.append(f"{label}: must set exactly one of if_below or if_above.")
            continue
        direction = "if_below" if rule.if_below is not None else "if_above"
        limit = rule.if_below if rule.if_below is not None else rule.if_above

        commitment = commitments.get(rule.commitment_id)
        if commitment is None:
            issues.append(f"{label}: refers to unknown commitment '{rule.commitment_id}'.")
        elif commitment.metric == "uptime_percent" and direction != "if_below":
            issues.append(f"{label}: uptime credits must use if_below.")
        elif commitment.metric == "p95_latency_ms" and direction != "if_above":
            issues.append(f"{label}: latency credits must use if_above.")

        if not 0 < rule.credit_percent <= 100:
            issues.append(f"{label}: credit {rule.credit_percent:g}% is outside 0-100.")
        if data.credit_cap_percent is not None and rule.credit_percent > data.credit_cap_percent:
            issues.append(f"{label}: credit {rule.credit_percent:g}% is above the {data.credit_cap_percent:g}% cap.")
        if "$" in rule.source.quote:
            issues.append(f"{label}: quote mentions a dollar amount; we only support percentage credits.")
        _check_source(label, rule.source, pages, (limit, rule.credit_percent), issues)
        _check_confidence(label, rule.confidence, issues)
        tiers.setdefault((rule.commitment_id, direction), []).append((limit, rule.credit_percent))

    for (commitment_id, direction), rows in tiers.items():
        # Sort from the mildest breach to the worst, so each credit must be bigger than the last.
        ordered = sorted(rows, reverse=direction == "if_below")
        for (limit_a, credit_a), (limit_b, credit_b) in zip(ordered, ordered[1:]):
            if limit_a == limit_b:
                issues.append(f"Contradiction: {commitment_id} has two credits at the same limit {limit_a:g}.")
            elif credit_b <= credit_a:
                issues.append(
                    f"Credit tiers for {commitment_id} are not monotonic: "
                    f"{limit_a:g} pays {credit_a:g}% but worse {limit_b:g} pays {credit_b:g}%."
                )


def _check_cap(data: LLMExtraction, pages: dict[int, str], issues: list[str]) -> None:
    if data.credit_cap_percent is None:
        issues.append("No credit cap found.")
        return
    if not 0 < data.credit_cap_percent <= 100:
        issues.append(f"Credit cap {data.credit_cap_percent:g}% is outside 0-100.")
    if data.credit_cap_source is None:
        issues.append("Credit cap has no source.")
        return
    if "$" in data.credit_cap_source.quote:
        issues.append("Credit cap quote mentions a dollar amount; we only support percentage caps.")
    _check_source("Credit cap", data.credit_cap_source, pages, (data.credit_cap_percent,), issues)


def _check_exclusions(data: LLMExtraction, pages: dict[int, str], issues: list[str]) -> None:
    for i, exclusion in enumerate(data.exclusions, 1):
        label = f"Exclusion {i} ({exclusion.type})"
        hours = exclusion.max_hours_per_month
        if hours is None:
            # With no limit, the provider could call any outage excluded.
            issues.append(f"{label}: has no hour limit.")
        elif not 0 <= hours <= HOURS_IN_LONGEST_MONTH:
            issues.append(f"{label}: {hours:g} hours per month is not possible.")
        _check_source(label, exclusion.source, pages, () if hours is None else (hours,), issues)
        _check_confidence(label, exclusion.confidence, issues)


def validate(data: LLMExtraction, pages: dict[int, str]) -> Validation:
    issues: list[str] = []
    for field in ("provider", "service", "measurement_period", "timezone"):
        if not (getattr(data, field) or "").strip():
            issues.append(f"Missing {field}.")

    _check_commitments(data, pages, issues)
    _check_credit_rules(data, pages, issues)
    _check_cap(data, pages, issues)
    _check_exclusions(data, pages, issues)

    # Clauses the LLM itself found vague. We keep these even if its quote fails a check.
    for clause in data.uncertain_clauses:
        issues.append(f"Uncertain clause on page {clause.source.page}: {clause.reason} (\"{clause.source.quote}\")")
        _check_source("Uncertain clause", clause.source, pages, (), issues)

    return Validation(status="needs_review" if issues else "ok", issues=issues)
