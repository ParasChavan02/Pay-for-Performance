"""The JSON contract. The LLM has no dollar fields, so it can't output a dollar amount.

Value limits such as "uptime is at most 100" live in validate.py, not here. A bad value
should become a listed issue for a person to review, not a crash.
"""
from typing import Literal

from pydantic import BaseModel


class Source(BaseModel):
    page: int
    quote: str


class Commitment(BaseModel):
    id: str
    metric: str  # uptime_percent, p95_latency_ms, ...
    operator: Literal[">=", ">", "<=", "<"]
    threshold: float
    source: Source
    confidence: float


class CreditRule(BaseModel):
    commitment_id: str
    if_below: float | None = None  # For metrics where lower is worse, like uptime.
    if_above: float | None = None  # For metrics where higher is worse, like latency.
    credit_percent: float
    source: Source
    confidence: float


class Exclusion(BaseModel):
    type: str
    max_hours_per_month: float | None = None
    source: Source
    confidence: float


class UncertainClause(BaseModel):
    reason: str
    source: Source


class LLMExtraction(BaseModel):
    """Only what the LLM fills in."""

    provider: str | None = None
    service: str | None = None
    measurement_period: str | None = None
    timezone: str | None = None
    commitments: list[Commitment] = []
    credit_rules: list[CreditRule] = []
    credit_cap_percent: float | None = None
    credit_cap_source: Source | None = None
    exclusions: list[Exclusion] = []
    uncertain_clauses: list[UncertainClause] = []


class Validation(BaseModel):
    status: Literal["ok", "needs_review"]
    issues: list[str] = []


class SLAResult(BaseModel):
    """What POST /sla/extract returns. sla_id and validation come from our code, not the LLM."""

    sla_id: str
    provider: str | None
    service: str | None
    measurement_period: str | None
    timezone: str | None
    commitments: list[Commitment]
    credit_rules: list[CreditRule]
    credit_cap_percent: float | None
    credit_cap_source: Source | None
    exclusions: list[Exclusion]
    validation: Validation
