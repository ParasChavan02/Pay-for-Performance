import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment-service.js';

export class PaymentController {
  /**
   * POST /api/payments/create-order
   */
  public async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, currency, description, metadata } = req.body;
      const idempotencyKey = (req.headers['idempotency-key'] || req.headers['paypal-request-id']) as
        | string
        | undefined;

      const result = await paymentService.createPaymentOrder({
        amount,
        currency,
        description,
        metadata,
        idempotencyKey,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/payments/:orderId/authorize
   */
  public async authorizeOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = req.params.orderId as string;
      const idempotencyKey = (req.headers['idempotency-key'] || req.headers['paypal-request-id']) as
        | string
        | undefined;

      const payment = await paymentService.authorizePayment(orderId, idempotencyKey);

      res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/payments/:paymentId/capture
   */
  public async capturePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paymentId = req.params.paymentId as string;
      const { settlementId } = req.body;
      const idempotencyKey = (req.headers['idempotency-key'] || req.headers['paypal-request-id']) as
        | string
        | undefined;

      const result = await paymentService.capturePaymentBySettlement({
        paymentId,
        settlementId,
        idempotencyKey,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/payments/:paymentId/refund
   */
  public async refundPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paymentId = req.params.paymentId as string;
      const { amount, captureId, reason } = req.body;
      const idempotencyKey = (req.headers['idempotency-key'] || req.headers['paypal-request-id']) as
        | string
        | undefined;

      const result = await paymentService.refundPayment({
        paymentId,
        captureId,
        amount,
        reason,
        idempotencyKey,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/payments/:paymentId
   */
  public async getPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paymentId = req.params.paymentId as string;
      const details = await paymentService.getPaymentDetails(paymentId);

      res.status(200).json({
        success: true,
        data: details,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/payments/return (Helper landing page for Sandbox buyer redirect)
   */
  public async handleReturn(req: Request, res: Response): Promise<void> {
    const { token, PayerID } = req.query;
    res.status(200).json({
      success: true,
      message: 'Buyer successfully approved the PayPal order.',
      orderId: token,
      payerId: PayerID,
      nextStep: `Call POST /api/payments/${token}/authorize to authorize the payment.`,
    });
  }

  /**
   * GET /api/payments/cancel (Helper landing page if buyer cancels)
   */
  public async handleCancel(req: Request, res: Response): Promise<void> {
    const { token } = req.query;
    res.status(200).json({
      success: false,
      message: 'Buyer cancelled the PayPal checkout.',
      orderId: token,
    });
  }
}

export const paymentController = new PaymentController();
