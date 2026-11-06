import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { createApp } from '../src/app.js';
import { db } from '../src/repositories/database.js';
import { paypalService } from '../src/services/paypal-service.js';

describe('HTTP API Endpoints Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    db.clearAll();
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /api/health returns healthy status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.status, 'healthy');
  });

  it('POST /api/payments/create-order creates order with valid validation', async () => {
    const originalCreate = paypalService.createOrder;
    paypalService.createOrder = async () => ({
      orderId: 'ORDER-API-100',
      approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-API-100',
      rawResponse: { id: 'ORDER-API-100' } as any,
    });

    try {
      const res = await fetch(`${baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 100.0,
          currency: 'USD',
          description: 'SLA API Test Order',
        }),
      });

      const body = (await res.json()) as any;

      assert.strictEqual(res.status, 201);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.amount, 100.0);
      assert.strictEqual(body.data.orderId, 'ORDER-API-100');
    } finally {
      paypalService.createOrder = originalCreate;
    }
  });

  it('POST /api/payments/create-order rejects negative or zero amount', async () => {
    const res = await fetch(`${baseUrl}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: -50.0,
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
  });

  it('End-to-End SLA Flow: Create -> Authorize -> Stage Settlement -> Capture -> Status', async () => {
    // 1. Create Order
    const originalCreate = paypalService.createOrder;
    paypalService.createOrder = async () => ({
      orderId: 'ORDER-FLOW-100',
      approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-FLOW-100',
      rawResponse: { id: 'ORDER-FLOW-100' } as any,
    });

    let paymentId: string = '';
    try {
      const createRes = await fetch(`${baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100.0, currency: 'USD' }),
      });
      const createBody = (await createRes.json()) as any;
      paymentId = createBody.data.paymentId;
      assert.ok(paymentId);
    } finally {
      paypalService.createOrder = originalCreate;
    }

    // 2. Authorize Order
    const originalAuth = paypalService.authorizeOrder;
    paypalService.authorizeOrder = async () => ({
      authorizationId: 'AUTH-FLOW-100',
      status: 'CREATED',
      authorizedAmount: 100.0,
      currency: 'USD',
      rawResponse: {} as any,
    });

    try {
      const authRes = await fetch(`${baseUrl}/api/payments/ORDER-FLOW-100/authorize`, {
        method: 'POST',
      });
      const authBody = (await authRes.json()) as any;
      assert.strictEqual(authRes.status, 200);
      assert.strictEqual(authBody.data.authorizationId, 'AUTH-FLOW-100');
    } finally {
      paypalService.authorizeOrder = originalAuth;
    }

    // 3. Stage Person 3 SLA Settlement
    const stageRes = await fetch(`${baseUrl}/api/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settlementId: 'SET-FLOW-001',
        paymentId,
        authorizedAmount: '100.00',
        creditAmount: '25.00',
        captureAmount: '75.00',
        currency: 'USD',
        decision: 'APPROVED',
        approvedBy: 'sla-engine-person-3',
      }),
    });
    const stageBody = (await stageRes.json()) as any;
    assert.strictEqual(stageRes.status, 201);
    assert.strictEqual(stageBody.data.settlementId, 'SET-FLOW-001');

    // 4. Capture Approved $75 Settlement
    const originalCapture = paypalService.captureAuthorization;
    paypalService.captureAuthorization = async () => ({
      captureId: 'CAP-FLOW-75',
      status: 'COMPLETED',
      capturedAmount: 75.0,
      currency: 'USD',
      finalCapture: true,
      rawResponse: {} as any,
    });

    try {
      const capRes = await fetch(`${baseUrl}/api/payments/${paymentId}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settlementId: 'SET-FLOW-001' }),
      });
      const capBody = (await capRes.json()) as any;
      assert.strictEqual(capRes.status, 200);
      assert.strictEqual(capBody.data.payment.capturedAmount, 75.0);
      assert.strictEqual(capBody.data.payment.status, 'CAPTURED');
      assert.strictEqual(capBody.data.settlement.status, 'EXECUTED');
    } finally {
      paypalService.captureAuthorization = originalCapture;
    }

    // 5. Query Payment Details
    const detailsRes = await fetch(`${baseUrl}/api/payments/${paymentId}`);
    const detailsBody = (await detailsRes.json()) as any;
    assert.strictEqual(detailsRes.status, 200);
    assert.strictEqual(detailsBody.data.payment.id, paymentId);
    assert.strictEqual(detailsBody.data.captures.length, 1);
    assert.strictEqual(detailsBody.data.captures[0].amount, 75.0);
    assert.strictEqual(detailsBody.data.settlements.length, 1);
    assert.strictEqual(detailsBody.data.auditLogs.length >= 3, true);
  });
});
