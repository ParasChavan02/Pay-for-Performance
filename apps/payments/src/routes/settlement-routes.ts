import { Router } from 'express';
import { settlementController } from '../controllers/settlement-controller.js';
import { validateBody, settlementContractSchema } from '../middleware/validate.js';

const router = Router();

router.post(
  '/',
  validateBody(settlementContractSchema),
  (req, res, next) => settlementController.createSettlement(req, res, next)
);

router.get(
  '/:settlementId',
  (req, res, next) => settlementController.getSettlement(req, res, next)
);

router.get(
  '/payment/:paymentId',
  (req, res, next) => settlementController.getSettlementsByPayment(req, res, next)
);

export default router;
