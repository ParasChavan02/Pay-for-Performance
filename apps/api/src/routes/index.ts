import { Router } from 'express';
import http from 'http';
import { env } from '../config/env';
import { databaseStatus } from '../config/database';
import services from '../modules/services/service.routes';
import monitoring from '../modules/monitoring/monitoring.routes';
import sla from '../modules/sla/sla.routes';
import settlement from '../modules/settlement/settlement.routes';
import policy from '../modules/policy/policy.routes';
import approvals from '../modules/approvals/approval.routes';
import audit from '../modules/audit/audit.routes';
import paymentRoutes from '../modules/payment/payment.routes';
import { paymentController } from '../modules/payment/payment.controller';

const router = Router();

router.get('/health', (_req, res) =>
  res.json({
    success: true,
    message: 'Pay-for-Performance Backend is running',
    data: { server: 'online', database: databaseStatus() },
  })
);

router.use('/services', services);
router.use('/monitoring', monitoring);
router.use('/sla', sla);
router.use('/settlements', settlement);
router.use('/policies', policy);
router.use('/policy', policy);
router.use('/approvals', approvals);
router.use('/payments', paymentRoutes);
router.get('/transactions', paymentController.listTransactions);
router.use('/audit', audit);
router.use('/', audit);

// Stream proxy for AI SLA PDF extraction
router.post('/sla/extract', (req, res) => {
  const url = new URL(`${env.SLA_SERVICE_URL}/sla/extract`);
  const headers = { ...req.headers, host: url.host };

  const proxyReq = http.request(
    {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    res.status(502).json({
      success: false,
      error: 'SLA_SERVICE_UNAVAILABLE',
      message: `SLA intelligence service at ${env.SLA_SERVICE_URL} is offline or unreachable: ${err.message}`,
    });
  });

  req.pipe(proxyReq);
});

export default router;
