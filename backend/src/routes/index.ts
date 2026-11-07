import { Router } from 'express';
import services from '../modules/services/service.routes';
import monitoring from '../modules/monitoring/monitoring.routes';
import sla from '../modules/sla/sla.routes';
import settlement from '../modules/settlement/settlement.routes';
import policy from '../modules/policy/policy.routes';
import approvals from '../modules/approvals/approval.routes';
import audit from '../modules/audit/audit.routes';
import { databaseStatus } from '../config/database';

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
router.use('/', audit);

export default router;
