import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error';
import { auditService } from '../audit/audit.service';
import { SettlementModel } from '../settlement/settlement.model';
import { ApprovalDocument, ApprovalModel } from './approval.model';
import {
  ApproveApprovalInput,
  CancelApprovalInput,
  ListApprovalsQueryInput,
  RejectApprovalInput,
} from './approval.validation';
import { ReviewerIdentity } from './reviewer.context';

export const approvalService = {
  // 1. List approvals with pagination and filters
  async list(query: ListApprovalsQueryInput): Promise<{
    data: ApprovalDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page, limit, status, settlementId, sortBy, sortOrder } = query;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (status) filter['approvalStatus'] = status;
    if (settlementId) filter['settlementId'] = new Types.ObjectId(settlementId);

    const sortDir = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortDir };

    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      ApprovalModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      ApprovalModel.countDocuments(filter),
    ]);

    return {
      data: docs as unknown as ApprovalDocument[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  // 2. List pending approvals
  async listPending(query: Partial<ListApprovalsQueryInput>): Promise<{
    data: ApprovalDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.list({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      status: 'Pending',
      sortBy: 'requestedAt',
      sortOrder: 'desc',
      settlementId: query.settlementId,
    });
  },

  // 3. Get approval by ID
  async getById(id: string): Promise<ApprovalDocument> {
    const approval = await ApprovalModel.findById(id).lean();
    if (!approval) {
      throw new AppError(404, 'APPROVAL_NOT_FOUND', `Approval request '${id}' not found`);
    }
    return approval as unknown as ApprovalDocument;
  },

  // 4. Approve settlement
  async approve(
    id: string,
    input: ApproveApprovalInput,
    reviewer: ReviewerIdentity
  ): Promise<ApprovalDocument> {
    const approval = await ApprovalModel.findById(id);
    if (!approval) {
      throw new AppError(404, 'APPROVAL_NOT_FOUND', `Approval request '${id}' not found`);
    }

    if (approval.approvalStatus === 'Approved') {
      throw new AppError(
        400,
        'ALREADY_APPROVED',
        'Approval request has already been approved'
      );
    }
    if (approval.approvalStatus === 'Rejected') {
      throw new AppError(
        400,
        'ALREADY_REJECTED',
        'Cannot approve an already rejected request'
      );
    }
    if (approval.approvalStatus === 'Cancelled') {
      throw new AppError(
        400,
        'REQUEST_CANCELLED',
        'Cannot approve a cancelled request'
      );
    }
    if (approval.approvalStatus !== 'Pending') {
      throw new AppError(
        400,
        'INVALID_APPROVAL_STATUS',
        `Cannot approve request with status '${approval.approvalStatus}'`
      );
    }

    // Verify settlement is not blocked
    const settlement = await SettlementModel.findById(approval.settlementId);
    if (!settlement) {
      throw new AppError(
        404,
        'SETTLEMENT_NOT_FOUND',
        `Settlement '${approval.settlementId}' not found`
      );
    }

    if (settlement.status === 'Blocked') {
      throw new AppError(
        400,
        'SETTLEMENT_BLOCKED',
        'Cannot approve a blocked settlement. An explicit policy or administrative correction is required.'
      );
    }

    const previousSettlementStatus = settlement.status;
    const now = new Date();

    // Transition approval status
    approval.approvalStatus = 'Approved';
    approval.reviewedAt = now;
    approval.reviewerId = reviewer.reviewerId;
    approval.reviewerName = reviewer.reviewerName;
    approval.comments = input.comments;
    approval.approvalHistory.push({
      status: 'Approved',
      transitionAt: now,
      actorId: reviewer.reviewerId,
      actorName: reviewer.reviewerName,
      comments: input.comments,
    });
    await approval.save();

    // Transition settlement status
    settlement.status = 'Approved';
    await settlement.save();

    // Append audit records
    await auditService.append({
      action: 'APPROVAL_APPROVED',
      entityType: 'Approval',
      entityId: String(approval._id),
      settlementId: approval.settlementId,
      actorId: reviewer.reviewerId,
      description: `Settlement approval request approved by reviewer ${reviewer.reviewerName ?? reviewer.reviewerId}`,
      reason: input.comments,
      after: { approvalStatus: 'Approved' },
    });

    await auditService.append({
      action: 'SETTLEMENT_STATUS_UPDATED',
      entityType: 'Settlement',
      entityId: String(settlement._id),
      settlementId: approval.settlementId,
      actorId: reviewer.reviewerId,
      description: `Settlement status transitioned from '${previousSettlementStatus}' to 'Approved' via human approval`,
      before: { status: previousSettlementStatus },
      after: { status: 'Approved' },
    });

    return approval;
  },

  // 5. Reject settlement
  async reject(
    id: string,
    input: RejectApprovalInput,
    reviewer: ReviewerIdentity
  ): Promise<ApprovalDocument> {
    const approval = await ApprovalModel.findById(id);
    if (!approval) {
      throw new AppError(404, 'APPROVAL_NOT_FOUND', `Approval request '${id}' not found`);
    }

    if (approval.approvalStatus === 'Rejected') {
      throw new AppError(
        400,
        'ALREADY_REJECTED',
        'Approval request has already been rejected'
      );
    }
    if (approval.approvalStatus === 'Approved') {
      throw new AppError(
        400,
        'ALREADY_APPROVED',
        'Cannot reject an already approved request'
      );
    }
    if (approval.approvalStatus === 'Cancelled') {
      throw new AppError(
        400,
        'REQUEST_CANCELLED',
        'Cannot reject a cancelled request'
      );
    }
    if (approval.approvalStatus !== 'Pending') {
      throw new AppError(
        400,
        'INVALID_APPROVAL_STATUS',
        `Cannot reject request with status '${approval.approvalStatus}'`
      );
    }

    const settlement = await SettlementModel.findById(approval.settlementId);
    if (!settlement) {
      throw new AppError(
        404,
        'SETTLEMENT_NOT_FOUND',
        `Settlement '${approval.settlementId}' not found`
      );
    }

    const previousSettlementStatus = settlement.status;
    const now = new Date();

    // Transition approval status
    approval.approvalStatus = 'Rejected';
    approval.reviewedAt = now;
    approval.reviewerId = reviewer.reviewerId;
    approval.reviewerName = reviewer.reviewerName;
    approval.comments = input.comments;
    approval.rejectionReason = input.rejectionReason;
    approval.approvalHistory.push({
      status: 'Rejected',
      transitionAt: now,
      actorId: reviewer.reviewerId,
      actorName: reviewer.reviewerName,
      reason: input.rejectionReason,
      comments: input.comments,
    });
    await approval.save();

    // Transition settlement status
    settlement.status = 'Rejected';
    settlement.requiresReviewReason = input.rejectionReason;
    await settlement.save();

    // Append audit records
    await auditService.append({
      action: 'APPROVAL_REJECTED',
      entityType: 'Approval',
      entityId: String(approval._id),
      settlementId: approval.settlementId,
      actorId: reviewer.reviewerId,
      description: `Settlement rejected by reviewer ${reviewer.reviewerName ?? reviewer.reviewerId}`,
      reason: input.rejectionReason,
      after: { approvalStatus: 'Rejected', rejectionReason: input.rejectionReason },
    });

    await auditService.append({
      action: 'SETTLEMENT_STATUS_UPDATED',
      entityType: 'Settlement',
      entityId: String(settlement._id),
      settlementId: approval.settlementId,
      actorId: reviewer.reviewerId,
      description: `Settlement status transitioned from '${previousSettlementStatus}' to 'Rejected' via human review`,
      before: { status: previousSettlementStatus },
      after: { status: 'Rejected' },
    });

    return approval;
  },

  // 6. Cancel pending approval
  async cancel(
    id: string,
    input: CancelApprovalInput,
    reviewer: ReviewerIdentity
  ): Promise<ApprovalDocument> {
    const approval = await ApprovalModel.findById(id);
    if (!approval) {
      throw new AppError(404, 'APPROVAL_NOT_FOUND', `Approval request '${id}' not found`);
    }

    if (approval.approvalStatus !== 'Pending') {
      throw new AppError(
        400,
        'INVALID_APPROVAL_STATUS',
        `Cannot cancel an approval request with status '${approval.approvalStatus}'`
      );
    }

    const now = new Date();
    approval.approvalStatus = 'Cancelled';
    approval.approvalHistory.push({
      status: 'Cancelled',
      transitionAt: now,
      actorId: reviewer.reviewerId,
      comments: input.reason,
    });
    await approval.save();

    await auditService.append({
      action: 'APPROVAL_CANCELLED',
      entityType: 'Approval',
      entityId: String(approval._id),
      settlementId: approval.settlementId,
      actorId: reviewer.reviewerId,
      description: `Approval request cancelled by ${reviewer.reviewerName ?? reviewer.reviewerId}`,
      reason: input.reason,
      after: { approvalStatus: 'Cancelled' },
    });

    return approval;
  },
};
