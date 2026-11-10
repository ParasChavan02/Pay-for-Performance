import { Types } from 'mongoose';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors/app-error';
import { auditService } from '../audit/audit.service';
import { PaymentModel, PaymentStatus } from './payment.model';

export const paymentService = {
  /** Create a $100 authorization order through Person 1's PayPal engine and save in MongoDB */
  async createOrder(params: {
    amount: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    const { amount, currency = 'USD', description, metadata = {} } = params;

    // Call Person 1's PayPal payment service
    let paypalData: any;
    try {
      const response = await fetch(`${env.PAYMENT_SERVICE_URL}/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': env.INTERNAL_API_TOKEN,
        },
        body: JSON.stringify({
          amount,
          currency,
          description: description || 'SLA Performance Guarantee Contract',
          metadata,
        }),
      });

      const json = (await response.json()) as any;
      if (!response.ok || !json.success) {
        throw new Error(json.message || json.error || `HTTP ${response.status}`);
      }
      paypalData = json.data;
    } catch (err: any) {
      throw new AppError(502, 'PAYPAL_ORDER_FAILED', `Failed to create PayPal order: ${err.message}`);
    }

    // Persist in MongoDB
    const doc = await PaymentModel.create({
      paymentId: paypalData.paymentId,
      orderId: paypalData.orderId,
      authorizedAmount: Types.Decimal128.fromString(Number(amount).toFixed(2)),
      currency: currency.toUpperCase(),
      paymentStatus: 'APPROVAL_PENDING',
      approvalUrl: paypalData.approvalUrl,
      description,
      metadata,
    });

    await auditService.append({
      action: 'ORDER_CREATED',
      entityType: 'Payment',
      entityId: paypalData.paymentId,
      description: `Created PayPal order ${paypalData.orderId} for $${Number(amount).toFixed(2)} ${currency}`,
      metadata: { orderId: paypalData.orderId, approvalUrl: paypalData.approvalUrl },
    });

    return doc;
  },

  /** Authorize payment after buyer approval */
  async authorizeOrder(orderId: string) {
    let authData: any;
    try {
      const response = await fetch(`${env.PAYMENT_SERVICE_URL}/payments/${orderId}/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': env.INTERNAL_API_TOKEN,
        },
      });

      const json = (await response.json()) as any;
      if (!response.ok || !json.success) {
        throw new Error(json.message || json.error || `HTTP ${response.status}`);
      }
      authData = json.data;
    } catch (err: any) {
      throw new AppError(502, 'PAYPAL_AUTH_FAILED', `Failed to authorize PayPal order: ${err.message}`);
    }

    const doc = await PaymentModel.findOneAndUpdate(
      { $or: [{ orderId }, { paymentId: authData.id }] },
      {
        authorizationId: authData.authorizationId,
        paymentStatus: 'AUTHORIZED' as PaymentStatus,
        authorizedAmount: Types.Decimal128.fromString(Number(authData.authorizedAmount).toFixed(2)),
      },
      { new: true }
    );

    await auditService.append({
      action: 'ORDER_AUTHORIZED',
      entityType: 'Payment',
      entityId: doc?.paymentId || orderId,
      description: `Authorized PayPal hold for $${Number(authData.authorizedAmount).toFixed(2)} (Auth ID: ${authData.authorizationId})`,
      metadata: { authorizationId: authData.authorizationId, orderId },
    });

    return doc;
  },

  /** Capture approved settlement */
  async capturePayment(paymentId: string, settlementId: string) {
    let captureData: any;
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
        throw new Error(json.message || json.error || `HTTP ${response.status}`);
      }
      captureData = json.data;
    } catch (err: any) {
      throw new AppError(502, 'PAYPAL_CAPTURE_FAILED', `Failed to capture settlement: ${err.message}`);
    }

    const doc = await PaymentModel.findOneAndUpdate(
      { paymentId },
      {
        captureId: captureData.capture?.paypalCaptureId,
        capturedAmount: Types.Decimal128.fromString(Number(captureData.capture?.amount || 0).toFixed(2)),
        paymentStatus: 'CAPTURED' as PaymentStatus,
        settlementId: Types.ObjectId.isValid(settlementId) ? new Types.ObjectId(settlementId) : undefined,
      },
      { new: true }
    );

    await auditService.append({
      action: 'PAYMENT_CAPTURED',
      entityType: 'Payment',
      entityId: paymentId,
      settlementId: Types.ObjectId.isValid(settlementId) ? new Types.ObjectId(settlementId) : undefined,
      description: `Captured $${captureData.capture?.amount} via PayPal (Capture ID: ${captureData.capture?.paypalCaptureId})`,
      metadata: { captureId: captureData.capture?.paypalCaptureId, amount: captureData.capture?.amount },
    });

    return doc;
  },

  /** Retrieve single payment by ID */
  async getById(paymentId: string) {
    const doc = await PaymentModel.findOne({ paymentId }).lean();
    if (doc) return doc;

    // Fallback: query Payment Service directly
    try {
      const response = await fetch(`${env.PAYMENT_SERVICE_URL}/payments/${paymentId}`);
      if (response.ok) {
        const json = (await response.json()) as any;
        return json.data?.payment;
      }
    } catch {
      // offline
    }

    throw new AppError(404, 'PAYMENT_NOT_FOUND', `Payment '${paymentId}' not found`);
  },

  /** List all transactions for the frontend Ag-Grid */
  async listTransactions() {
    const payments = await PaymentModel.find().sort({ createdAt: -1 }).lean();

    const transactions = [];
    for (const p of payments) {
      const timeStr = new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const authAmt = Number(p.authorizedAmount?.toString() || 0);
      const capAmt = Number(p.capturedAmount?.toString() || 0);
      const refAmt = Number(p.refundedAmount?.toString() || 0);

      // Auth record
      if (p.authorizationId || p.paymentStatus !== 'CREATED') {
        transactions.push({
          id: p.authorizationId || `AUTH-${p.paymentId}`,
          type: 'Authorize',
          amount: authAmt,
          status: p.paymentStatus === 'APPROVAL_PENDING' ? 'Pending' : 'Held',
          time: timeStr,
          ref: p.description || 'Service Plan purchase',
          paymentId: p.paymentId,
        });
      }

      // Capture record
      if (capAmt > 0 || p.captureId) {
        transactions.push({
          id: p.captureId || `CAP-${p.paymentId}`,
          type: capAmt < authAmt ? 'Partial capture' : 'Capture',
          amount: capAmt,
          status: 'Completed',
          time: new Date(p.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          ref: p.settlementId ? `SLA Settlement ${p.settlementId}` : 'SLA Performance Settle',
          paymentId: p.paymentId,
        });
      }

      // Credit released record if partial capture
      if (capAmt > 0 && capAmt < authAmt) {
        const creditReleased = authAmt - capAmt;
        transactions.push({
          id: `VOID-${p.paymentId}`,
          type: 'Credit released',
          amount: creditReleased,
          status: 'Not captured',
          time: new Date(p.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          ref: 'Contractual SLA credit',
          paymentId: p.paymentId,
        });
      }

      // Refund record
      if (refAmt > 0 || p.refundId) {
        transactions.push({
          id: p.refundId || `REF-${p.paymentId}`,
          type: 'Partial refund',
          amount: refAmt,
          status: 'Completed',
          time: new Date(p.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          ref: 'Post-capture SLA credit',
          paymentId: p.paymentId,
        });
      }
    }

    return transactions;
  },
};
