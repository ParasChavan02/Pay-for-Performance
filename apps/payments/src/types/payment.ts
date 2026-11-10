export type PaymentStatus =
  | 'CREATED'
  | 'APPROVAL_PENDING'
  | 'AUTHORIZED'
  | 'PARTIALLY_CAPTURED'
  | 'CAPTURED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'VOIDED'
  | 'FAILED';

export type SettlementDecision = 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW';

export type SettlementStatus = 'STAGED' | 'EXECUTED' | 'CANCELLED';

export interface PaymentRecord {
  id: string;
  orderId?: string;
  authorizationId?: string;
  status: PaymentStatus;
  authorizedAmount: number;
  capturedAmount: number;
  refundedAmount: number;
  currency: string;
  description?: string;
  approvalUrl?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Internal contract with Person 3 (SLA calculation and policy engine teammate)
 */
export interface SettlementContract {
  settlementId: string;
  paymentId: string;
  authorizedAmount: string; // e.g. "100.00"
  creditAmount: string;     // e.g. "25.00"
  captureAmount: string;    // e.g. "75.00"
  currency: string;         // e.g. "USD"
  decision: SettlementDecision; // "APPROVED"
  approvedBy: string;       // e.g. "user-id"
}

export interface SettlementRecord extends SettlementContract {
  status: SettlementStatus;
  createdAt: string;
  executedAt?: string;
}

export interface CaptureRecord {
  id: string;
  paymentId: string;
  settlementId?: string;
  paypalCaptureId: string;
  paypalAuthorizationId: string;
  amount: number;
  currency: string;
  status: string; // COMPLETED, PENDING, DECLINED, etc.
  finalCapture: boolean;
  idempotencyKey?: string;
  rawResponse?: Record<string, any>;
  createdAt: string;
}

export interface RefundRecord {
  id: string;
  paymentId: string;
  paypalCaptureId: string;
  paypalRefundId: string;
  amount: number;
  currency: string;
  status: string; // COMPLETED, PENDING, etc.
  reason?: string;
  idempotencyKey?: string;
  rawResponse?: Record<string, any>;
  createdAt: string;
}

export interface IdempotencyRecord {
  key: string;
  targetType: 'CAPTURE' | 'REFUND' | 'CREATE_ORDER' | 'AUTHORIZE';
  requestHash: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  responseStatusCode?: number;
  responseBody?: any;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  paymentId?: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}
