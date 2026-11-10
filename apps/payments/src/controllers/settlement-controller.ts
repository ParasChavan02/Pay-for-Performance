import { Request, Response, NextFunction } from 'express';
import { db } from '../repositories/database.js';
import { SettlementRecord } from '../types/payment.js';

export class SettlementController {
  /**
   * POST /api/settlements
   * Intake Person 3's approved SLA Settlement
   */
  public async createSettlement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        settlementId,
        paymentId,
        authorizedAmount,
        creditAmount,
        captureAmount,
        currency,
        decision,
        approvedBy,
      } = req.body;

      const authNum = parseFloat(authorizedAmount);
      const creditNum = parseFloat(creditAmount);
      const captureNum = parseFloat(captureAmount);

      // Verify SLA calculation arithmetic sanity
      const expectedCapture = Number((authNum - creditNum).toFixed(2));
      if (Math.abs(expectedCapture - captureNum) > 0.01) {
        res.status(400).json({
          success: false,
          error: 'Settlement Arithmetic Mismatch',
          message: `captureAmount ($${captureNum}) does not match authorizedAmount ($${authNum}) minus creditAmount ($${creditNum}). Expected $${expectedCapture.toFixed(2)}.`,
        });
        return;
      }

      // Check if payment exists in system
      const payment = db.getPaymentById(paymentId);
      if (!payment) {
        res.status(404).json({
          success: false,
          error: 'Payment Not Found',
          message: `Cannot stage settlement for paymentId '${paymentId}': payment does not exist.`,
        });
        return;
      }

      const existing = db.getSettlementById(settlementId);
      if (existing && existing.status === 'EXECUTED') {
        res.status(409).json({
          success: false,
          error: 'Conflict',
          message: `Settlement ${settlementId} has already been executed.`,
        });
        return;
      }

      const record: SettlementRecord = {
        settlementId,
        paymentId,
        authorizedAmount,
        creditAmount,
        captureAmount,
        currency: currency || payment.currency,
        decision,
        approvedBy,
        status: existing?.status || 'STAGED',
        createdAt: existing?.createdAt || new Date().toISOString(),
      };

      db.createOrUpdateSettlement(record);

      db.addAuditLog(
        'SETTLEMENT_STAGED',
        {
          settlementId,
          paymentId,
          authorizedAmount,
          creditAmount,
          captureAmount,
          decision,
          approvedBy,
        },
        paymentId
      );

      res.status(201).json({
        success: true,
        message: 'Settlement contract staged successfully.',
        data: record,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/settlements/:settlementId
   */
  public async getSettlement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settlementId = req.params.settlementId as string;
      const record = db.getSettlementById(settlementId);

      if (!record) {
        res.status(404).json({
          success: false,
          error: 'Settlement Not Found',
          message: `Settlement ${settlementId} not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: record,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/settlements/payment/:paymentId
   */
  public async getSettlementsByPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const paymentId = req.params.paymentId as string;
      const records = db.getSettlementsByPaymentId(paymentId);

      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const settlementController = new SettlementController();
