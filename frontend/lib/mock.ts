import type { Settlement } from "./types";

// demo data shaped exactly like the backend settlement
export const mockSettlement: Settlement = {
  _id: "mock-settlement-1",
  paymentId: "PAY-DEMO-001",
  serviceId: "svc-1",
  contractId: "contract-1",
  breachIds: ["b1"],
  authorizedAmount: { $numberDecimal: "100.00" },
  totalCredit: { $numberDecimal: "25.00" },
  finalPayableAmount: { $numberDecimal: "75.00" },
  currency: "USD",
  calculationBreakdown: [
    {
      ruleId: "uptime-credit",
      ruleDescription: "Uptime below 99.9% earns a 25% credit",
      breachId: "b1",
      metric: "uptime",
      contractualThreshold: 99.9,
      observedValue: 97,
      creditType: "PERCENTAGE",
      creditValue: { $numberDecimal: "25" },
      creditAmountCalculated: { $numberDecimal: "25.00" },
      applied: true,
      reason: "Observed uptime 97% is below the 99.9% SLA",
    },
  ],
  calculationVersion: "1.0.0",
  contractVersion: 1,
  status: "RequiresReview",
  requiresReviewReason: "Credit above auto-approval limit",
  calculatedAt: "2026-11-09T10:15:00Z",
  createdAt: "2026-11-09T10:15:00Z",
  updatedAt: "2026-11-09T10:15:00Z",
};

// fake uptime points for the live chart
export const mockUptimeSeries = [
  { t: "10:00", uptime: 100 },
  { t: "10:05", uptime: 99.95 },
  { t: "10:10", uptime: 98.2 },
  { t: "10:15", uptime: 97 },
  { t: "10:20", uptime: 97.4 },
];

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  time: string;
  ref: string;
}

// demo ids, swap for real PayPal sandbox ids when the backend is connected
export const mockTransactions: Transaction[] = [
  { id: "PAYPAL-AUTH-DEMO-1A2B", type: "Authorize", amount: 100, status: "Held", time: "10:00", ref: "Plan purchase" },
  { id: "PAYPAL-CAP-DEMO-7F3A", type: "Partial capture", amount: 75, status: "Completed", time: "10:24", ref: "SLA clause 4.2" },
  { id: "PAYPAL-VOID-DEMO-3C9D", type: "Credit released", amount: 25, status: "Not captured", time: "10:24", ref: "SLA clause 4.2" },
  { id: "PAYPAL-DISP-DEMO-5E1F", type: "Dispute", amount: 0, status: "Evidence ready", time: "10:25", ref: "Severe breach" },
];

export const mockAuditEvents = [
  { tag: "Contract", title: "SLA clause", detail: "Uptime must stay at or above 99.9%. Below that, a 25% credit applies." },
  { tag: "Monitoring", title: "Metric observed", detail: "Uptime measured at 97.0% between 10:10 and 10:20." },
  { tag: "Rules engine", title: "Calculation", detail: "25% of $100.00 = $25.00 credit (calculation v1.0.0)." },
  { tag: "Policy", title: "Policy gate", detail: "Credit is above the auto-approval limit, so a human reviews it." },
  { tag: "Human", title: "Approved", detail: "A reviewer approved capturing $75.00." },
  { tag: "PayPal", title: "Captured on PayPal", detail: "$75.00 captured. Transaction PAYPAL-CAP-DEMO-7F3A." },
];