import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { Database } from '../src/repositories/database.js';
import { PaymentService } from '../src/services/payment-service.js';
import { paypalService } from '../src/services/paypal-service.js';

describe('Pay-for-Performance PayPal Lifecycle & SLA Settlement Tests', () => {
  let testDb: Database;
  let paymentService: PaymentService;

  beforeEach(() => {
    // Isolated in-memory/test database
    testDb = new Database(path.resolve(process.cwd(), './data/test_db.json'));
    testDb.clearAll();

    paymentService = new PaymentService(testDb);
  });

  it('1. Create a $100 payment order with intent=AUTHORIZE', async () => {
    // Stub PayPal order creation
    const originalCreate = paypalService.createOrder;
    paypalService.createOrder = async () => ({
      orderId: 'ORDER-100-TEST',
      approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-100-TEST',
      rawResponse: {
        id: 'ORDER-100-TEST',
        intent: 'AUTHORIZE',
        status: 'CREATED',
        links: [
          {
            href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-100-TEST',
            rel: 'approve',
            method: 'GET',
          },
        ],
      },
    });

    try {
      const result = await paymentService.createPaymentOrder({
        amount: 100.0,
        currency: 'USD',
        description: 'SLA Contract #SC-2024-001',
      });

      assert.strictEqual(result.amount, 100.0);
      assert.strictEqual(result.currency, 'USD');
      assert.strictEqual(result.orderId, 'ORDER-100-TEST');
      assert.strictEqual(result.status, 'APPROVAL_PENDING');
      assert.ok(result.approvalUrl.includes('ORDER-100-TEST'));
    } finally {
      paypalService.createOrder = originalCreate;
    }
  });

  it('2. Authorize the $100 order after buyer approval', async () => {
    // Setup order in test DB
    const payment = testDb.createPayment({
      id: 'PAY-DEMO-001',
      orderId: 'ORDER-DEMO-001',
      status: 'APPROVAL_PENDING',
      authorizedAmount: 100.0,
      capturedAmount: 0,
      refundedAmount: 0,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const originalAuth = paypalService.authorizeOrder;
    paypalService.authorizeOrder = async () => ({
      authorizationId: 'AUTH-DEMO-001',
      status: 'CREATED',
      authorizedAmount: 100.0,
      currency: 'USD',
      rawResponse: {
        id: 'ORDER-DEMO-001',
        status: 'COMPLETED',
        purchase_units: [
          {
            payments: {
              authorizations: [
                {
                  id: 'AUTH-DEMO-001',
                  status: 'CREATED',
                  amount: { currency_code: 'USD', value: '100.00' },
                },
              ],
            },
          },
        ],
      },
    });

    try {
      const authorized = await paymentService.authorizePayment('ORDER-DEMO-001');

      assert.strictEqual(authorized.status, 'AUTHORIZED');
      assert.strictEqual(authorized.authorizationId, 'AUTH-DEMO-001');
      assert.strictEqual(authorized.authorizedAmount, 100.0);
    } finally {
      paypalService.authorizeOrder = originalAuth;
    }
  });

  it('3. Core SLA Demo: Authorize $100 → $25 SLA Credit → Capture $75 approved settlement', async () => {
    // 1. Setup authorized payment
    testDb.createPayment({
      id: 'PAY-001',
      orderId: 'ORDER-001',
      authorizationId: 'AUTH-001',
      status: 'AUTHORIZED',
      authorizedAmount: 100.0,
      capturedAmount: 0,
      refundedAmount: 0,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Stage Person 3 SLA Settlement
    testDb.createOrUpdateSettlement({
      settlementId: 'SET-001',
      paymentId: 'PAY-001',
      authorizedAmount: '100.00',
      creditAmount: '25.00',
      captureAmount: '75.00',
      currency: 'USD',
      decision: 'APPROVED',
      approvedBy: 'user-id',
      status: 'STAGED',
      createdAt: new Date().toISOString(),
    });

    // 3. Stub PayPal Capture
    const originalCapture = paypalService.captureAuthorization;
    let capturedParams: any = null;
    paypalService.captureAuthorization = async (params) => {
      capturedParams = params;
      return {
        captureId: 'CAP-PAYPAL-75',
        status: 'COMPLETED',
        capturedAmount: 75.0,
        currency: 'USD',
        finalCapture: true,
        rawResponse: {
          id: 'CAP-PAYPAL-75',
          status: 'COMPLETED',
          amount: { currency_code: 'USD', value: '75.00' },
          final_capture: true,
        },
      };
    };

    try {
      const result = await paymentService.capturePaymentBySettlement({
        paymentId: 'PAY-001',
        settlementId: 'SET-001',
      });

      // Verify capture parameters sent to PayPal
      assert.strictEqual(capturedParams.amount, 75.0);
      assert.strictEqual(capturedParams.currency, 'USD');
      assert.strictEqual(capturedParams.finalCapture, true);

      // Verify returned objects
      assert.strictEqual(result.payment.capturedAmount, 75.0);
      assert.strictEqual(result.payment.status, 'CAPTURED');
      assert.strictEqual(result.settlement.status, 'EXECUTED');
      assert.strictEqual(result.capture.paypalCaptureId, 'CAP-PAYPAL-75');
      assert.strictEqual(result.capture.amount, 75.0);
    } finally {
      paypalService.captureAuthorization = originalCapture;
    }
  });

  it('4. Reject duplicate settlement execution', async () => {
    testDb.createPayment({
      id: 'PAY-002',
      authorizationId: 'AUTH-002',
      status: 'CAPTURED',
      authorizedAmount: 100.0,
      capturedAmount: 75.0,
      refundedAmount: 0,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Settlement already EXECUTED
    testDb.createOrUpdateSettlement({
      settlementId: 'SET-002',
      paymentId: 'PAY-002',
      authorizedAmount: '100.00',
      creditAmount: '25.00',
      captureAmount: '75.00',
      currency: 'USD',
      decision: 'APPROVED',
      approvedBy: 'user-id',
      status: 'EXECUTED',
      createdAt: new Date().toISOString(),
      executedAt: new Date().toISOString(),
    });

    await assert.rejects(
      async () => {
        await paymentService.capturePaymentBySettlement({
          paymentId: 'PAY-002',
          settlementId: 'SET-002',
        });
      },
      {
        message: /already been executed/,
      }
    );
  });

  it('5. Reject capture when settlement decision is REJECTED', async () => {
    testDb.createPayment({
      id: 'PAY-003',
      authorizationId: 'AUTH-003',
      status: 'AUTHORIZED',
      authorizedAmount: 100.0,
      capturedAmount: 0,
      refundedAmount: 0,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    testDb.createOrUpdateSettlement({
      settlementId: 'SET-003',
      paymentId: 'PAY-003',
      authorizedAmount: '100.00',
      creditAmount: '50.00',
      captureAmount: '50.00',
      currency: 'USD',
      decision: 'REJECTED',
      approvedBy: 'audit-team',
      status: 'STAGED',
      createdAt: new Date().toISOString(),
    });

    await assert.rejects(
      async () => {
        await paymentService.capturePaymentBySettlement({
          paymentId: 'PAY-003',
          settlementId: 'SET-003',
        });
      },
      {
        message: /Only 'APPROVED' settlements can be captured/,
      }
    );
  });

  it('6. Reject invalid capture amount exceeding remaining authorized balance', async () => {
    testDb.createPayment({
      id: 'PAY-004',
      authorizationId: 'AUTH-004',
      status: 'AUTHORIZED',
      authorizedAmount: 100.0,
      capturedAmount: 0,
      refundedAmount: 0,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Settlement with captureAmount $120 > $100
    testDb.createOrUpdateSettlement({
      settlementId: 'SET-004',
      paymentId: 'PAY-004',
      authorizedAmount: '100.00',
      creditAmount: '0.00',
      captureAmount: '120.00',
      currency: 'USD',
      decision: 'APPROVED',
      approvedBy: 'user-id',
      status: 'STAGED',
      createdAt: new Date().toISOString(),
    });

    await assert.rejects(
      async () => {
        await paymentService.capturePaymentBySettlement({
          paymentId: 'PAY-004',
          settlementId: 'SET-004',
        });
      },
      {
        message: /exceeds remaining authorized balance/,
      }
    );
  });

  it('7. Partial refund on a captured payment', async () => {
    testDb.createPayment({
      id: 'PAY-REFUND-001',
      authorizationId: 'AUTH-REFUND-001',
      status: 'CAPTURED',
      authorizedAmount: 100.0,
      capturedAmount: 100.0,
      refundedAmount: 0,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    testDb.createCapture({
      id: 'CAP-RECORD-001',
      paymentId: 'PAY-REFUND-001',
      paypalCaptureId: 'PAYPAL-CAP-100',
      paypalAuthorizationId: 'AUTH-REFUND-001',
      amount: 100.0,
      currency: 'USD',
      status: 'COMPLETED',
      finalCapture: true,
      createdAt: new Date().toISOString(),
    });

    const originalRefund = paypalService.refundCapture;
    let refundedParams: any = null;
    paypalService.refundCapture = async (params) => {
      refundedParams = params;
      return {
        refundId: 'REF-PAYPAL-25',
        status: 'COMPLETED',
        refundedAmount: 25.0,
        currency: 'USD',
        rawResponse: {
          id: 'REF-PAYPAL-25',
          status: 'COMPLETED',
          amount: { currency_code: 'USD', value: '25.00' },
        },
      };
    };

    try {
      const result = await paymentService.refundPayment({
        paymentId: 'PAY-REFUND-001',
        captureId: 'PAYPAL-CAP-100',
        amount: 25.0,
        reason: 'SLA post-settlement credit adjustment',
      });

      assert.strictEqual(refundedParams.amount, 25.0);
      assert.strictEqual(result.payment.refundedAmount, 25.0);
      assert.strictEqual(result.payment.status, 'PARTIALLY_REFUNDED');
      assert.strictEqual(result.refund.paypalRefundId, 'REF-PAYPAL-25');
      assert.strictEqual(result.refund.amount, 25.0);
    } finally {
      paypalService.refundCapture = originalRefund;
    }
  });

  it('8. Reject refund exceeding remaining refundable capture amount', async () => {
    testDb.createPayment({
      id: 'PAY-REFUND-002',
      status: 'CAPTURED',
      authorizedAmount: 100.0,
      capturedAmount: 75.0,
      refundedAmount: 50.0,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    testDb.createCapture({
      id: 'CAP-RECORD-002',
      paymentId: 'PAY-REFUND-002',
      paypalCaptureId: 'PAYPAL-CAP-75',
      paypalAuthorizationId: 'AUTH-002',
      amount: 75.0,
      currency: 'USD',
      status: 'COMPLETED',
      finalCapture: true,
      createdAt: new Date().toISOString(),
    });

    // Record prior $50 refund
    testDb.createRefund({
      id: 'REF-001',
      paymentId: 'PAY-REFUND-002',
      paypalCaptureId: 'PAYPAL-CAP-75',
      paypalRefundId: 'REF-PAYPAL-50',
      amount: 50.0,
      currency: 'USD',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    });

    // Attempting to refund $30 when only $25 remains ($75 - $50 = $25)
    await assert.rejects(
      async () => {
        await paymentService.refundPayment({
          paymentId: 'PAY-REFUND-002',
          captureId: 'PAYPAL-CAP-75',
          amount: 30.0,
        });
      },
      {
        message: /exceeds remaining refundable capture amount/,
      }
    );
  });
});
