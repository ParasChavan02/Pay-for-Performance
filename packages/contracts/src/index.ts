/**
 * Pay-for-Performance Shared Contracts & Domain Models
 */

// --- General API Response Structure ---
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  debugId?: string;
}

// --- Payment Types (Person 1) ---
export type PaymentStatus =
  | 'CREATED'
  | 'APPROVED'
  | 'AUTHORIZED'
  | 'SETTLEMENT_STAGED'
  | 'CAPTURED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'VOIDED'
  | 'FAILED';

export interface PaymentRecord {
  paymentId: string;
  orderId: string;
  authorizationId?: string;
  captureId?: string;
  refundIds: string[];
  status: PaymentStatus;
  amount: number;
  currency: string;
  authorizedAmount?: number;
  capturedAmount?: number;
  refundedAmount?: number;
  description?: string;
  approvalUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StagedSettlement {
  settlementId: string;
  paymentId: string;
  authorizedAmount: string;
  creditAmount: string;
  captureAmount: string;
  currency: string;
  decision: 'APPROVED' | 'AUTO_APPROVED' | 'REJECTED';
  approvedBy?: string;
}

// --- SLA & Monitoring Types (Person 2 & 3) ---
export interface SLACommitment {
  id: string;
  metric: 'uptime_percent' | 'p95_latency_ms' | string;
  operator: '>=' | '>' | '<=' | '<';
  threshold: number;
  confidence: number;
}

export interface SLACreditRule {
  commitmentId: string;
  ifBelow?: number | null;
  ifAbove?: number | null;
  creditPercent: number;
  confidence: number;
}

export interface ServiceMetricRecord {
  serviceId: string;
  timestamp: string;
  uptime: number;
  responseTime: number;
  status: 'UP' | 'DOWN' | 'DEGRADED';
}

// --- Settlement & Approval Types (Person 3 & 4) ---
export type SettlementStatus =
  | 'Draft'
  | 'Calculated'
  | 'RequiresReview'
  | 'Approved'
  | 'Rejected'
  | 'Blocked'
  | 'ReadyForPayment'
  | 'PaymentPending'
  | 'Paid'
  | 'Failed';

export interface CalculationBreakdownItem {
  ruleId: string;
  ruleDescription: string;
  breachId: string;
  metric: string;
  contractualThreshold: number;
  observedValue: number;
  creditType: 'FIXED' | 'PERCENTAGE';
  creditValue: string | number;
  creditAmountCalculated: string | number;
  applied: boolean;
  reason: string;
}

export interface SettlementDTO {
  _id: string;
  paymentId: string;
  serviceId: string;
  contractId: string;
  breachIds: string[];
  authorizedAmount: string | number;
  totalCredit: string | number;
  finalPayableAmount: string | number;
  currency: string;
  calculationBreakdown: CalculationBreakdownItem[];
  calculationVersion: string;
  contractVersion: number;
  status: SettlementStatus;
  requiresReviewReason?: string;
  calculatedAt: string;
}

export interface ApprovalDTO {
  _id: string;
  settlementId: string;
  policyDecisionId: string;
  approvalStatus: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  requestedAt: string;
  reviewedAt?: string;
  reviewerId?: string;
  reviewerName?: string;
  comments?: string;
}

export interface AuditLogDTO {
  _id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  settlementId?: string;
  actorId: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
