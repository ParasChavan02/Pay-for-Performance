import { env } from '../../config/env';

export interface PaymentAuthorization {
  paymentId: string;
  serviceId?: string;
  contractId?: string;
  /** Authorized amount as a decimal string, e.g. '1500.00' */
  authorizedAmount: string;
  /** ISO 4217 currency code, e.g. 'USD' */
  currency: string;
  authorizedAt: Date;
  paymentStatus: 'AUTHORIZED' | 'EXPIRED' | 'CANCELLED' | 'CAPTURED' | 'APPROVAL_PENDING';
}

export interface CaptureResult {
  success: boolean;
  captureId?: string;
  capturedAmount?: number;
  status?: string;
  error?: string;
}

export class PaymentAuthorizationAdapter {
  private static readonly mockStore = new Map<string, PaymentAuthorization>();

  /** Register a mock authorization (dev / test only) */
  static register(auth: PaymentAuthorization): void {
    PaymentAuthorizationAdapter.mockStore.set(auth.paymentId, auth);
  }

  /** Look up a payment authorization by paymentId */
  static async lookup(paymentId: string): Promise<PaymentAuthorization | null> {
    // 1. Check in-memory store (for unit tests)
    const mocked = PaymentAuthorizationAdapter.mockStore.get(paymentId);
    if (mocked) return mocked;

    // 2. Query Person 1's Payment Service over HTTP
    try {
      const response = await fetch(`${env.PAYMENT_SERVICE_URL}/payments/${paymentId}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': env.INTERNAL_API_TOKEN,
        },
      });

      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as any;
      if (!json.success || !json.data?.payment) {
        return null;
      }

      const p = json.data.payment;
      return {
        paymentId: p.id,
        serviceId: p.metadata?.serviceId,
        contractId: p.metadata?.contractId,
        authorizedAmount: Number(p.authorizedAmount).toFixed(2),
        currency: p.currency || 'USD',
        authorizedAt: new Date(p.createdAt),
        paymentStatus: p.status === 'AUTHORIZED' ? 'AUTHORIZED' : p.status,
      };
    } catch {
      // In offline / unit test mode, return null
      return null;
    }
  }

  /** Stage an approved SLA Settlement in Person 1's payment engine */
  static async stageSettlement(params: {
    settlementId: string;
    paymentId: string;
    authorizedAmount: string;
    creditAmount: string;
    captureAmount: string;
    currency: string;
    decision: 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW';
    approvedBy: string;
  }): Promise<boolean> {
    try {
      const response = await fetch(`${env.PAYMENT_SERVICE_URL}/settlements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': env.INTERNAL_API_TOKEN,
        },
        body: JSON.stringify(params),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Execute PayPal Capture for an approved settlement */
  static async executeCapture(
    paymentId: string,
    settlementId: string
  ): Promise<CaptureResult> {
    try {
      const response = await fetch(`${env.PAYMENT_SERVICE_URL}/payments/${paymentId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `capture-${settlementId}`,
          'X-Internal-Token': env.INTERNAL_API_TOKEN,
        },
        body: JSON.stringify({ settlementId }),
      });

      const json = (await response.json()) as any;
      if (!response.ok || !json.success) {
        return {
          success: false,
          error: json.message || json.error || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        captureId: json.data?.capture?.paypalCaptureId,
        capturedAmount: json.data?.capture?.amount,
        status: json.data?.capture?.status,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Payment capture network error',
      };
    }
  }

  /** Clear mock store (useful in tests) */
  static clearAll(): void {
    PaymentAuthorizationAdapter.mockStore.clear();
  }
}
