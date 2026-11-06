// Payment Authorization Adapter
// Provides a mock in-memory store for dev/test.
// Person 1 will replace `lookup` with a real PayPal/payment-gateway adapter.

export interface PaymentAuthorization {
  paymentId: string;
  serviceId: string;
  contractId: string;
  /** Authorized amount as a decimal string, e.g. '1500.00' */
  authorizedAmount: string;
  /** ISO 4217 currency code, e.g. 'USD' */
  currency: string;
  authorizedAt: Date;
  paymentStatus: 'AUTHORIZED' | 'EXPIRED' | 'CANCELLED' | 'CAPTURED';
}

export class PaymentAuthorizationAdapter {
  private static readonly mockStore = new Map<string, PaymentAuthorization>();

  /** Register a mock authorization (dev / test only) */
  static register(auth: PaymentAuthorization): void {
    PaymentAuthorizationAdapter.mockStore.set(auth.paymentId, auth);
  }

  /** Look up a payment authorization by paymentId */
  static async lookup(paymentId: string): Promise<PaymentAuthorization | null> {
    return PaymentAuthorizationAdapter.mockStore.get(paymentId) ?? null;
  }

  /** Clear mock store (useful in tests) */
  static clearAll(): void {
    PaymentAuthorizationAdapter.mockStore.clear();
  }
}

