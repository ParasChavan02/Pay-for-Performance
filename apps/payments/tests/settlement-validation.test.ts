import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { Database } from '../src/repositories/database.js';
import { PaymentService } from '../src/services/payment-service.js';

describe('Person 3 SLA Settlement Contract & Idempotency Tests', () => {
  let testDb: Database;
  let paymentService: PaymentService;

  beforeEach(() => {
    testDb = new Database(path.resolve(process.cwd(), './data/test_settlement_db.json'));
    testDb.clearAll();
    paymentService = new PaymentService(testDb);
  });

  it('Verifies contract format: 100 authorized - 25 credit = 75 capture', () => {
    const settlement = {
      settlementId: 'SET-001',
      paymentId: 'PAY-001',
      authorizedAmount: '100.00',
      creditAmount: '25.00',
      captureAmount: '75.00',
      currency: 'USD',
      decision: 'APPROVED' as const,
      approvedBy: 'user-id',
    };

    const auth = parseFloat(settlement.authorizedAmount);
    const credit = parseFloat(settlement.creditAmount);
    const capture = parseFloat(settlement.captureAmount);

    assert.strictEqual(auth - credit, capture);
    assert.strictEqual(settlement.decision, 'APPROVED');
  });

  it('Acquires and completes idempotency keys properly', () => {
    const key = 'test-idempotency-key-001';
    const hash = 'hash-123';

    // First attempt: ACQUIRED
    const first = testDb.acquireIdempotencyKey(key, 'CAPTURE', hash);
    assert.strictEqual(first.status, 'ACQUIRED');

    // Second simultaneous attempt while in flight: IN_FLIGHT
    const second = testDb.acquireIdempotencyKey(key, 'CAPTURE', hash);
    assert.strictEqual(second.status, 'IN_FLIGHT');

    // Complete the key
    testDb.completeIdempotencyKey(key, 200, { success: true, captureId: 'CAP-123' });

    // Third attempt after completion: REPLAY
    const third = testDb.acquireIdempotencyKey(key, 'CAPTURE', hash);
    assert.strictEqual(third.status, 'REPLAY');
    assert.strictEqual(third.record?.responseStatusCode, 200);
    assert.strictEqual(third.record?.responseBody.captureId, 'CAP-123');
  });

  it('Releases failed idempotency key to allow retry', () => {
    const key = 'test-retry-key';
    const hash = 'hash-456';

    const first = testDb.acquireIdempotencyKey(key, 'CAPTURE', hash);
    assert.strictEqual(first.status, 'ACQUIRED');

    // Simulate network error causing release
    testDb.releaseOrFailIdempotencyKey(key);

    // Key can now be reacquired
    const retry = testDb.acquireIdempotencyKey(key, 'CAPTURE', hash);
    assert.strictEqual(retry.status, 'ACQUIRED');
  });
});
