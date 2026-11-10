import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const validateBody = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
};

export const createOrderSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).optional().default('USD'),
  description: z.string().max(255).optional(),
  metadata: z.record(z.any()).optional(),
});

export const capturePaymentSchema = z.object({
  settlementId: z.string().min(1, 'settlementId is required'),
});

export const refundPaymentSchema = z.object({
  amount: z.number().positive('Refund amount must be positive'),
  captureId: z.string().optional(),
  reason: z.string().max(255).optional(),
});

/**
 * Person 3 SLA Settlement Contract schema
 */
export const settlementContractSchema = z.object({
  settlementId: z.string().min(1, 'settlementId is required'),
  paymentId: z.string().min(1, 'paymentId is required'),
  authorizedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal amount (e.g. 100.00)'),
  creditAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal amount (e.g. 25.00)'),
  captureAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal amount (e.g. 75.00)'),
  currency: z.string().length(3).default('USD'),
  decision: z.enum(['APPROVED', 'REJECTED', 'PENDING_REVIEW']),
  approvedBy: z.string().min(1, 'approvedBy is required'),
});
