import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler';
import { success } from '../../shared/utils/api-response';
import { paymentService } from './payment.service';

export const paymentController = {
  createOrder: asyncHandler(async (req: Request, res: Response) => {
    const { amount, currency, description, metadata } = req.body;
    const payment = await paymentService.createOrder({
      amount: Number(amount),
      currency,
      description,
      metadata,
    });
    return success(res, 'PayPal order created successfully', payment, 201);
  }),

  authorizeOrder: asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const payment = await paymentService.authorizeOrder(orderId as string);
    return success(res, 'PayPal payment authorized successfully', payment, 200);
  }),

  capturePayment: asyncHandler(async (req: Request, res: Response) => {
    const { paymentId } = req.params;
    const { settlementId } = req.body;
    const payment = await paymentService.capturePayment(paymentId as string, settlementId);
    return success(res, 'PayPal payment captured successfully', payment, 200);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { paymentId } = req.params;
    const payment = await paymentService.getById(paymentId as string);
    return success(res, 'Payment retrieved successfully', payment, 200);
  }),

  listTransactions: asyncHandler(async (_req: Request, res: Response) => {
    const transactions = await paymentService.listTransactions();
    return success(res, 'Transactions retrieved successfully', transactions, 200);
  }),
};
