import { Router } from 'express';
import paymentRoutes from './payment-routes.js';
import settlementRoutes from './settlement-routes.js';
import { webhookController } from '../controllers/webhook-controller.js';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'pay-for-performance-paypal-integration',
    version: '1.0.0',
  });
});

// Mount Routes
router.use('/payments', paymentRoutes);
router.use('/settlements', settlementRoutes);

// Webhook endpoint
router.post('/webhooks/paypal', (req, res) => webhookController.handleWebhook(req, res));

export default router;
