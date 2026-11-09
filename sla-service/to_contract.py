"""Convert our validated SLA JSON into the body Person 3's POST /api/sla/contracts expects.

Person 3's engine adds up every credit rule that matches. So each uptime tier is sent as the
extra percentage on top of the milder tier before it: 10%, +15%, +25%. At 97% uptime the first
two rules match and add up to 25%, which is the tier the contract states.
If Person 3 changes the engine to use only the highest matching tier, change this file too.
"""
import os
from datetime import datetime, timedelta, timezone

from schema import SLAResult


class ConversionError(ValueError):
    """This SLA can't be safely turned into a contract. The message says why."""


def _cite(source) -> str:
    return f'p.{source.page}: "{source.quote}"'


def to_contract_payload(
    sla: SLAResult, *, service_id: str, contract_reference: str, customer_name: str, now: datetime | None = None
) -> tuple[dict, list[str]]:
    """Return (request body, notes about anything left out)."""
    if sla.validation.status != "ok":
        raise ConversionError("SLA needs review; a person must check it before it can become a contract.")

    notes = []
    uptime = {c.id: c for c in sla.commitments if c.metric == "uptime_percent"}
    for c in sla.commitments:
        if c.id not in uptime:
            # Person 3 measures average response time, not p95, so these would compare the wrong numbers.
            notes.append(f"Skipped {c.metric} commitment {c.id}: the backend only evaluates uptime correctly.")
    if sla.exclusions:
        notes.append("Exclusions are not sent: the backend has no field for them.")

    rules = []
    for commitment_id in uptime:
        # Mildest breach first (highest if_below), so each tier adds on top of the one before.
        tiers = sorted((r for r in sla.credit_rules if r.commitment_id == commitment_id), key=lambda r: -r.if_below)
        paid_so_far = 0.0
        for number, rule in enumerate(tiers, 1):
            extra = rule.credit_percent - paid_so_far
            if extra != int(extra):
                # Person 3's engine rounds percentages to whole numbers, which would change the money.
                raise ConversionError(f"Tier {rule.credit_percent:g}% gives a fractional step ({extra:g}%) the backend can't compute exactly.")
            rules.append({
                "ruleId": f"{commitment_id}-tier{number}",
                "description": f"Uptime below {rule.if_below:g}% pays {rule.credit_percent:g}% in total ({_cite(rule.source)})",
                "applicableMetric": "uptime",
                "operator": "<",
                "threshold": rule.if_below,
                "creditType": "PERCENTAGE",
                "creditValue": int(extra),
                "priority": number,
            })
            paid_so_far = rule.credit_percent
        if sla.credit_cap_percent is not None and paid_so_far > sla.credit_cap_percent:
            raise ConversionError(f"Worst-case credit {paid_so_far:g}% is above the {sla.credit_cap_percent:g}% cap.")

    if not rules:
        raise ConversionError("No uptime credit rules to send.")

    now = now or datetime.now(timezone.utc)
    payload = {
        "serviceId": service_id,
        "contractName": f"{sla.provider} - {sla.service}",
        "contractReference": contract_reference,
        "providerName": sla.provider,
        "customerName": customer_name,
        "effectiveFrom": now.isoformat(),
        "effectiveUntil": (now + timedelta(days=30)).isoformat(),
        "status": "Draft",  # Becomes Active once the PayPal payment is authorized.
        "measurementWindow": {"type": "MONTHLY", "durationMinutes": 43200},
        "targets": [
            {"metric": "uptime", "operator": c.operator, "threshold": c.threshold, "unit": "%", "description": _cite(c.source)}
            for c in uptime.values()
        ],
        "creditRules": rules,
        "source": {"fileName": sla.sla_id, "fileHash": sla.sla_id.removeprefix("sla_"), "uploadedAt": now.isoformat()},
        "extractionMetadata": {
            "modelVersion": os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
            "confidenceScore": min(c.confidence for c in uptime.values()),
            "extractedAt": now.isoformat(),
            "rawSchemaVersion": "sla-extract-v1",
        },
    }
    return payload, notes
