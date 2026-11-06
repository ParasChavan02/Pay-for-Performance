import fs from 'fs';
import path from 'path';
import {
  PaymentRecord,
  SettlementRecord,
  CaptureRecord,
  RefundRecord,
  IdempotencyRecord,
  AuditLogRecord,
} from '../types/payment.js';
import { config } from '../config/env.js';

interface DatabaseSchema {
  payments: Record<string, PaymentRecord>;
  settlements: Record<string, SettlementRecord>;
  captures: Record<string, CaptureRecord>;
  refunds: Record<string, RefundRecord>;
  idempotencyKeys: Record<string, IdempotencyRecord>;
  auditLogs: AuditLogRecord[];
}

export class Database {
  private filePath: string;
  private data: DatabaseSchema;
  private isDirty: boolean = false;

  constructor(customPath?: string) {
    this.filePath = customPath || path.resolve(process.cwd(), config.DATABASE_STORAGE_PATH);
    this.data = {
      payments: {},
      settlements: {},
      captures: {},
      refunds: {},
      idempotencyKeys: {},
      auditLogs: [],
    };
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        this.save();
      }
    } catch (err) {
      console.error(`Failed to load database from ${this.filePath}, initializing fresh state.`, err);
      this.data = {
        payments: {},
        settlements: {},
        captures: {},
        refunds: {},
        idempotencyKeys: {},
        auditLogs: [],
      };
      this.save();
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
      this.isDirty = false;
    } catch (err) {
      console.error(`Failed to write database to ${this.filePath}`, err);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // Payments Repository Methods
  // -------------------------------------------------------------
  public createPayment(payment: PaymentRecord): PaymentRecord {
    this.data.payments[payment.id] = payment;
    this.save();
    return payment;
  }

  public getPaymentById(id: string): PaymentRecord | undefined {
    return this.data.payments[id];
  }

  public getPaymentByOrderId(orderId: string): PaymentRecord | undefined {
    return Object.values(this.data.payments).find((p) => p.orderId === orderId);
  }

  public getPaymentByAuthorizationId(authId: string): PaymentRecord | undefined {
    return Object.values(this.data.payments).find((p) => p.authorizationId === authId);
  }

  public updatePayment(id: string, updates: Partial<PaymentRecord>): PaymentRecord {
    const payment = this.data.payments[id];
    if (!payment) {
      throw new Error(`Payment with id ${id} not found`);
    }
    const updated: PaymentRecord = {
      ...payment,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.payments[id] = updated;
    this.save();
    return updated;
  }

  // -------------------------------------------------------------
  // Settlements Repository Methods (Person 3 SLA Settlement)
  // -------------------------------------------------------------
  public createOrUpdateSettlement(settlement: SettlementRecord): SettlementRecord {
    this.data.settlements[settlement.settlementId] = settlement;
    this.save();
    return settlement;
  }

  public getSettlementById(settlementId: string): SettlementRecord | undefined {
    return this.data.settlements[settlementId];
  }

  public getSettlementsByPaymentId(paymentId: string): SettlementRecord[] {
    return Object.values(this.data.settlements).filter((s) => s.paymentId === paymentId);
  }

  // -------------------------------------------------------------
  // Captures Repository Methods
  // -------------------------------------------------------------
  public createCapture(capture: CaptureRecord): CaptureRecord {
    // Unique check on PayPal capture ID
    const existing = Object.values(this.data.captures).find(
      (c) => c.paypalCaptureId === capture.paypalCaptureId
    );
    if (existing) {
      return existing;
    }

    this.data.captures[capture.id] = capture;
    this.save();
    return capture;
  }

  public getCapturesByPaymentId(paymentId: string): CaptureRecord[] {
    return Object.values(this.data.captures).filter((c) => c.paymentId === paymentId);
  }

  public getCaptureByPayPalId(paypalCaptureId: string): CaptureRecord | undefined {
    return Object.values(this.data.captures).find((c) => c.paypalCaptureId === paypalCaptureId);
  }

  // -------------------------------------------------------------
  // Refunds Repository Methods
  // -------------------------------------------------------------
  public createRefund(refund: RefundRecord): RefundRecord {
    const existing = Object.values(this.data.refunds).find(
      (r) => r.paypalRefundId === refund.paypalRefundId
    );
    if (existing) {
      return existing;
    }

    this.data.refunds[refund.id] = refund;
    this.save();
    return refund;
  }

  public getRefundsByPaymentId(paymentId: string): RefundRecord[] {
    return Object.values(this.data.refunds).filter((r) => r.paymentId === paymentId);
  }

  public getRefundsByCaptureId(paypalCaptureId: string): RefundRecord[] {
    return Object.values(this.data.refunds).filter((r) => r.paypalCaptureId === paypalCaptureId);
  }

  // -------------------------------------------------------------
  // Database-Level Idempotency Protection
  // -------------------------------------------------------------
  /**
   * Database-level idempotency record check.
   * If not present, records as 'PROCESSING'.
   * If already exists with 'COMPLETED', returns the stored response.
   * If already 'PROCESSING', throws 409 conflict to prevent duplicate execution.
   */
  public acquireIdempotencyKey(
    key: string,
    targetType: 'CAPTURE' | 'REFUND' | 'CREATE_ORDER' | 'AUTHORIZE',
    requestHash: string
  ): { status: 'ACQUIRED' | 'REPLAY' | 'IN_FLIGHT'; record?: IdempotencyRecord } {
    const existing = this.data.idempotencyKeys[key];
    if (!existing) {
      const record: IdempotencyRecord = {
        key,
        targetType,
        requestHash,
        status: 'PROCESSING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.data.idempotencyKeys[key] = record;
      this.save();
      return { status: 'ACQUIRED', record };
    }

    if (existing.status === 'COMPLETED') {
      return { status: 'REPLAY', record: existing };
    }

    if (existing.status === 'PROCESSING') {
      // Key is currently locked / being processed
      return { status: 'IN_FLIGHT', record: existing };
    }

    // If previously failed, allow retry by updating to PROCESSING
    existing.status = 'PROCESSING';
    existing.requestHash = requestHash;
    existing.updatedAt = new Date().toISOString();
    this.save();
    return { status: 'ACQUIRED', record: existing };
  }

  public completeIdempotencyKey(key: string, statusCode: number, responseBody: any): void {
    const record = this.data.idempotencyKeys[key];
    if (record) {
      record.status = 'COMPLETED';
      record.responseStatusCode = statusCode;
      record.responseBody = responseBody;
      record.updatedAt = new Date().toISOString();
      this.save();
    }
  }

  public releaseOrFailIdempotencyKey(key: string): void {
    const record = this.data.idempotencyKeys[key];
    if (record && record.status === 'PROCESSING') {
      record.status = 'FAILED';
      record.updatedAt = new Date().toISOString();
      this.save();
    }
  }

  // -------------------------------------------------------------
  // Audit Logging
  // -------------------------------------------------------------
  public addAuditLog(
    action: string,
    details: Record<string, any>,
    paymentId?: string,
    ipAddress?: string
  ): void {
    const log: AuditLogRecord = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      paymentId,
      action,
      details,
      ipAddress,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.push(log);
    this.save();
  }

  public getAuditLogs(paymentId?: string): AuditLogRecord[] {
    if (paymentId) {
      return this.data.auditLogs.filter((l) => l.paymentId === paymentId);
    }
    return [...this.data.auditLogs];
  }

  // For testing cleanup
  public clearAll(): void {
    this.data = {
      payments: {},
      settlements: {},
      captures: {},
      refunds: {},
      idempotencyKeys: {},
      auditLogs: [],
    };
    this.save();
  }
}

export const db = new Database();
