"""Buyer agent: compare provider offers by their SLAs, pick one, and start the PayPal payment.

  python buyer_agent.py buy --budget 100 --min-uptime 99.9 [--service-id ID] [--dry-run]
  python buyer_agent.py authorize ORDER_ID [--contract-id ID]

"buy" reads each offer's SLA with the AI, picks the best one in plain code, and creates a PayPal
order through Person 1's API. A person then approves the payment at the printed PayPal link, and
"authorize" places the hold. With --service-id, the contract is also registered with Person 3's
backend, and authorize activates it.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv

from extract import extract_sla
from schema import SLAResult
from to_contract import to_contract_payload

load_dotenv()
HERE = Path(__file__).resolve().parent
SAMPLES = HERE / "samples"
PAYMENTS_API = os.environ.get("PAYMENTS_API_URL", "http://localhost:3000/api")
BACKEND_API = os.environ.get("BACKEND_API_URL", "http://localhost:5000/api")


class AgentError(RuntimeError):
    pass


def max_uptime_credit(sla: SLAResult) -> float:
    return max((r.credit_percent for r in sla.credit_rules if r.if_below is not None), default=0)


def choose(offers: list[tuple[dict, SLAResult]], budget: float, min_uptime: float) -> tuple[tuple[dict, SLAResult] | None, list[str]]:
    """Pick the offer with the most credit protection, then the lowest price. Plain code, no AI."""
    reasons, eligible = [], []
    for offer, sla in offers:
        name = f"{offer['provider']} (${offer['price']:g})"
        uptime = [c.threshold for c in sla.commitments if c.metric == "uptime_percent"]
        if sla.validation.status != "ok":
            reasons.append(f"Rejected {name}: its SLA needs review ({len(sla.validation.issues)} issues).")
            reasons.extend(f"    - {issue}" for issue in sla.validation.issues)
        elif offer["price"] > budget:
            reasons.append(f"Rejected {name}: over the ${budget:g} budget.")
        elif not uptime or min(uptime) < min_uptime:
            reasons.append(f"Rejected {name}: promises less than {min_uptime:g}% uptime.")
        else:
            eligible.append((offer, sla))
            reasons.append(f"Eligible {name}: {min(uptime):g}% uptime, up to {max_uptime_credit(sla):g}% credit if breached.")
    if not eligible:
        return None, reasons
    best = min(eligible, key=lambda pair: (-max_uptime_credit(pair[1]), pair[0]["price"]))
    reasons.append(f"Chose {best[0]['provider']}: most credit protection, then lowest price.")
    return best, reasons


def _post(client: httpx.Client, url: str, body: dict | None = None, headers: dict | None = None) -> dict:
    try:
        response = client.post(url, json=body, headers=headers)
    except httpx.HTTPError as err:
        raise AgentError(f"Could not reach {url}. Is that server running? ({err})") from err
    if response.is_error:
        raise AgentError(f"{url} returned {response.status_code}: {response.text[:300]}")
    return response.json()["data"]


def buy(client: httpx.Client, offers: list[tuple[dict, SLAResult]], budget: float, min_uptime: float,
        service_id: str | None = None, dry_run: bool = False) -> dict | None:
    choice, reasons = choose(offers, budget, min_uptime)
    for reason in reasons:
        print(f"  {reason}")
    if choice is None:
        print("No offer meets the requirements. Nothing was bought.")
        return None

    offer, sla = choice
    reference = f"{sla.sla_id}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}"
    order = {
        "amount": offer["price"],
        "currency": "USD",
        "description": f"{offer['provider']} {offer['plan']} (SLA {sla.sla_id})"[:255],
        "metadata": {"sla_id": sla.sla_id, "provider": offer["provider"], "contract_reference": reference},
    }
    contract = None
    if service_id:
        contract, notes = to_contract_payload(sla, service_id=service_id, contract_reference=reference, customer_name="Buyer Agent")
        for note in notes:
            print(f"  Note: {note}")

    if dry_run:
        print("\nDry run, nothing sent. Would POST to payments create-order:")
        print(json.dumps(order, indent=2))
        if contract:
            print("Would POST to backend sla/contracts:")
            print(json.dumps(contract, indent=2))
        return {"order": order, "contract": contract}

    result = {}
    if contract:
        # Register the contract first: if it's rejected, no payment gets created.
        result["contract_id"] = _post(client, f"{BACKEND_API}/sla/contracts", contract)["_id"]
        print(f"\nContract registered with the backend: {result['contract_id']} (Draft)")
    payment = _post(client, f"{PAYMENTS_API}/payments/create-order", order, {"Idempotency-Key": f"buy-{reference}"})
    result.update(payment)
    print(f"\nPayPal order {payment['orderId']} created for ${payment['amount']:g}.")
    print(f"A person must approve it here: {payment['approvalUrl']}")
    extra = f" --contract-id {result['contract_id']}" if contract else ""
    print(f"Then run: python buyer_agent.py authorize {payment['orderId']}{extra}")
    return result


def authorize(client: httpx.Client, order_id: str, contract_id: str | None = None) -> dict:
    payment = _post(client, f"{PAYMENTS_API}/payments/{order_id}/authorize", headers={"Idempotency-Key": f"auth-{order_id}"})
    print(f"Payment {payment['id']} is {payment['status']}: ${payment['authorizedAmount']:g} held, not captured.")
    if contract_id:
        try:
            response = client.patch(f"{BACKEND_API}/sla/contracts/{contract_id}/status", json={"status": "Active"})
        except httpx.HTTPError as err:
            raise AgentError(f"Could not reach the backend to activate the contract. ({err})") from err
        if response.is_error:
            raise AgentError(f"Payment is held, but the contract wasn't activated: {response.status_code} {response.text[:300]}")
        print(f"Contract {contract_id} is now Active, so monitoring results count toward credits.")
    return payment


def load_offers() -> list[tuple[dict, SLAResult]]:
    offers = []
    for offer in json.loads((HERE / "offers.json").read_text()):
        print(f"Reading the SLA for {offer['provider']} with AI...")
        offers.append((offer, extract_sla((SAMPLES / offer["sla_pdf"]).read_bytes())))
    return offers


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    buy_cmd = commands.add_parser("buy")
    buy_cmd.add_argument("--budget", type=float, required=True)
    buy_cmd.add_argument("--min-uptime", type=float, default=99.9)
    buy_cmd.add_argument("--service-id", help="Person 3's MongoDB service id; registers the contract too")
    buy_cmd.add_argument("--dry-run", action="store_true", help="Print the requests instead of sending them")
    auth_cmd = commands.add_parser("authorize")
    auth_cmd.add_argument("order_id")
    auth_cmd.add_argument("--contract-id")
    args = parser.parse_args()

    try:
        with httpx.Client(timeout=30) as client:
            if args.command == "buy":
                buy(client, load_offers(), args.budget, args.min_uptime, args.service_id, args.dry_run)
            else:
                authorize(client, args.order_id, args.contract_id)
    except Exception as err:  # Show a readable message instead of a stack trace.
        print(f"Stopped: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
