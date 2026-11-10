import { Router } from 'express';
import { settlementAudit, listAuditLogs } from './audit.controller';

const router = Router();

router.get('/settlements/:id/audit', settlementAudit);
router.get('/audit', listAuditLogs);
router.get('/', listAuditLogs);

export default router;
