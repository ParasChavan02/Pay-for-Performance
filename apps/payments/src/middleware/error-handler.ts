import { Request, Response, NextFunction } from 'express';
import { PayPalApiError } from '../services/paypal-client.js';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  console.error(`[Error Handler] ${req.method} ${req.url}:`, err);

  if (err instanceof PayPalApiError) {
    res.status(err.statusCode || 502).json({
      success: false,
      error: 'PayPal API Error',
      message: err.message,
      debugId: err.debugId,
      details: err.details,
    });
    return;
  }

  // Conflict / Business Logic violations
  const message = err.message || 'Internal Server Error';

  if (
    message.includes('already been executed') ||
    message.includes('currently being processed') ||
    message.includes('duplicate')
  ) {
    res.status(409).json({
      success: false,
      error: 'Conflict',
      message,
    });
    return;
  }

  if (
    message.includes('not found') ||
    message.includes('does not belong')
  ) {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message,
    });
    return;
  }

  if (
    message.includes('exceeds') ||
    message.includes('greater than zero') ||
    message.includes('requires') ||
    message.includes('mismatch') ||
    message.includes('status is') ||
    message.includes('Invalid')
  ) {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message,
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : message,
  });
};
