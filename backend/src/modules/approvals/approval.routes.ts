import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import {
  approve,
  cancel,
  getApproval,
  listApprovals,
  pendingApprovals,
  reject,
} from './approval.controller';
import {
  approvalIdParamSchema,
  approveApprovalSchema,
  cancelApprovalSchema,
  listApprovalsQuerySchema,
  rejectApprovalSchema,
} from './approval.validation';

const router = Router();

// NOTE: Specific route `/pending` must come before `/:id`
router.get('/pending', validate(listApprovalsQuerySchema, 'query'), pendingApprovals);

router.post(
  '/:id/approve',
  validate(approvalIdParamSchema, 'params'),
  validate(approveApprovalSchema, 'body'),
  approve
);
router.post(
  '/:id/reject',
  validate(approvalIdParamSchema, 'params'),
  validate(rejectApprovalSchema, 'body'),
  reject
);
router.post(
  '/:id/cancel',
  validate(approvalIdParamSchema, 'params'),
  validate(cancelApprovalSchema, 'body'),
  cancel
);

router.get('/:id', validate(approvalIdParamSchema, 'params'), getApproval);

router.get('/', validate(listApprovalsQuerySchema, 'query'), listApprovals);

export default router;
