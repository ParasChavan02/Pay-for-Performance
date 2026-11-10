"""Run the real Groq model on the 3 samples and compare with samples/expected.json.

Uses free-tier quota, so it's separate from pytest. Run: python live_check.py
"""
import json
import sys
from pathlib import Path

from extract import LLMError, extract_sla

SAMPLES = Path(__file__).resolve().parent.parent / "samples"


def problems_with(result, expected: dict) -> list[str]:
    problems = []
    if result.validation.status != expected["status"]:
        problems.append(f"status is {result.validation.status}, expected {expected['status']}")
    if "credits" not in expected:
        return problems

    uptime = [c.threshold for c in result.commitments if c.metric == "uptime_percent"]
    if uptime != [expected["uptime_threshold"]]:
        problems.append(f"uptime thresholds are {uptime}, expected {expected['uptime_threshold']}")
    credits = sorted(([r.if_below, r.credit_percent] for r in result.credit_rules if r.if_below is not None), reverse=True)
    if credits != expected["credits"]:
        problems.append(f"credits are {credits}, expected {expected['credits']}")
    if result.credit_cap_percent != expected["cap"]:
        problems.append(f"cap is {result.credit_cap_percent}, expected {expected['cap']}")
    return problems


def main() -> int:
    failed = False
    for name, expected in json.loads((SAMPLES / "expected.json").read_text()).items():
        try:
            result = extract_sla((SAMPLES / name).read_bytes())
        except LLMError as err:
            failed = True
            print(f"\nFAIL  {name}: {err} (cause: {err.__cause__!r})")
            continue
        problems = problems_with(result, expected)
        failed = failed or bool(problems)
        print(f"\n{'PASS' if not problems else 'FAIL'}  {name}: {result.validation.status}")
        for issue in result.validation.issues:
            print(f"   issue: {issue}")
        for problem in problems:
            print(f"   MISMATCH: {problem}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
