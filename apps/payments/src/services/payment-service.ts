import { v4 as uuidv4 } from 'uuid';
import { db as defaultDb, Database } from '../repositories/database.js';
import { paypalService, PayPalService } from './paypal-service.js';
import {
  PaymentRecord,
  SettlementRecord,
  CaptureRecord,
  RefundRecord,
} from '../types/payment.js';
import { PayPalApiError } from './paypal-client.js';

export class PaymentService {
  private db: Database;
  private paypal: PayPalService;

  constructor(database: Database = defaultDb, paypal: PayPalService = paypalService) {
    this.db = database;
    this.paypal = paypal;
  }
  /**
   * 1. Create a Payment Order
   */
  public async createPaymentOrder(params: {
    amount: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, any>;
    idempotencyKey?: string;
  }): Promise<{
    paymentId: string;
    orderId: string;
    approvalUrl: string;
    amount: number;
    currency: string;
    status: string;
  }> {
    const currency = (params.currency || 'USD').toUpperCase();
    const amount = Number(params.amount.toFixed(2));

    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const paymentId = `PAY-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create order with PayPal
    const paypalResult = await this.paypal.createOrder({
      amount,
      currency,
      description: params.description || `SLA Contract Payment ${paymentId}`,
      customId: paymentId,
      requestId: params.idempotencyKey,
    });

    // Save payment record in DB
    const now = new Date().toISOString();
    const paymentRecord: PaymentRecord = {
      id: paymentId,
      orderId: paypalResult.orderId,
      status: 'APPROVAL_PENDING',
      authorizedAmount: amount,
      capturedAmount: 0,
      refundedAmount: 0,
      currency,
      description: params.description,
      approvalUrl: paypalResult.approvalUrl,
      metadata: params.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    this.db.createPayment(paymentRecord);

    this.db.addAuditLog(
      'ORDER_CREATED',
      {
        paymentId,
        orderId: paypalResult.orderId,
        amount,
        currency,
        approvalUrl: paypalResult.approvalUrl,
      },
      paymentId
    );

    return {
      paymentId,
      orderId: paypalResult.orderId,
      approvalUrl: paypalResult.approvalUrl,
      amount,
      currency,
      status: paymentRecord.status,
    };
  }

  /**
   * 2. Authorize an approved Order
   */
  public async authorizePayment(
    orderId: string,
    idempotencyKey?: string
  ): Promise<PaymentRecord> {
    const payment = this.db.getPaymentByOrderId(orderId);
    if (!payment) {
      throw new Error(`Payment associated with order ID ${orderId} was not found.`);
    }

    if (payment.status === 'AUTHORIZED' && payment.authorizationId) {
      // Already authorized, return existing state
      return payment;
    }

    if (payment.status !== 'APPROVAL_PENDING' && payment.status !== 'CREATED') {
      throw new Error(
        `Cannot authorize payment ${payment.id}: current status is '${payment.status}'. Expected 'APPROVAL_PENDING'.`
      );
    }

    // Call PayPal to authorize the approved order
    const authResult = await this.paypal.authorizeOrder(orderId, idempotencyKey);

    const updatedPayment = this.db.updatePayment(payment.id, {
      authorizationId: authResult.authorizationId,
      status: 'AUTHORIZED',
      authorizedAmount: authResult.authorizedAmount,
      currency: authResult.currency,
    });

    this.db.addAuditLog(
      'ORDER_AUTHORIZED',
      {
        orderId,
        authorizationId: authResult.authorizationId,
        authorizedAmount: authResult.authorizedAmount,
        currency: authResult.currency,
        status: authResult.status,
      },
      payment.id
    );

    return updatedPayment;
  }

  /**
   * 3. Capture an Authorized Payment based on a verified Person 3 SLA Settlement
   */
  public async capturePaymentBySettlement(params: {
    paymentId: string;
    settlementId: string;
    idempotencyKey?: string;
  }): Promise<{
    payment: PaymentRecord;
    settlement: SettlementRecord;
    capture: CaptureRecord;
  }> {
    const { paymentId, settlementId } = params;

    // Use settlementId or provided idempotencyKey for database-level idempotency
    const lockKey = params.idempotencyKey || `capture:${paymentId}:${settlementId}`;
    const idempotency = this.db.acquireIdempotencyKey(lockKey, 'CAPTURE', JSON.stringify(params));

    if (idempotency.status === 'REPLAY') {
      // Duplicate request: return stored result
      return idempotency.record!.responseBody;
    }

    if (idempotency.status === 'IN_FLIGHT') {
      throw new Error(
        `Settlement capture for ${settlementId} is currently being processed. Duplicate request prevented.`
      );
    }

    try {
      // 1. Retrieve and validate Person 3's SLA Settlement first
      const settlement = this.db.getSettlementById(settlementId);
      if (!settlement) {
        throw new Error(
          `Approved SLA Settlement ${settlementId} not found. Capture requires a valid staged settlement from Person 3.`
        );
      }

      if (settlement.status === 'EXECUTED') {
        throw new Error(
          `Settlement ${settlementId} has already been executed. Rejecting duplicate settlement execution.`
        );
      }

      if (settlement.decision !== 'APPROVED') {
        throw new Error(
          `Settlement ${settlementId} has decision '${settlement.decision}'. Only 'APPROVED' settlements can be captured.`
        );
      }

      if (settlement.paymentId !== paymentId) {
        throw new Error(
          `Settlement ${settlementId} paymentId mismatch. Belongs to '${settlement.paymentId}', expected '${paymentId}'.`
        );
      }

      // 2. Retrieve and validate the Payment from the database
      const payment = this.db.getPaymentById(paymentId);
      if (!payment) {
        throw new Error(`Payment ${paymentId} not found.`);
      }

      if (!payment.authorizationId) {
        throw new Error(
          `Payment ${paymentId} has not been authorized yet. Cannot capture funds.`
        );
      }

      if (payment.status !== 'AUTHORIZED' && payment.status !== 'PARTIALLY_CAPTURED') {
        throw new Error(
          `Payment ${paymentId} is in status '${payment.status}'. Capture requires 'AUTHORIZED' or 'PARTIALLY_CAPTURED'.`
        );
      }

      // 3. Amount and Balance Verification
      const captureAmount = parseFloat(settlement.captureAmount);
      const authorizedAmount = parseFloat(settlement.authorizedAmount);

      if (isNaN(captureAmount) || captureAmount <= 0) {
        throw new Error(`Capture amount must be greater than zero. Received: '${settlement.captureAmount}'`);
      }

      const remainingAuthorized = Number((payment.authorizedAmount - payment.capturedAmount).toFixed(2));
      if (captureAmount > remainingAuthorized) {
        throw new Error(
          `Capture amount $${captureAmount.toFixed(2)} exceeds remaining authorized balance $${remainingAuthorized.toFixed(2)}.`
        );
      }

      // In SLA settlements, capturing the approved amount finalizes the transaction
      // and closes the authorization so the remaining SLA credit is released back to the buyer.
      const finalCapture = true;

      // 4. Execute Capture via PayPal Payments API v2
      const captureResult = await this.paypal.captureAuthorization({
        authorizationId: payment.authorizationId,
        amount: captureAmount,
        currency: settlement.currency || payment.currency,
        finalCapture,
        noteToPayer: `SLA Settlement ${settlementId}: Authorized $${authorizedAmount.toFixed(2)}, SLA Credit $${settlement.creditAmount}, Captured $${captureAmount.toFixed(2)}`,
        requestId: lockKey,
      });

      // 5. Persist Capture Record
      const captureRecord: CaptureRecord = {
        id: `CAP-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`,
        paymentId,
        settlementId,
        paypalCaptureId: captureResult.captureId,
        paypalAuthorizationId: payment.authorizationId,
        amount: captureResult.capturedAmount,
        currency: captureResult.currency,
        status: captureResult.status,
        finalCapture: captureResult.finalCapture,
        idempotencyKey: lockKey,
        rawResponse: captureResult.rawResponse,
        createdAt: new Date().toISOString(),
      };
      this.db.createCapture(captureRecord);

      // 6. Update Payment Record
      const newCapturedAmount = Number((payment.capturedAmount + captureResult.capturedAmount).toFixed(2));
      const newStatus = finalCapture ? 'CAPTURED' : 'PARTIALLY_CAPTURED';

      const updatedPayment = this.db.updatePayment(payment.id, {
        capturedAmount: newCapturedAmount,
        status: newStatus,
      });

      // 7. Update Settlement Record
      settlement.status = 'EXECUTED';
      settlement.executedAt = new Date().toISOString();
      this.db.createOrUpdateSettlement(settlement);

      // 8. Audit Log
      this.db.addAuditLog(
        'PAYMENT_CAPTURED',
        {
          paymentId,
          settlementId,
          captureId: captureResult.captureId,
          capturedAmount: captureResult.capturedAmount,
          currency: captureResult.currency,
          finalCapture,
          status: captureResult.status,
        },
        paymentId
      );

      const responsePayload = {
        payment: updatedPayment,
        settlement,
        capture: captureRecord,
      };

      // 9. Complete Idempotency
      this.db.completeIdempotencyKey(lockKey, 200, responsePayload);

      return responsePayload;
    } catch (err: any) {
      this.db.releaseOrFailIdempotencyKey(lockKey);
      this.db.addAuditLog(
        'CAPTURE_FAILED',
        {
          paymentId,
          settlementId,
          error: err.message,
        },
        paymentId
      );
      throw err;
    }
  }

  /**
   * 4. Refund a Captured Payment (Partial or Full)
   */
  public async refundPayment(params: {
    paymentId: string;
    captureId?: string; // Internal capture ID or PayPal capture ID
    amount: number;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<{
    payment: PaymentRecord;
    refund: RefundRecord;
  }> {
    const { paymentId, amount, reason } = params;

    if (isNaN(amount) || amount <= 0) {
      throw new Error(`Refund amount must be a positive number. Received: ${amount}`);
    }

    const lockKey = params.idempotencyKey || `refund:${paymentId}:${amount}:${Date.now()}`;
    const idempotency = this.db.acquireIdempotencyKey(lockKey, 'REFUND', JSON.stringify(params));

    if (idempotency.status === 'REPLAY') {
      return idempotency.record!.responseBody;
    }

    if (idempotency.status === 'IN_FLIGHT') {
      throw new Error(`Refund request is currently being processed.`);
    }

    try {
      const payment = this.db.getPaymentById(paymentId);
      if (!payment) {
        throw new Error(`Payment ${paymentId} not found.`);
      }

      if (payment.capturedAmount <= 0) {
        throw new Error(`Payment ${paymentId} has no captured funds available to refund.`);
      }

      // Find capture to refund from
      const captures = this.db.getCapturesByPaymentId(paymentId);
      if (captures.length === 0) {
        throw new Error(`No captures found for payment ${paymentId}.`);
      }

      let targetCapture: CaptureRecord | undefined;
      if (params.captureId) {
        targetCapture = captures.find(
          (c) => c.id === params.captureId || c.paypalCaptureId === params.captureId
        );
        if (!targetCapture) {
          throw new Error(`Capture ${params.captureId} does not belong to payment ${paymentId}.`);
        }
      } else {
        // Default to latest capture
        targetCapture = captures[captures.length - 1];
      }

      // Check existing refunds for this capture
      const existingRefunds = this.db.getRefundsByCaptureId(targetCapture.paypalCaptureId);
      const totalRefundedOnCapture = existingRefunds.reduce((sum, r) => sum + r.amount, 0);
      const remainingRefundableOnCapture = Number(
        (targetCapture.amount - totalRefundedOnCapture).toFixed(2)
      );

      if (amount > remainingRefundableOnCapture) {
        throw new Error(
          `Refund amount $${amount.toFixed(2)} exceeds remaining refundable capture amount $${remainingRefundableOnCapture.toFixed(2)}.`
        );
      }

      // Execute refund via PayPal Payments API v2
      const refundResult = await this.paypal.refundCapture({
        captureId: targetCapture.paypalCaptureId,
        amount,
        currency: targetCapture.currency,
        noteToPayer: reason || 'SLA performance post-capture adjustment',
        requestId: lockKey,
      });

      // Save refund record
      const refundRecord: RefundRecord = {
        id: `REF-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`,
        paymentId,
        paypalCaptureId: targetCapture.paypalCaptureId,
        paypalRefundId: refundResult.refundId,
        amount: refundResult.refundedAmount,
        currency: refundResult.currency,
        status: refundResult.status,
        reason,
        idempotencyKey: lockKey,
        rawResponse: refundResult.rawResponse,
        createdAt: new Date().toISOString(),
      };
      this.db.createRefund(refundRecord);

      // Update payment record
      const newTotalRefunded = Number((payment.refundedAmount + refundResult.refundedAmount).toFixed(2));
      const newStatus =
        newTotalRefunded >= payment.capturedAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      const updatedPayment = this.db.updatePayment(payment.id, {
        refundedAmount: newTotalRefunded,
        status: newStatus,
      });

      this.db.addAuditLog(
        'PAYMENT_REFUNDED',
        {
          paymentId,
          refundId: refundResult.refundId,
          paypalCaptureId: targetCapture.paypalCaptureId,
          refundedAmount: refundResult.refundedAmount,
          currency: refundResult.currency,
          status: refundResult.status,
        },
        paymentId
      );

      const responsePayload = {
        payment: updatedPayment,
        refund: refundRecord,
      };

      this.db.completeIdempotencyKey(lockKey, 200, responsePayload);

      return responsePayload;
    } catch (err: any) {
      this.db.releaseOrFailIdempotencyKey(lockKey);
      this.db.addAuditLog(
        'REFUND_FAILED',
        {
          paymentId,
          error: err.message,
        },
        paymentId
      );
      throw err;
    }
  }

  /**
   * 5. Get Comprehensive Payment Details
   */
  public async getPaymentDetails(paymentId: string): Promise<{
    payment: PaymentRecord;
    captures: CaptureRecord[];
    refunds: RefundRecord[];
    settlements: SettlementRecord[];
    auditLogs: any[];
  }> {
    const payment = this.db.getPaymentById(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found.`);
    }

    const captures = this.db.getCapturesByPaymentId(paymentId);
    const refunds = this.db.getRefundsByPaymentId(paymentId);
    const settlements = this.db.getSettlementsByPaymentId(paymentId);
    const auditLogs = this.db.getAuditLogs(paymentId);

    return {
      payment,
      captures,
      refunds,
      settlements,
      auditLogs,
    };
  }
}

export const paymentService = new PaymentService();
