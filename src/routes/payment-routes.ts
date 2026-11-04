import { Router } from 'express';
import { paymentController } from '../controllers/payment-controller.js';
import {
  validateBody,
  createOrderSchema,
  capturePaymentSchema,
  refundPaymentSchema,
} from '../middleware/validate.js';

const router = Router();

// Sandbox return & cancel redirect endpoints
router.get('/return', (req, res) => paymentController.handleReturn(req, res));
router.get('/cancel', (req, res) => paymentController.handleCancel(req, res));

// Core Payment Lifecycle Endpoints
router.post(
  '/create-order',
  validateBody(createOrderSchema),
  (req, res, next) => paymentController.createOrder(req, res, next)
);

router.post(
  '/:orderId/authorize',
  (req, res, next) => paymentController.authorizeOrder(req, res, next)
);

router.post(
  '/:paymentId/capture',
  validateBody(capturePaymentSchema),
  (req, res, next) => paymentController.capturePayment(req, res, next)
);

router.post(
  '/:paymentId/refund',
  validateBody(refundPaymentSchema),
  (req, res, next) => paymentController.refundPayment(req, res, next)
);

router.get(
  '/:paymentId',
  (req, res, next) => paymentController.getPayment(req, res, next)
);

export default router;
