"use client";
import { useState } from "react";
import type { Settlement } from "@/lib/types";
import { toNumber, formatMoney } from "@/lib/money";

export default function ApprovalCard({ settlement }: { settlement: Settlement }) {
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected">("pending");
  const cur = settlement.currency;
  const credit = formatMoney(toNumber(settlement.totalCredit), cur);
  const payable = formatMoney(toNumber(settlement.finalPayableAmount), cur);

  // later : call the approvals api here instead of just setting state
  return (
    <div className="rounded-3xl bg-surface-container-lowest border border-surface-container p-6 shadow-sm">
      <h3 className="font-headline font-bold text-lg text-primary mb-1">Payment approval</h3>
      <p className="text-sm text-on-surface-variant mb-5">
        {settlement.requiresReviewReason ?? "Review the calculated settlement"}
      </p>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 p-4 rounded-2xl bg-secondary-container/30 text-center">
          <p className="text-[11px] font-bold uppercase text-secondary">SLA credit</p>
          <p className="font-headline font-bold text-3xl text-secondary">{credit}</p>
        </div>
        <div className="flex-1 p-4 rounded-2xl bg-surface-container text-center">
          <p className="text-[11px] font-bold uppercase text-on-surface-variant">Capture</p>
          <p className="font-headline font-bold text-3xl text-primary">{payable}</p>
        </div>
      </div>

      {decision === "pending" && (
        <div className="flex gap-3">
          <button onClick={() => setDecision("approved")}
            className="flex-1 py-3 rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-container transition-colors">
            Approve &amp; capture
          </button>
          <button onClick={() => setDecision("rejected")}
            className="px-6 py-3 rounded-full border border-outline-variant text-on-surface-variant font-semibold hover:bg-surface-container transition-colors">
            Reject
          </button>
        </div>
      )}
      {decision === "approved" && (
        <p className="text-secondary font-bold">✅ Approved — {payable} captured on PayPal</p>
      )}
      {decision === "rejected" && (
        <p className="text-error font-bold">Rejected — settlement blocked</p>
      )}
    </div>
  );
}