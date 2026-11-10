import { Types } from 'mongoose';
import request from 'supertest';
import app from '../src/app';
import { ApprovalModel } from '../src/modules/approvals/approval.model';
import { AuditLogModel } from '../src/modules/audit/audit.model';
import { SettlementModel } from '../src/modules/settlement/settlement.model';

const validSettlementId = '60d5ec49f1b2c82b88abcdef';
const validDecisionId = '60d5ec49f1b2c82b88333333';
const validApprovalId = '60d5ec49f1b2c82b88222222';
const nonExistentId = '60d5ec49f1b2c82b88000000';

const mockApprovalDoc = {
  _id: validApprovalId,
  settlementId: new Types.ObjectId(validSettlementId),
  policyDecisionId: new Types.ObjectId(validDecisionId),
  approvalStatus: 'Pending',
  requestedAt: new Date(),
  reviewedAt: undefined as Date | undefined,
  reviewerId: undefined as string | undefined,
  reviewerName: undefined as string | undefined,
  comments: 'Requires manual review',
  rejectionReason: undefined as string | undefined,
  approvalHistory: [
    {
      status: 'Pending',
      transitionAt: new Date(),
      reason: 'Policy review triggered',
    },
  ],
  save: jest.fn().mockResolvedValue(true),
};

const mockSettlementDoc = {
  _id: validSettlementId,
  paymentId: 'PAY-APP-001',
  status: 'RequiresReview',
  save: jest.fn().mockResolvedValue(true),
};

describe('Human Approval Workflow & Audit Trail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);
  });

  // ================================================================== 1. List & Pending Approvals

  describe('1. Approvals Retrieval', () => {
    it('1.1 lists all approvals with pagination', async () => {
      jest.spyOn(ApprovalModel, 'find').mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({ lean: () => Promise.resolve([mockApprovalDoc]) }),
          }),
        }),
      } as never);
      jest.spyOn(ApprovalModel, 'countDocuments').mockResolvedValueOnce(1);

      const res = await request(app).get('/api/approvals?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(1);
    });

    it('1.2 lists pending approvals', async () => {
      jest.spyOn(ApprovalModel, 'find').mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({ lean: () => Promise.resolve([mockApprovalDoc]) }),
          }),
        }),
      } as never);
      jest.spyOn(ApprovalModel, 'countDocuments').mockResolvedValueOnce(1);

      const res = await request(app).get('/api/approvals/pending');
      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.data[0].approvalStatus).toBe('Pending');
    });

    it('1.3 retrieves approval by ID', async () => {
      jest.spyOn(ApprovalModel, 'findById').mockReturnValue({
        lean: () => Promise.resolve(mockApprovalDoc),
      } as never);

      const res = await request(app).get(`/api/approvals/${validApprovalId}`);
      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(validApprovalId);
    });

    it('1.4 returns 404 for non-existent approval ID', async () => {
      jest.spyOn(ApprovalModel, 'findById').mockReturnValue({
        lean: () => Promise.resolve(null),
      } as never);

      const res = await request(app).get(`/api/approvals/${nonExistentId}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('APPROVAL_NOT_FOUND');
    });
  });

  // ================================================================== 2. Approve Workflow

  describe('2. POST /api/approvals/:id/approve', () => {
    it('2.1 successfully approves a pending settlement request and updates settlement lifecycle', async () => {
      const approvalInstance = {
        ...mockApprovalDoc,
        approvalStatus: 'Pending',
        approvalHistory: [...mockApprovalDoc.approvalHistory],
        save: jest.fn().mockResolvedValue(true),
      };
      const settlementInstance = {
        ...mockSettlementDoc,
        status: 'RequiresReview',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ApprovalModel, 'findById').mockResolvedValueOnce(approvalInstance as never);
      jest.spyOn(SettlementModel, 'findById').mockResolvedValueOnce(settlementInstance as never);

      const res = await request(app)
        .post(`/api/approvals/${validApprovalId}/approve`)
        .set('x-user-id', 'REV-101')
        .set('x-user-name', 'Alice Reviewer')
        .send({ comments: 'Reviewed breach metrics and approved for payout' });

      expect(res.status).toBe(200);
      expect(approvalInstance.approvalStatus).toBe('Approved');
      expect(approvalInstance.reviewerId).toBe('REV-101');
      expect(settlementInstance.status).toBe('Approved');
      expect(approvalInstance.save).toHaveBeenCalled();
      expect(settlementInstance.save).toHaveBeenCalled();
    });

    it('2.2 prevents approving an already approved request', async () => {
      const alreadyApproved = {
        ...mockApprovalDoc,
        approvalStatus: 'Approved',
      };
      jest.spyOn(ApprovalModel, 'findById').mockResolvedValueOnce(alreadyApproved as never);

      const res = await request(app)
        .post(`/api/approvals/${validApprovalId}/approve`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_APPROVED');
    });

    it('2.3 prevents approving an already rejected request', async () => {
      const alreadyRejected = {
        ...mockApprovalDoc,
        approvalStatus: 'Rejected',
      };
      jest.spyOn(ApprovalModel, 'findById').mockResolvedValueOnce(alreadyRejected as never);

      const res = await request(app)
        .post(`/api/approvals/${validApprovalId}/approve`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_REJECTED');
    });

    it('2.4 prevents approving a blocked settlement', async () => {
      const pendingApproval = {
        ...mockApprovalDoc,
        approvalStatus: 'Pending',
      };
      const blockedSettlement = {
        ...mockSettlementDoc,
        status: 'Blocked',
      };

      jest.spyOn(ApprovalModel, 'findById').mockResolvedValueOnce(pendingApproval as never);
      jest.spyOn(SettlementModel, 'findById').mockResolvedValueOnce(blockedSettlement as never);

      const res = await request(app)
        .post(`/api/approvals/${validApprovalId}/approve`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SETTLEMENT_BLOCKED');
    });
  });

  // ================================================================== 3. Reject Workflow

  describe('3. POST /api/approvals/:id/reject', () => {
    it('3.1 successfully rejects a pending settlement with reason', async () => {
      const approvalInstance = {
        ...mockApprovalDoc,
        approvalStatus: 'Pending',
        approvalHistory: [...mockApprovalDoc.approvalHistory],
        save: jest.fn().mockResolvedValue(true),
      };
      const settlementInstance = {
        ...mockSettlementDoc,
        status: 'RequiresReview',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ApprovalModel, 'findById').mockResolvedValueOnce(approvalInstance as never);
      jest.spyOn(SettlementModel, 'findById').mockResolvedValueOnce(settlementInstance as never);

      const res = await request(app)
        .post(`/api/approvals/${validApprovalId}/reject`)
        .send({
          rejectionReason: 'Breach telemetry does not support credit calculation',
          comments: 'Follow up with vendor requested',
        });

      expect(res.status).toBe(200);
      expect(approvalInstance.approvalStatus).toBe('Rejected');
      expect(approvalInstance.rejectionReason).toBe('Breach telemetry does not support credit calculation');
      expect(settlementInstance.status).toBe('Rejected');
    });

    it('3.2 requires rejectionReason when rejecting a settlement', async () => {
      const res = await request(app)
        .post(`/api/approvals/${validApprovalId}/reject`)
        .send({ comments: 'Just a comment with no reason' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('3.3 prevents rejecting an already approved request', async () => {
      const alreadyApproved = {
        ...mockApprovalDoc,
        approvalStatus: 'Approved',
      };
      jest.spyOn(ApprovalModel, 'findById').mockResolvedValueOnce(alreadyApproved as never);

      const res = await request(app)
        .post(`/api/approvals/${validApprovalId}/reject`)
        .send({ rejectionReason: 'Too late' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_APPROVED');
    });
  });

  // ================================================================== 4. Cancel & Audit Trail

  describe('4. Cancel & Settlement Audit Trail', () => {
    it('4.1 cancels a pending approval request', async () => {
      const approvalInstance = {
        ...mockApprovalDoc,
        approvalStatus: 'Pending',
        approvalHistory: [...mockApprovalDoc.approvalHistory],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(ApprovalModel, 'findById').mockResolvedValueOnce(approvalInstance as never);

      const res = await request(app)
        .post(`/api/approvals/${validApprovalId}/cancel`)
        .send({ reason: 'Re-evaluating with newer monitoring period' });

      expect(res.status).toBe(200);
      expect(approvalInstance.approvalStatus).toBe('Cancelled');
    });

    it('4.2 prevents cancelling an already approved or rejected request', async () => {
      const alreadyApproved = {
        ...mockApprovalDoc,
        approvalStatus: 'Approved',
      };
      jest.spyOn(ApprovalModel, 'findById').mockResolvedValueOnce(alreadyApproved as never);

      const res = await request(app)
        .post(`/api/approvals/${validApprovalId}/cancel`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_APPROVAL_STATUS');
    });

    it('4.3 retrieves complete audit trail for a settlement via /settlements/:id/audit', async () => {
      const mockAuditLogs = [
        {
          _id: '60d5ec49f1b2c82b88444441',
          action: 'POLICY_EVALUATED',
          entityType: 'PolicyDecision',
          settlementId: validSettlementId,
          description: 'Policy evaluation v1 completed',
          timestamp: new Date(),
        },
        {
          _id: '60d5ec49f1b2c82b88444442',
          action: 'APPROVAL_APPROVED',
          entityType: 'Approval',
          settlementId: validSettlementId,
          description: 'Settlement approved by reviewer',
          timestamp: new Date(),
        },
      ];

      jest.spyOn(AuditLogModel, 'find').mockReturnValue({
        sort: () => ({ lean: () => Promise.resolve(mockAuditLogs) }),
      } as never);

      const res = await request(app).get(`/api/settlements/${validSettlementId}/audit`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].action).toBe('POLICY_EVALUATED');
    });
  });
});
