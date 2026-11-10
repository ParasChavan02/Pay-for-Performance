import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import {
  getLatestMetric,
  getServiceMetrics,
  getServiceSummary,
  listMetrics,
  triggerManualCheck,
} from './monitoring.controller';
import {
  monitoringQuerySchema,
  serviceHistoryQuerySchema,
  serviceIdParamSchema,
  summaryQuerySchema,
} from './monitoring.validation';

const router = Router();

// Manual check endpoint
router.post(
  '/:serviceId/check',
  validate(serviceIdParamSchema, 'params'),
  triggerManualCheck
);

// Global monitoring metrics list
router.get(
  '/',
  validate(monitoringQuerySchema, 'query'),
  listMetrics
);

// Specific service latest metric
router.get(
  '/:serviceId/latest',
  validate(serviceIdParamSchema, 'params'),
  getLatestMetric
);

// Specific service performance summary
router.get(
  '/:serviceId/summary',
  validate(serviceIdParamSchema, 'params'),
  validate(summaryQuerySchema, 'query'),
  getServiceSummary
);

// Specific service historical metrics
router.get(
  '/:serviceId',
  validate(serviceIdParamSchema, 'params'),
  validate(serviceHistoryQuerySchema, 'query'),
  getServiceMetrics
);

export default router;
