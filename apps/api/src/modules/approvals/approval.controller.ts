import { RequestHandler } from 'express';
import { success } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { approvalService } from './approval.service';
import {
  ApproveApprovalInput,
  CancelApprovalInput,
  ListApprovalsQueryInput,
  RejectApprovalInput,
} from './approval.validation';
import { resolveReviewerIdentity } from './reviewer.context';

// GET /api/approvals
export const listApprovals: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as ListApprovalsQueryInput;
  const result = await approvalService.list(query);
  success(res, 'Approvals retrieved successfully', result);
});

// GET /api/approvals/pending
export const pendingApprovals: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as Partial<ListApprovalsQueryInput>;
  const result = await approvalService.listPending(query);
  success(res, 'Pending approvals retrieved successfully', result);
});

// GET /api/approvals/:id
export const getApproval: RequestHandler = asyncHandler(async (req, res) => {
  const approval = await approvalService.getById(req.params['id'] as string);
  success(res, 'Approval retrieved successfully', approval);
});

// POST /api/approvals/:id/approve
export const approve: RequestHandler = asyncHandler(async (req, res) => {
  const input = req.body as ApproveApprovalInput;
  const reviewer = resolveReviewerIdentity(req, input);
  const approval = await approvalService.approve(req.params['id'] as string, input, reviewer);
  success(res, 'Settlement approved successfully', approval);
});

// POST /api/approvals/:id/reject
export const reject: RequestHandler = asyncHandler(async (req, res) => {
  const input = req.body as RejectApprovalInput;
  const reviewer = resolveReviewerIdentity(req, input);
  const approval = await approvalService.reject(req.params['id'] as string, input, reviewer);
  success(res, 'Settlement rejected successfully', approval);
});

// POST /api/approvals/:id/cancel
export const cancel: RequestHandler = asyncHandler(async (req, res) => {
  const input = req.body as CancelApprovalInput;
  const reviewer = resolveReviewerIdentity(req, input);
  const approval = await approvalService.cancel(req.params['id'] as string, input, reviewer);
  success(res, 'Approval request cancelled successfully', approval);
});
