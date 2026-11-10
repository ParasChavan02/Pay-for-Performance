import { z } from 'zod';
import { approvalStatuses } from './approval.model';

const objectIdRegex = /^[a-f\d]{24}$/i;

export const approvalIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid MongoDB Approval ID'),
});

export const listApprovalsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(approvalStatuses).optional(),
  serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID').optional(),
  settlementId: z.string().regex(objectIdRegex, 'Invalid MongoDB Settlement ID').optional(),
  sortBy: z.enum(['requestedAt', 'reviewedAt', 'createdAt']).default('requestedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const approveApprovalSchema = z.object({
  comments: z.string().trim().optional(),
  reviewerId: z.string().trim().optional(),
  reviewerName: z.string().trim().optional(),
});

export const rejectApprovalSchema = z.object({
  rejectionReason: z.string().trim().min(1, 'Rejection reason is required when rejecting a settlement'),
  comments: z.string().trim().optional(),
  reviewerId: z.string().trim().optional(),
  reviewerName: z.string().trim().optional(),
});

export const cancelApprovalSchema = z.object({
  reason: z.string().trim().optional(),
  reviewerId: z.string().trim().optional(),
});

export type ListApprovalsQueryInput = z.infer<typeof listApprovalsQuerySchema>;
export type ApproveApprovalInput = z.infer<typeof approveApprovalSchema>;
export type RejectApprovalInput = z.infer<typeof rejectApprovalSchema>;
export type CancelApprovalInput = z.infer<typeof cancelApprovalSchema>;
