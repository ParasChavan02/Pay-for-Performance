import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import {
  calculateSettlement,
  listSettlements,
  getSettlement,
  getSettlementByPayment,
  getSettlementsByService,
  getSettlementBreakdown,
  recalculateSettlement,
  approveSettlementDirect,
} from './settlement.controller';
import {
  calculateSettlementSchema,
  settlementIdParamSchema,
  paymentIdParamSchema,
  settlementServiceIdParamSchema,
  listSettlementsQuerySchema,
} from './settlement.validation';

const router = Router();

// NOTE: Order matters — specific paths before /:id
router.post('/calculate', validate(calculateSettlementSchema), calculateSettlement);
router.get('/payment/:paymentId', validate(paymentIdParamSchema, 'params'), getSettlementByPayment);
router.get(
  '/service/:serviceId',
  validate(settlementServiceIdParamSchema, 'params'),
  getSettlementsByService
);
router.get('/:id/breakdown', validate(settlementIdParamSchema, 'params'), getSettlementBreakdown);
router.post(
  '/:id/recalculate',
  validate(settlementIdParamSchema, 'params'),
  recalculateSettlement
);
router.post(
  '/:id/approve',
  validate(settlementIdParamSchema, 'params'),
  approveSettlementDirect
);
router.get('/:id', validate(settlementIdParamSchema, 'params'), getSettlement);
router.get('/', validate(listSettlementsQuerySchema, 'query'), listSettlements);

export default router;
