import { Router } from 'express'; import { settlementAudit } from './audit.controller'; const router = Router(); router.get('/settlements/:id/audit', settlementAudit); export default router;
