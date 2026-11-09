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