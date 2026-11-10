import { Router } from 'express';
import { paymentController } from './payment.controller';

const router = Router();

router.post('/create-order', paymentController.createOrder);
router.post('/:orderId/authorize', paymentController.authorizeOrder);
router.post('/:paymentId/capture', paymentController.capturePayment);
router.get('/:paymentId', paymentController.getById);

export default router;
