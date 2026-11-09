"""Converter and buyer agent tests. Fake HTTP servers stand in for Person 1's and Person 3's APIs."""
import json

import httpx
import pytest

import buyer_agent
from schema import SLAResult, Validation
from test_validate import good
from to_contract import ConversionError, to_contract_payload


def sla(status="ok", **changes) -> SLAResult:
    data = good().model_dump(exclude={"uncertain_clauses"})
    data.update(changes)
    return SLAResult(sla_id="sla_abc123", validation=Validation(status=status, issues=[] if status == "ok" else ["x"]), **data)


def credit_at(payload: dict, uptime: float) -> float:
    """What Person 3's engine computes: it adds up every rule whose condition matches."""
    return sum(r["creditValue"] for r in payload["creditRules"] if uptime < r["threshold"])


# --- Converter ---
def payload_for(result=None):
    return to_contract_payload(result or sla(), service_id="a" * 24, contract_reference="ref-1", customer_name="Buyer")


@pytest.mark.parametrize("uptime, expected", [(99.95, 0), (99.5, 10), (97.0, 25), (94.0, 50)])
def test_tiers_add_up_to_the_stated_tier_in_person_3s_engine(uptime, expected):
    payload, _ = payload_for()
    assert credit_at(payload, uptime) == expected


def test_demo_100_dollars_becomes_75():
    payload, _ = payload_for()
    assert 100 - 100 * credit_at(payload, 97.0) / 100 == 75


def test_payload_matches_person_3s_contract_shape():
    payload, notes = payload_for()
    assert payload["targets"] == [
        {"metric": "uptime", "operator": ">=", "threshold": 99.9, "unit": "%", "description": 'p.1: "Monthly Uptime Percentage of at least 99.9%"'}
    ]
    rule = payload["creditRules"][1]
    assert rule["applicableMetric"] == "uptime" and rule["operator"] == "<" and rule["creditType"] == "PERCENTAGE"
    assert "p.2" in rule["description"] and "25% in total" in rule["description"]
    assert payload["status"] == "Draft"
    assert payload["effectiveUntil"] > payload["effectiveFrom"]
    assert payload["extractionMetadata"]["confidenceScore"] == 0.98
    assert any("p95_latency_ms" in note for note in notes)
    assert any("Exclusions" in note for note in notes)


def test_tier_order_from_the_llm_does_not_matter():
    data = good()
    data.credit_rules.reverse()
    result = SLAResult(sla_id="sla_abc123", validation=Validation(status="ok"), **data.model_dump(exclude={"uncertain_clauses"}))
    payload, _ = payload_for(result)
    assert credit_at(payload, 97.0) == 25


def test_refuses_an_sla_that_needs_review():
    with pytest.raises(ConversionError, match="needs review"):
        payload_for(sla(status="needs_review"))


def test_refuses_fractional_percentages_the_backend_would_round():
    result = sla()
    result.credit_rules[1].credit_percent = 22.5
    with pytest.raises(ConversionError, match="fractional"):
        payload_for(result)


def test_refuses_when_no_uptime_credit_rules():
    with pytest.raises(ConversionError, match="No uptime credit rules"):
        payload_for(sla(credit_rules=[]))


def test_payload_contains_no_dollar_amounts():
    payload, _ = payload_for()
    text = json.dumps(payload).lower()
    assert "$" not in text and "amount" not in text


# --- Choosing an offer ---
ACME = {"provider": "Acme", "plan": "Pro", "price": 120.0}
NIMBUS = {"provider": "Nimbus", "plan": "Std", "price": 100.0}
CIRRUS = {"provider": "Cirrus", "plan": "Basic", "price": 80.0}


def offers():
    clean = sla(credit_rules=[good().credit_rules[0]])  # Pays at most 10%
    return [(ACME, clean), (NIMBUS, sla()), (CIRRUS, sla(status="needs_review"))]


def test_picks_the_most_protection_within_budget():
    choice, reasons = buyer_agent.choose(offers(), budget=150, min_uptime=99.9)
    assert choice[0] is NIMBUS
    assert any("Rejected Cirrus" in r and "needs review" in r for r in reasons)


def test_cheaper_wins_when_protection_is_equal():
    same = [(ACME, sla()), (NIMBUS, sla())]
    assert buyer_agent.choose(same, budget=150, min_uptime=99.9)[0][0] is NIMBUS


def test_never_picks_an_sla_that_needs_review_even_if_cheapest():
    only_bad = [(CIRRUS, sla(status="needs_review"))]
    assert buyer_agent.choose(only_bad, budget=1000, min_uptime=0)[0] is None


def test_budget_and_uptime_are_enforced():
    choice, reasons = buyer_agent.choose(offers(), budget=110, min_uptime=99.9)
    assert choice[0] is NIMBUS and any("over the $110 budget" in r for r in reasons)
    choice, reasons = buyer_agent.choose(offers(), budget=150, min_uptime=99.99)
    assert choice is None and any("less than 99.99% uptime" in r for r in reasons)


# --- Talking to Person 1 and Person 3 ---
def fake_servers(log):
    def handle(request: httpx.Request):
        body = json.loads(request.content) if request.content else None
        log.append((request.method, request.url.path, body, request.headers.get("Idempotency-Key")))
        path = request.url.path
        if path == "/api/sla/contracts":
            return httpx.Response(201, json={"success": True, "data": {"_id": "c" * 24}})
        if path == "/api/payments/create-order":
            return httpx.Response(201, json={"success": True, "data": {
                "paymentId": "PAY-1", "orderId": "ORDER1", "approvalUrl": "https://sandbox.paypal.com/x", "amount": body["amount"]}})
        if path == "/api/payments/ORDER1/authorize":
            return httpx.Response(200, json={"success": True, "data": {"id": "PAY-1", "status": "AUTHORIZED", "authorizedAmount": 100}})
        if path == f"/api/sla/contracts/{'c' * 24}/status":
            return httpx.Response(200, json={"success": True, "data": {}})
        return httpx.Response(404, json={"error": "not found"})
    return httpx.Client(transport=httpx.MockTransport(handle))


@pytest.fixture
def urls(monkeypatch):
    monkeypatch.setattr(buyer_agent, "PAYMENTS_API", "http://p1/api")
    monkeypatch.setattr(buyer_agent, "BACKEND_API", "http://p3/api")


def test_buy_registers_contract_then_creates_the_paypal_order(urls):
    log = []
    result = buyer_agent.buy(fake_servers(log), offers(), budget=150, min_uptime=99.9, service_id="a" * 24)
    assert [entry[1] for entry in log] == ["/api/sla/contracts", "/api/payments/create-order"]
    order = log[1][2]
    assert order["amount"] == 100.0 and order["currency"] == "USD"
    assert order["metadata"]["sla_id"] == "sla_abc123"
    assert order["metadata"]["contract_reference"] == log[0][2]["contractReference"]  # Links money to the clause.
    assert log[1][3].startswith("buy-")
    assert result["orderId"] == "ORDER1" and result["contract_id"] == "c" * 24


def test_buy_without_service_id_only_creates_the_order(urls):
    log = []
    buyer_agent.buy(fake_servers(log), offers(), budget=150, min_uptime=99.9)
    assert [entry[1] for entry in log] == ["/api/payments/create-order"]


def test_dry_run_sends_nothing(urls):
    log = []
    result = buyer_agent.buy(fake_servers(log), offers(), budget=150, min_uptime=99.9, service_id="a" * 24, dry_run=True)
    assert log == [] and result["order"]["amount"] == 100.0


def test_nothing_is_bought_when_no_offer_qualifies(urls):
    log = []
    assert buyer_agent.buy(fake_servers(log), offers(), budget=50, min_uptime=99.9) is None
    assert log == []


def test_rejected_contract_stops_before_any_payment(urls):
    log = []
    client = httpx.Client(transport=httpx.MockTransport(lambda r: (log.append(r.url.path), httpx.Response(409, text="overlap"))[1]))
    with pytest.raises(buyer_agent.AgentError, match="409"):
        buyer_agent.buy(client, offers(), budget=150, min_uptime=99.9, service_id="a" * 24)
    assert log == ["/api/sla/contracts"]


def test_authorize_holds_money_then_activates_contract(urls):
    log = []
    payment = buyer_agent.authorize(fake_servers(log), "ORDER1", contract_id="c" * 24)
    assert payment["status"] == "AUTHORIZED"
    assert [(m, p) for m, p, *_ in log] == [("POST", "/api/payments/ORDER1/authorize"), ("PATCH", f"/api/sla/contracts/{'c' * 24}/status")]
    assert log[1][2] == {"status": "Active"}


def test_unreachable_server_gives_a_readable_error(urls):
    def down(request):
        raise httpx.ConnectError("refused")
    with pytest.raises(buyer_agent.AgentError, match="Is that server running"):
        buyer_agent.buy(httpx.Client(transport=httpx.MockTransport(down)), offers(), budget=150, min_uptime=99.9)
