import { Router } from 'express';
import {
  createService,
  deleteService,
  getService,
  listServices,
  updateService,
} from './service.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createServiceSchema,
  paginationSchema,
  serviceIdSchema,
  updateServiceSchema,
} from './service.validation';

const router = Router();

router.post('/', validate(createServiceSchema), createService);
router.get('/', validate(paginationSchema, 'query'), listServices);
router.get('/:id', validate(serviceIdSchema, 'params'), getService);
router.patch(
  '/:id',
  validate(serviceIdSchema, 'params'),
  validate(updateServiceSchema),
  updateService
);
router.delete('/:id', validate(serviceIdSchema, 'params'), deleteService);

export default router;
