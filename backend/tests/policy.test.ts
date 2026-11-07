import { Types } from 'mongoose';
import request from 'supertest';
import app from '../src/app';
import { ApprovalModel } from '../src/modules/approvals/approval.model';
import { AuditLogModel } from '../src/modules/audit/audit.model';
import { PolicyDecisionModel, PolicyModel } from '../src/modules/policy/policy.model';
import { compareValues, evaluateConditionGroup } from '../src/modules/policy/policy.service';
import { ServiceModel } from '../src/modules/services/service.model';
import { PaymentAuthorizationAdapter } from '../src/modules/settlement/payment-authorization.adapter';
import { SettlementModel } from '../src/modules/settlement/settlement.model';
import { SLABreachModel, SLAContractModel } from '../src/modules/sla/sla.model';

const validServiceId = '507f1f77bcf86cd799439011';
const validContractId = '60d5ec49f1b2c82b88123456';
const validSettlementId = '60d5ec49f1b2c82b88abcdef';
const validPolicyId = '60d5ec49f1b2c82b88111111';
const nonExistentId = '60d5ec49f1b2c82b88000000';

const toDecimal128 = (n: number) => Types.Decimal128.fromString(n.toFixed(2));

const mockPolicyPayload = {
  name: 'Auto Approve Low Value',
  description: 'Automatically approve settlements below $100',
  policyCode: 'POL-AUTO-LOW',
  category: 'Financial' as const,
  priority: 1,
  enabled: true,
  scope: 'Global' as const,
  conditions: {
    logicalOperator: 'AND' as const,
    rules: [
      {
        field: 'authorizedAmount',
        operator: 'LESS_THAN_OR_EQUAL' as const,
        value: 100,
      },
    ],
  },
  action: 'APPROVE' as const,
  reason: 'Low value settlements are eligible for automatic approval',
};

const mockPolicyDoc = {
  _id: validPolicyId,
  ...mockPolicyPayload,
  version: 1,
  versionHistory: [] as unknown[],
  createdAt: new Date(),
  updatedAt: new Date(),
  save: jest.fn().mockResolvedValue(true),
};

const mockSettlementDoc = {
  _id: validSettlementId,
  paymentId: 'PAY-POL-001',
  serviceId: new Types.ObjectId(validServiceId),
  contractId: new Types.ObjectId(validContractId),
  breachIds: [],
  authorizedAmount: toDecimal128(80),
  totalCredit: toDecimal128(10),
  finalPayableAmount: toDecimal128(70),
  currency: 'USD',
  calculationBreakdown: [],
  calculationVersion: '1.0.0',
  contractVersion: 1,
  status: 'Calculated',
  calculatedAt: new Date(),
};

describe('Policy Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PaymentAuthorizationAdapter.clearAll();
    jest.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);
    jest.spyOn(ApprovalModel, 'findOne').mockReturnValue({ lean: () => Promise.resolve(null) } as never);
    jest.spyOn(ApprovalModel, 'create').mockResolvedValue({ _id: new Types.ObjectId('60d5ec49f1b2c82b88222222') } as never);
    jest.spyOn(ApprovalModel, 'updateOne').mockResolvedValue({ acknowledged: true } as never);
    jest.spyOn(SettlementModel, 'updateOne').mockResolvedValue({ acknowledged: true } as never);
    jest.spyOn(PolicyDecisionModel, 'countDocuments').mockResolvedValue(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(PolicyDecisionModel, 'create').mockImplementation((doc: any) =>
      Promise.resolve({
        _id: new Types.ObjectId('60d5ec49f1b2c82b88333333'),
        ...doc,
      } as never)
    );
  });

  // ================================================================== 1. Condition Evaluator Unit Tests

  describe('1. Condition Evaluator (Unit)', () => {
    it('1.1 correctly evaluates EQUALS and NOT_EQUALS', () => {
      expect(compareValues('Active', 'EQUALS', 'active')).toBe(true);
      expect(compareValues('Draft', 'EQUALS', 'active')).toBe(false);
      expect(compareValues('Draft', 'NOT_EQUALS', 'active')).toBe(true);
    });

    it('1.2 correctly evaluates numeric inequalities', () => {
      expect(compareValues(150, 'GREATER_THAN', 100)).toBe(true);
      expect(compareValues(100, 'GREATER_THAN', 100)).toBe(false);
      expect(compareValues(100, 'GREATER_THAN_OR_EQUAL', 100)).toBe(true);
      expect(compareValues(50, 'LESS_THAN', 100)).toBe(true);
      expect(compareValues(100, 'LESS_THAN_OR_EQUAL', 100)).toBe(true);
    });

    it('1.3 correctly evaluates IN and NOT_IN', () => {
      expect(compareValues('High', 'IN', ['Low', 'Medium', 'High'])).toBe(true);
      expect(compareValues('Critical', 'IN', ['Low', 'Medium', 'High'])).toBe(false);
      expect(compareValues('Critical', 'NOT_IN', ['Low', 'Medium', 'High'])).toBe(true);
      expect(compareValues(['High', 'Critical'], 'IN', ['Critical'])).toBe(true);
    });

    it('1.4 correctly evaluates condition groups with AND / OR', () => {
      const groupAnd = {
        logicalOperator: 'AND' as const,
        rules: [
          { field: 'authorizedAmount', operator: 'GREATER_THAN' as const, value: 50 },
          { field: 'currency', operator: 'EQUALS' as const, value: 'USD' },
        ],
      };
      expect(evaluateConditionGroup(groupAnd, { authorizedAmount: 100, currency: 'USD' }).matched).toBe(true);
      expect(evaluateConditionGroup(groupAnd, { authorizedAmount: 20, currency: 'USD' }).matched).toBe(false);

      const groupOr = {
        logicalOperator: 'OR' as const,
        rules: [
          { field: 'breachCount', operator: 'GREATER_THAN' as const, value: 0 },
          { field: 'creditPercentage', operator: 'GREATER_THAN' as const, value: 20 },
        ],
      };
      expect(evaluateConditionGroup(groupOr, { breachCount: 1, creditPercentage: 5 }).matched).toBe(true);
      expect(evaluateConditionGroup(groupOr, { breachCount: 0, creditPercentage: 25 }).matched).toBe(true);
      expect(evaluateConditionGroup(groupOr, { breachCount: 0, creditPercentage: 10 }).matched).toBe(false);
    });
  });

  // ================================================================== 2. Policy Management APIs

  describe('2. Policy Management APIs', () => {
    it('2.1 creates a valid policy successfully', async () => {
      jest.spyOn(PolicyModel, 'findOne').mockReturnValue({ lean: () => Promise.resolve(null) } as never);
      jest.spyOn(PolicyModel, 'create').mockResolvedValueOnce(mockPolicyDoc as never);

      const res = await request(app).post('/api/policies').send(mockPolicyPayload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.policyCode).toBe('POL-AUTO-LOW');
    });

    it('2.2 rejects invalid policy input (missing required fields)', async () => {
      const res = await request(app).post('/api/policies').send({ name: 'Incomplete' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('2.3 rejects duplicate policy codes with 409 Conflict', async () => {
      jest.spyOn(PolicyModel, 'findOne').mockReturnValue({ lean: () => Promise.resolve(mockPolicyDoc) } as never);

      const res = await request(app).post('/api/policies').send(mockPolicyPayload);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('POLICY_CODE_EXISTS');
    });

    it('2.4 updates a policy and preserves version history', async () => {
      const policyInstance = {
        ...mockPolicyDoc,
        version: 1,
        versionHistory: [] as unknown[],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(PolicyModel, 'findById').mockResolvedValueOnce(policyInstance as never);

      const res = await request(app)
        .patch(`/api/policies/${validPolicyId}`)
        .send({ priority: 2, reason: 'Updated priority reason' });

      expect(res.status).toBe(200);
      expect(policyInstance.version).toBe(2);
      expect(policyInstance.versionHistory).toHaveLength(1);
      expect(policyInstance.save).toHaveBeenCalled();
    });

    it('2.5 enables and disables a policy', async () => {
      const policyInstance = {
        ...mockPolicyDoc,
        enabled: true,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(PolicyModel, 'findById').mockResolvedValueOnce(policyInstance as never);

      const res = await request(app)
        .patch(`/api/policies/${validPolicyId}/status`)
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(policyInstance.enabled).toBe(false);
      expect(policyInstance.save).toHaveBeenCalled();
    });

    it('2.6 retrieves global and service-specific policies', async () => {
      jest.spyOn(PolicyModel, 'find').mockReturnValue({
        sort: () => ({ lean: () => Promise.resolve([mockPolicyDoc]) }),
      } as never);

      const res = await request(app).get(`/api/policies/service/${validServiceId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('2.7 lists policies with pagination', async () => {
      jest.spyOn(PolicyModel, 'find').mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({ lean: () => Promise.resolve([mockPolicyDoc]) }),
          }),
        }),
      } as never);
      jest.spyOn(PolicyModel, 'countDocuments').mockResolvedValueOnce(1);

      const res = await request(app).get('/api/policies?page=1&limit=10&category=Financial');
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
    });
  });

  // ================================================================== 3. Policy Evaluation Engine

  describe('3. Policy Evaluation Engine', () => {
    it('3.1 produces APPROVE when automatic approval condition matches', async () => {
      jest.spyOn(SettlementModel, 'findById').mockReturnValue({ lean: () => Promise.resolve(mockSettlementDoc) } as never);
      jest.spyOn(ServiceModel, 'findById').mockReturnValue({ lean: () => Promise.resolve({ environment: 'Production' }) } as never);
      jest.spyOn(SLAContractModel, 'findById').mockReturnValue({ lean: () => Promise.resolve({ status: 'Active' }) } as never);
      jest.spyOn(SLABreachModel, 'find').mockReturnValue({ lean: () => Promise.resolve([]) } as never);

      // Load 1 matching APPROVE policy
      jest.spyOn(PolicyModel, 'find').mockReturnValue({
        sort: () => ({ lean: () => Promise.resolve([mockPolicyDoc]) }),
      } as never);

      const res = await request(app).post(`/api/policies/evaluate/${validSettlementId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.decision.finalDecision).toBe('APPROVE');
    });

    it('3.2 produces REQUIRE_REVIEW when review policy matches', async () => {
      jest.spyOn(SettlementModel, 'findById').mockReturnValue({ lean: () => Promise.resolve(mockSettlementDoc) } as never);
      jest.spyOn(ServiceModel, 'findById').mockReturnValue({ lean: () => Promise.resolve({ environment: 'Production' }) } as never);
      jest.spyOn(SLAContractModel, 'findById').mockReturnValue({ lean: () => Promise.resolve({ status: 'Active' }) } as never);
      jest.spyOn(SLABreachModel, 'find').mockReturnValue({ lean: () => Promise.resolve([]) } as never);

      const reviewPolicy = {
        ...mockPolicyDoc,
        _id: '60d5ec49f1b2c82b88111112',
        action: 'REQUIRE_REVIEW',
        conditions: {
          logicalOperator: 'AND',
          rules: [{ field: 'totalCredit', operator: 'GREATER_THAN', value: 5 }],
        },
        reason: 'Credits exceed threshold',
      };

      jest.spyOn(PolicyModel, 'find').mockReturnValue({
        sort: () => ({ lean: () => Promise.resolve([reviewPolicy]) }),
      } as never);

      const res = await request(app).post(`/api/policies/evaluate/${validSettlementId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.decision.finalDecision).toBe('REQUIRE_REVIEW');
    });

    it('3.3 produces BLOCK when a blocking policy matches', async () => {
      jest.spyOn(SettlementModel, 'findById').mockReturnValue({ lean: () => Promise.resolve(mockSettlementDoc) } as never);
      jest.spyOn(ServiceModel, 'findById').mockReturnValue({ lean: () => Promise.resolve({ environment: 'Production' }) } as never);
      jest.spyOn(SLAContractModel, 'findById').mockReturnValue({ lean: () => Promise.resolve({ status: 'Active' }) } as never);
      jest.spyOn(SLABreachModel, 'find').mockReturnValue({ lean: () => Promise.resolve([]) } as never);

      const blockPolicy = {
        ...mockPolicyDoc,
        action: 'BLOCK',
        conditions: {
          logicalOperator: 'AND',
          rules: [{ field: 'paymentStatus', operator: 'EQUALS', value: 'UNKNOWN' }],
        },
        reason: 'Payment authorization missing',
      };

      jest.spyOn(PolicyModel, 'find').mockReturnValue({
        sort: () => ({ lean: () => Promise.resolve([blockPolicy]) }),
      } as never);

      const res = await request(app).post(`/api/policies/evaluate/${validSettlementId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.decision.finalDecision).toBe('BLOCK');
    });

    it('3.4 BLOCK takes precedence over APPROVE', async () => {
      jest.spyOn(SettlementModel, 'findById').mockReturnValue({ lean: () => Promise.resolve(mockSettlementDoc) } as never);
      jest.spyOn(ServiceModel, 'findById').mockReturnValue({ lean: () => Promise.resolve({ environment: 'Production' }) } as never);
      jest.spyOn(SLAContractModel, 'findById').mockReturnValue({ lean: () => Promise.resolve({ status: 'Active' }) } as never);
      jest.spyOn(SLABreachModel, 'find').mockReturnValue({ lean: () => Promise.resolve([]) } as never);

      const approvePolicy = { ...mockPolicyDoc, action: 'APPROVE', priority: 1 };
      const blockPolicy = {
        ...mockPolicyDoc,
        _id: '60d5ec49f1b2c82b88111113',
        action: 'BLOCK',
        priority: 2,
        reason: 'Mandatory safety block',
      };

      // Both match
      jest.spyOn(PolicyModel, 'find').mockReturnValue({
        sort: () => ({ lean: () => Promise.resolve([approvePolicy, blockPolicy]) }),
      } as never);

      const res = await request(app).post(`/api/policies/evaluate/${validSettlementId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.decision.finalDecision).toBe('BLOCK');
    });

    it('3.5 REQUIRE_REVIEW takes precedence over APPROVE', async () => {
      jest.spyOn(SettlementModel, 'findById').mockReturnValue({ lean: () => Promise.resolve(mockSettlementDoc) } as never);
      jest.spyOn(ServiceModel, 'findById').mockReturnValue({ lean: () => Promise.resolve({ environment: 'Production' }) } as never);
      jest.spyOn(SLAContractModel, 'findById').mockReturnValue({ lean: () => Promise.resolve({ status: 'Active' }) } as never);
      jest.spyOn(SLABreachModel, 'find').mockReturnValue({ lean: () => Promise.resolve([]) } as never);

      const approvePolicy = { ...mockPolicyDoc, action: 'APPROVE', priority: 1 };
      const reviewPolicy = {
        ...mockPolicyDoc,
        _id: '60d5ec49f1b2c82b88111114',
        action: 'REQUIRE_REVIEW',
        priority: 2,
        reason: 'Manual review required',
      };

      jest.spyOn(PolicyModel, 'find').mockReturnValue({
        sort: () => ({ lean: () => Promise.resolve([approvePolicy, reviewPolicy]) }),
      } as never);

      const res = await request(app).post(`/api/policies/evaluate/${validSettlementId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.decision.finalDecision).toBe('REQUIRE_REVIEW');
    });

    it('3.6 defaults to REQUIRE_REVIEW when no applicable policy exists/matches', async () => {
      jest.spyOn(SettlementModel, 'findById').mockReturnValue({ lean: () => Promise.resolve(mockSettlementDoc) } as never);
      jest.spyOn(ServiceModel, 'findById').mockReturnValue({ lean: () => Promise.resolve({ environment: 'Production' }) } as never);
      jest.spyOn(SLAContractModel, 'findById').mockReturnValue({ lean: () => Promise.resolve({ status: 'Active' }) } as never);
      jest.spyOn(SLABreachModel, 'find').mockReturnValue({ lean: () => Promise.resolve([]) } as never);

      // No policies in database
      jest.spyOn(PolicyModel, 'find').mockReturnValue({
        sort: () => ({ lean: () => Promise.resolve([]) }),
      } as never);

      const res = await request(app).post(`/api/policies/evaluate/${validSettlementId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.decision.finalDecision).toBe('REQUIRE_REVIEW');
    });

    it('3.7 rejects evaluation for non-existent settlement with 404', async () => {
      jest.spyOn(SettlementModel, 'findById').mockReturnValue({ lean: () => Promise.resolve(null) } as never);

      const res = await request(app).post(`/api/policies/evaluate/${nonExistentId}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SETTLEMENT_NOT_FOUND');
    });

    it('3.8 rejects evaluation when settlement is still in Draft status with 400', async () => {
      jest.spyOn(SettlementModel, 'findById').mockReturnValue({
        lean: () => Promise.resolve({ ...mockSettlementDoc, status: 'Draft' }),
      } as never);

      const res = await request(app).post(`/api/policies/evaluate/${validSettlementId}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SETTLEMENT_NOT_CALCULATED');
    });

    it('3.9 lists policy decisions', async () => {
      jest.spyOn(PolicyDecisionModel, 'find').mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([{ _id: '60d5ec49f1b2c82b88333333', finalDecision: 'APPROVE' }]),
            }),
          }),
        }),
      } as never);
      jest.spyOn(PolicyDecisionModel, 'countDocuments').mockResolvedValueOnce(1);

      const res = await request(app).get('/api/policies/decisions');
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
    });

    it('3.10 retrieves decision history for a settlement', async () => {
      jest.spyOn(PolicyDecisionModel, 'find').mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve([{ _id: '60d5ec49f1b2c82b88333333', evaluationVersion: 1 }]),
        }),
      } as never);

      const res = await request(app).get(`/api/policies/decisions/settlement/${validSettlementId}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });
});

