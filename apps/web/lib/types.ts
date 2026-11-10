export type SettlementStatus =
  | "Draft" | "Calculated" | "RequiresReview" | "Approved" | "Rejected"
  | "Blocked" | "ReadyForPayment" | "PaymentPending" | "Paid" | "Failed";

// mongo decimals come over json as { $numberDecimal: "100.00" }
export type Money = string | { $numberDecimal: string };

export interface BreakdownItem {
  ruleId: string;
  ruleDescription: string;
  breachId: string;
  metric: string;
  contractualThreshold: number;
  observedValue: number;
  creditType: "FIXED" | "PERCENTAGE";
  creditValue: Money;
  creditAmountCalculated: Money;
  applied: boolean;
  reason: string;
}

export interface Settlement {
  _id: string;
  paymentId: string;
  serviceId: string;
  contractId: string;
  breachIds: string[];
  authorizedAmount: Money;
  totalCredit: Money;
  finalPayableAmount: Money;
  currency: string;
  calculationBreakdown: BreakdownItem[];
  calculationVersion: string;
  contractVersion: number;
  status: SettlementStatus;
  requiresReviewReason?: string;
  calculatedAt: string;
  createdAt: string;
  updatedAt: string;
}