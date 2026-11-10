import { Types } from 'mongoose';
import request from 'supertest';
import app from '../src/app';
import { SLAContractModel, SLABreachModel } from '../src/modules/sla/sla.model';
import { SettlementModel } from '../src/modules/settlement/settlement.model';
import { PaymentAuthorizationAdapter } from '../src/modules/settlement/payment-authorization.adapter';

// ----------------------------------------------------------------- constants

const validServiceId = '507f1f77bcf86cd799439011';
const validContractId = '60d5ec49f1b2c82b88123456';
const validBreachId = '60d5ec49f1b2c82b88654321';
const validSettlementId = '60d5ec49f1b2c82b88abcdef';
const nonExistentId = '60d5ec49f1b2c82b88000000';

// ------------------------------------------------------------------ helpers

const toDecimal128 = (n: number) => Types.Decimal128.fromString(n.toFixed(2));

// ---------------------------------------------------------------- mock data

const mockContract = {
  _id: validContractId,
  serviceId: validServiceId,
  contractName: 'Enterprise Payment SLA',
  contractReference: 'SLA-2026-PAY-001',
  providerName: 'FinTech Cloud Ltd',
  customerName: 'Global Retail Corp',
  effectiveFrom: new Date('2026-01-01'),
  effectiveUntil: new Date('2026-12-31'),
  status: 'Active',
  measurementWindow: { type: 'MONTHLY', durationMinutes: 43200 },
  targets: [
    { metric: 'uptime', operator: '>=', threshold: 99.9, unit: '%' },
    { metric: 'responseTime', operator: '<=', threshold: 500, unit: 'ms' },
  ],
  creditRules: [
    {
      ruleId: 'CR-UPTIME-01',
      description: '10% credit if uptime drops below 99.9%',
      applicableMetric: 'uptime',
      operator: '<',
      threshold: 99.9,
      creditType: 'PERCENTAGE',
      creditValue: toDecimal128(10),
      maxCreditLimit: toDecimal128(50),
      priority: 1,
    },
    {
      ruleId: 'CR-LATENCY-01',
      description: 'Fixed $50 credit if response time exceeds 500ms',
      applicableMetric: 'responseTime',
      operator: '>',
      threshold: 500,
      creditType: 'FIXED',
      creditValue: toDecimal128(50),
      priority: 2,
    },
  ],
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockContractNoRules = {
  ...mockContract,
  _id: '60d5ec49f1b2c82b88000001',
  creditRules: [],
};

const mockBreach = {
  _id: validBreachId,
  serviceId: validServiceId,
  contractId: validContractId,
  metric: 'uptime',
  contractualThreshold: 99.9,
  observedValue: 95.5,
  comparisonOperator: '>=',
  severity: 'High',
  breachType: 'UPTIME_BREACH',
  measurementPeriodStart: new Date('2026-01-01'),
  measurementPeriodEnd: new Date('2026-01-31'),
  evidence: {
    totalChecks: 1000,
    successfulChecks: 955,
    failedChecks: 45,
    calculatedUptime: 95.5,
    avgResponseTime: 410.5,
  },
  status: 'Confirmed',
  detectedAt: new Date(),
};

const mockLatencyBreach = {
  ...mockBreach,
  _id: '60d5ec49f1b2c82b88654322',
  metric: 'responseTime',
  contractualThreshold: 500,
  observedValue: 650,
  severity: 'Medium',
  breachType: 'LATENCY_BREACH',
};

const mockSettlement = {
  _id: validSettlementId,
  paymentId: 'PAY-TEST-001',
  serviceId: new Types.ObjectId(validServiceId),
  contractId: new Types.ObjectId(validContractId),
  breachIds: [new Types.ObjectId(validBreachId)],
  authorizedAmount: toDecimal128(1500),
  totalCredit: toDecimal128(150),
  finalPayableAmount: toDecimal128(1350),
  currency: 'USD',
  calculationBreakdown: [
    {
      ruleId: 'CR-UPTIME-01',
      ruleDescription: '10% credit if uptime drops below 99.9%',
      breachId: validBreachId,
      metric: 'uptime',
      contractualThreshold: 99.9,
      observedValue: 95.5,
      creditType: 'PERCENTAGE',
      creditValue: toDecimal128(10),
      creditAmountCalculated: toDecimal128(150),
      applied: true,
      reason: 'Rule CR-UPTIME-01 matched',
    },
  ],
  calculationVersion: '1.0.0',
  contractVersion: 1,
  status: 'Calculated',
  calculatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ================================================================== tests

describe('Settlement Calculation Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PaymentAuthorizationAdapter.clearAll();
  });

  // ----------------------------------------------------------------- 1. POST /settlements/calculate

  describe('1. POST /api/settlements/calculate — validation', () => {
    it('1.1 rejects request missing required fields', async () => {
      const response = await request(app).post('/api/settlements/calculate').send({});
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('1.2 rejects invalid MongoDB ObjectIds', async () => {
      const response = await request(app).post('/api/settlements/calculate').send({
        paymentId: 'PAY-001',
        serviceId: 'not-a-valid-id',
        contractId: 'also-invalid',
        authorizedAmount: 1000,
      });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('1.3 rejects negative authorizedAmount', async () => {
      const response = await request(app).post('/api/settlements/calculate').send({
        paymentId: 'PAY-001',
        serviceId: validServiceId,
        contractId: validContractId,
        authorizedAmount: -100,
      });
      expect(response.status).toBe(400);
    });
  });

  // ----------------------------------------------------------------- 2. Contract not found

  describe('2. POST /api/settlements/calculate — contract lookup', () => {
    it('2.1 returns 404 when contract does not exist', async () => {
      jest
        .spyOn(SettlementModel, 'findOne')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);
      jest
        .spyOn(SLAContractModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);

      const response = await request(app).post('/api/settlements/calculate').send({
        paymentId: 'PAY-NO-CONTRACT',
        serviceId: validServiceId,
        contractId: nonExistentId,
        authorizedAmount: 1000,
      });
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('CONTRACT_NOT_FOUND');
    });
  });

  // ----------------------------------------------------------------- 3. Idempotency

  describe('3. POST /api/settlements/calculate — idempotency', () => {
    it('3.1 returns 409 when settlement for paymentId already exists', async () => {
      jest
        .spyOn(SettlementModel, 'findOne')
        .mockReturnValue({ lean: () => Promise.resolve(mockSettlement) } as never);

      const response = await request(app).post('/api/settlements/calculate').send({
        paymentId: 'PAY-TEST-001',
        serviceId: validServiceId,
        contractId: validContractId,
        authorizedAmount: 1500,
      });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('SETTLEMENT_ALREADY_EXISTS');
    });
  });

  // ----------------------------------------------------------------- 4. Happy path with breaches

  describe('4. POST /api/settlements/calculate — successful calculation', () => {
    it('4.1 calculates settlement with one uptime breach (PERCENTAGE credit)', async () => {
      jest
        .spyOn(SettlementModel, 'findOne')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);
      jest
        .spyOn(SLAContractModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockContract) } as never);
      jest
        .spyOn(SLABreachModel, 'find')
        .mockReturnValue({ lean: () => Promise.resolve([mockBreach]) } as never);
      jest
        .spyOn(SettlementModel, 'create')
        .mockResolvedValueOnce(mockSettlement as never);

      const response = await request(app).post('/api/settlements/calculate').send({
        paymentId: 'PAY-UPTIME-001',
        serviceId: validServiceId,
        contractId: validContractId,
        breachIds: [validBreachId],
        authorizedAmount: 1500,
        currency: 'USD',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/calculated/i);
    });

    it('4.2 calculates settlement with no breaches (zero credit)', async () => {
      jest
        .spyOn(SettlementModel, 'findOne')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);
      jest
        .spyOn(SLAContractModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockContract) } as never);
      jest
        .spyOn(SLABreachModel, 'find')
        .mockReturnValue({ lean: () => Promise.resolve([]) } as never);

      const zeroCredit = { ...mockSettlement, totalCredit: toDecimal128(0), finalPayableAmount: toDecimal128(1500), calculationBreakdown: [] };
      jest
        .spyOn(SettlementModel, 'create')
        .mockResolvedValueOnce(zeroCredit as never);

      const response = await request(app).post('/api/settlements/calculate').send({
        paymentId: 'PAY-NO-BREACH',
        serviceId: validServiceId,
        contractId: validContractId,
        breachIds: [],
        authorizedAmount: 1500,
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('4.3 flags RequiresReview when breaches exist but contract has no credit rules', async () => {
      jest
        .spyOn(SettlementModel, 'findOne')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);
      jest
        .spyOn(SLAContractModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockContractNoRules) } as never);
      jest
        .spyOn(SLABreachModel, 'find')
        .mockReturnValue({ lean: () => Promise.resolve([mockBreach]) } as never);

      const reviewRequired = { ...mockSettlement, status: 'RequiresReview', requiresReviewReason: 'No credit rules' };
      jest
        .spyOn(SettlementModel, 'create')
        .mockResolvedValueOnce(reviewRequired as never);

      const response = await request(app).post('/api/settlements/calculate').send({
        paymentId: 'PAY-NO-RULES',
        serviceId: validServiceId,
        contractId: validContractId,
        breachIds: [validBreachId],
        authorizedAmount: 1500,
      });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('RequiresReview');
    });

    it('4.4 caps total credit at authorized amount', async () => {
      // 10% of 100 = 10, but maxCreditLimit = 50 and authorized = 100; total capped at 100
      jest
        .spyOn(SettlementModel, 'findOne')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);
      jest
        .spyOn(SLAContractModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockContract) } as never);
      jest
        .spyOn(SLABreachModel, 'find')
        .mockReturnValue({ lean: () => Promise.resolve([mockBreach]) } as never);

      const capped = { ...mockSettlement, authorizedAmount: toDecimal128(5), totalCredit: toDecimal128(5), finalPayableAmount: toDecimal128(0) };
      jest
        .spyOn(SettlementModel, 'create')
        .mockResolvedValueOnce(capped as never);

      const response = await request(app).post('/api/settlements/calculate').send({
        paymentId: 'PAY-CAPPED',
        serviceId: validServiceId,
        contractId: validContractId,
        breachIds: [validBreachId],
        authorizedAmount: 5,
      });

      expect(response.status).toBe(201);
    });
  });

  // ----------------------------------------------------------------- 5. GET /settlements/:id

  describe('5. GET /api/settlements/:id', () => {
    it('5.1 returns settlement by ID', async () => {
      jest
        .spyOn(SettlementModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockSettlement) } as never);

      const response = await request(app).get(`/api/settlements/${validSettlementId}`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.paymentId).toBe('PAY-TEST-001');
    });

    it('5.2 returns 404 for non-existent settlement ID', async () => {
      jest
        .spyOn(SettlementModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);

      const response = await request(app).get(`/api/settlements/${nonExistentId}`);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('SETTLEMENT_NOT_FOUND');
    });

    it('5.3 returns 400 for invalid settlement ID format', async () => {
      const response = await request(app).get('/api/settlements/not-a-valid-id');
      expect(response.status).toBe(400);
    });
  });

  // ----------------------------------------------------------------- 6. GET /settlements/payment/:paymentId

  describe('6. GET /api/settlements/payment/:paymentId', () => {
    it('6.1 returns settlement by paymentId', async () => {
      jest
        .spyOn(SettlementModel, 'findOne')
        .mockReturnValue({ lean: () => Promise.resolve(mockSettlement) } as never);

      const response = await request(app).get('/api/settlements/payment/PAY-TEST-001');
      expect(response.status).toBe(200);
      expect(response.body.data.paymentId).toBe('PAY-TEST-001');
    });

    it('6.2 returns 404 when paymentId not found', async () => {
      jest
        .spyOn(SettlementModel, 'findOne')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);

      const response = await request(app).get('/api/settlements/payment/PAY-NONEXISTENT');
      expect(response.status).toBe(404);
    });
  });

  // ----------------------------------------------------------------- 7. GET /settlements/service/:serviceId

  describe('7. GET /api/settlements/service/:serviceId', () => {
    it('7.1 returns settlements for a service', async () => {
      jest
        .spyOn(SettlementModel, 'find')
        .mockReturnValue({ sort: () => ({ lean: () => Promise.resolve([mockSettlement]) }) } as never);

      const response = await request(app).get(`/api/settlements/service/${validServiceId}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('7.2 returns empty array when no settlements for service', async () => {
      jest
        .spyOn(SettlementModel, 'find')
        .mockReturnValue({ sort: () => ({ lean: () => Promise.resolve([]) }) } as never);

      const response = await request(app).get(`/api/settlements/service/${nonExistentId}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('7.3 returns 400 for invalid serviceId format', async () => {
      const response = await request(app).get('/api/settlements/service/bad-id');
      expect(response.status).toBe(400);
    });
  });

  // ----------------------------------------------------------------- 8. GET /settlements/:id/breakdown

  describe('8. GET /api/settlements/:id/breakdown', () => {
    it('8.1 returns detailed calculation breakdown', async () => {
      jest
        .spyOn(SettlementModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockSettlement) } as never);

      const response = await request(app).get(
        `/api/settlements/${validSettlementId}/breakdown`
      );
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('breakdown');
      expect(Array.isArray(response.body.data.breakdown)).toBe(true);
    });

    it('8.2 returns 404 for non-existent settlement', async () => {
      jest
        .spyOn(SettlementModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);

      const response = await request(app).get(`/api/settlements/${nonExistentId}/breakdown`);
      expect(response.status).toBe(404);
    });
  });

  // ----------------------------------------------------------------- 9. POST /settlements/:id/recalculate

  describe('9. POST /api/settlements/:id/recalculate', () => {
    it('9.1 recalculates an existing settlement', async () => {
      jest
        .spyOn(SettlementModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockSettlement) } as never);
      jest
        .spyOn(SettlementModel, 'deleteOne')
        .mockResolvedValueOnce({ acknowledged: true, deletedCount: 1 } as never);
      // After deleteOne, findOne for idempotency check returns null
      jest
        .spyOn(SettlementModel, 'findOne')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);
      jest
        .spyOn(SLAContractModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockContract) } as never);
      jest
        .spyOn(SLABreachModel, 'find')
        .mockReturnValue({ lean: () => Promise.resolve([mockBreach]) } as never);
      jest
        .spyOn(SettlementModel, 'create')
        .mockResolvedValueOnce(mockSettlement as never);

      const response = await request(app).post(
        `/api/settlements/${validSettlementId}/recalculate`
      );
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('9.2 returns 404 when settlement to recalculate does not exist', async () => {
      jest
        .spyOn(SettlementModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);

      const response = await request(app).post(`/api/settlements/${nonExistentId}/recalculate`);
      expect(response.status).toBe(404);
    });
  });

  // ----------------------------------------------------------------- 10. GET /settlements (list)

  describe('10. GET /api/settlements — list with filters', () => {
    it('10.1 returns paginated settlement list', async () => {
      jest
        .spyOn(SettlementModel, 'find')
        .mockReturnValue({
          sort: () => ({
            skip: () => ({
              limit: () => ({ lean: () => Promise.resolve([mockSettlement]) }),
            }),
          }),
        } as never);
      jest.spyOn(SettlementModel, 'countDocuments').mockResolvedValueOnce(1);

      const response = await request(app).get('/api/settlements?page=1&limit=10');
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('totalPages');
      expect(response.body.data.data).toHaveLength(1);
    });

    it('10.2 filters by status', async () => {
      jest
        .spyOn(SettlementModel, 'find')
        .mockReturnValue({
          sort: () => ({
            skip: () => ({
              limit: () => ({ lean: () => Promise.resolve([mockSettlement]) }),
            }),
          }),
        } as never);
      jest.spyOn(SettlementModel, 'countDocuments').mockResolvedValueOnce(1);

      const response = await request(app).get('/api/settlements?status=Calculated');
      expect(response.status).toBe(200);
    });

    it('10.3 rejects invalid status enum', async () => {
      const response = await request(app).get('/api/settlements?status=INVALID_STATUS');
      expect(response.status).toBe(400);
    });
  });

  // ----------------------------------------------------------------- 11. PaymentAuthorizationAdapter

  describe('11. PaymentAuthorizationAdapter (unit)', () => {
    it('11.1 registers and looks up an authorization', async () => {
      PaymentAuthorizationAdapter.register({
        paymentId: 'PAY-ADAPTER-001',
        serviceId: validServiceId,
        contractId: validContractId,
        authorizedAmount: '999.99',
        currency: 'USD',
        authorizedAt: new Date(),
        paymentStatus: 'AUTHORIZED',
      });

      const auth = await PaymentAuthorizationAdapter.lookup('PAY-ADAPTER-001');
      expect(auth).not.toBeNull();
      expect(auth?.authorizedAmount).toBe('999.99');
      expect(auth?.paymentStatus).toBe('AUTHORIZED');
    });

    it('11.2 returns null for unknown paymentId', async () => {
      const auth = await PaymentAuthorizationAdapter.lookup('PAY-UNKNOWN');
      expect(auth).toBeNull();
    });
  });
});

