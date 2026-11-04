import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';

export const createApp = (): Application => {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Basic request logger
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    });
    next();
  });

  // Serve static assets from public directory
  const publicDir = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // Favicon handler
  app.get('/favicon.ico', (req: Request, res: Response) => {
    res.status(204).end();
  });

  // Root endpoint: Serve interactive UI or API meta
  app.get('/', (req: Request, res: Response) => {
    const indexPath = path.resolve(publicDir, 'index.html');
    if (req.accepts('html') && fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
      return;
    }

    res.status(200).json({
      service: 'Pay-for-Performance PayPal Payment Integration Module',
      version: '1.0.0',
      status: 'healthy',
      endpoints: {
        health: '/api/health',
        createOrder: 'POST /api/payments/create-order',
        authorizeOrder: 'POST /api/payments/:orderId/authorize',
        captureSettlement: 'POST /api/payments/:paymentId/capture',
        refundPayment: 'POST /api/payments/:paymentId/refund',
        paymentStatus: 'GET /api/payments/:paymentId',
        stageSettlement: 'POST /api/settlements',
        webhooks: 'POST /api/webhooks/paypal',
      },
      documentation: '/README.md',
    });
  });

  // API Routes
  app.use('/api', routes);

  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};
