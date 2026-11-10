import { Types } from 'mongoose';
import request from 'supertest';
import app from '../src/app';
import { PerformanceMetricModel } from '../src/modules/monitoring/monitoring.model';
import { ServiceModel } from '../src/modules/services/service.model';
import { slaContractService } from '../src/modules/sla/sla-contract.service';
import { slaEvaluationService } from '../src/modules/sla/sla-evaluation.service';
import {
  SLABreachModel,
  SLAContractModel,
} from '../src/modules/sla/sla.model';

const validServiceId = '507f1f77bcf86cd799439011';
const nonExistentServiceId = '507f1f77bcf86cd799439099';
const validContractId = '60d5ec49f1b2c82b88123456';
const validBreachId = '60d5ec49f1b2c82b88654321';

const mockService = {
  _id: validServiceId,
  name: 'Payment Gateway',
  baseUrl: 'https://api.payment.example.com',
  environment: 'Production',
  status: 'Active',
};

const validContractPayload = {
  serviceId: validServiceId,
  contractName: 'Enterprise Payment SLA',
  contractReference: 'SLA-2026-PAY-001',
  providerName: 'FinTech Cloud Ltd',
  customerName: 'Global Retail Corp',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveUntil: '2026-12-31T23:59:59.000Z',
  status: 'Draft' as const,
  measurementWindow: {
    type: 'MONTHLY' as const,
    durationMinutes: 43200,
  },
  targets: [
    {
      metric: 'uptime',
      operator: '>=' as const,
      threshold: 99.9,
      unit: '%',
      description: 'Minimum uptime requirement',
    },
    {
      metric: 'responseTime',
      operator: '<=' as const,
      threshold: 500,
      unit: 'ms',
      description: 'Maximum average latency',
    },
  ],
  creditRules: [
    {
      ruleId: 'CR-UPTIME-01',
      description: '10% credit if uptime drops below 99.9%',
      applicableMetric: 'uptime',
      operator: '<' as const,
      threshold: 99.9,
      creditType: 'PERCENTAGE' as const,
      creditValue: 10,
      maxCreditLimit: 50,
      priority: 1,
    },
  ],
};

const mockContractRecord = {
  _id: validContractId,
  ...validContractPayload,
  effectiveFrom: new Date(validContractPayload.effectiveFrom),
  effectiveUntil: new Date(validContractPayload.effectiveUntil),
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockBreachRecord = {
  _id: validBreachId,
  serviceId: validServiceId,
  contractId: validContractId,
  metric: 'uptime',
  contractualThreshold: 99.9,
  observedValue: 95.0,
  comparisonOperator: '>=',
  severity: 'High' as const,
  breachType: 'UPTIME_BREACH',
  measurementPeriodStart: new Date('2026-01-01'),
  measurementPeriodEnd: new Date('2026-01-31'),
  evidence: {
    totalChecks: 1000,
    successfulChecks: 950,
    failedChecks: 50,
    avgResponseTime: 250,
    calculatedUptime: 95.0,
    metricSummary: 'Uptime observed 95.0% vs target >= 99.9%',
  },
  status: 'Detected' as const,
  detectedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SLA Contract Management & Evaluation Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== PART 1: SLA CONTRACT TESTS ====================

  // 1. Create a valid SLA contract
  describe('1. Create a valid SLA contract', () => {
    it('creates a contract with structured targets and credit rules', async () => {
      const serviceSpy = jest
        .spyOn(ServiceModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockService) } as never);

      const findRefSpy = jest
        .spyOn(SLAContractModel, 'findOne')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);

      const createSpy = jest
        .spyOn(SLAContractModel, 'create')
        .mockResolvedValueOnce(mockContractRecord as never);

      const response = await request(app)
        .post('/api/sla/contracts')
        .send(validContractPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contractReference).toBe('SLA-2026-PAY-001');

      serviceSpy.mockRestore();
      findRefSpy.mockRestore();
      createSpy.mockRestore();
    });
  });

  // 2. Reject invalid contract data
  describe('2. Reject invalid contract data', () => {
    it('rejects contract creation when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/sla/contracts')
        .send({ contractName: 'Incomplete SLA' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // 3. Reject nonexistent service references
  describe('3. Reject nonexistent service references', () => {
    it('returns 404 when referenced service does not exist', async () => {
      const serviceSpy = jest
        .spyOn(ServiceModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);

      const response = await request(app)
        .post('/api/sla/contracts')
        .send({ ...validContractPayload, serviceId: nonExistentServiceId });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');

      serviceSpy.mockRestore();
    });
  });

  // 4. Reject invalid contract dates
  describe('4. Reject invalid contract dates', () => {
    it('rejects contract when effectiveUntil is before or equal to effectiveFrom', async () => {
      const response = await request(app)
        .post('/api/sla/contracts')
        .send({
          ...validContractPayload,
          effectiveFrom: '2026-12-31T00:00:00.000Z',
          effectiveUntil: '2026-01-01T00:00:00.000Z',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // 5. Reject duplicate contract references
  describe('5. Reject duplicate contract references', () => {
    it('returns 409 conflict when contract reference already exists', async () => {
      const serviceSpy = jest
        .spyOn(ServiceModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockService) } as never);

      const findRefSpy = jest
        .spyOn(SLAContractModel, 'findOne')
        .mockReturnValue({ lean: () => Promise.resolve(mockContractRecord) } as never);

      const response = await request(app)
        .post('/api/sla/contracts')
        .send(validContractPayload);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');

      serviceSpy.mockRestore();
      findRefSpy.mockRestore();
    });
  });

  // 6. List contracts with pagination
  describe('6. List contracts with pagination', () => {
    it('retrieves paginated contracts list', async () => {
      const countSpy = jest
        .spyOn(SLAContractModel, 'countDocuments')
        .mockResolvedValueOnce(1 as never);

      const findSpy = jest.spyOn(SLAContractModel, 'find').mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({ lean: () => Promise.resolve([mockContractRecord]) }),
          }),
        }),
      } as never);

      const response = await request(app).get('/api/sla/contracts?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contracts).toHaveLength(1);

      countSpy.mockRestore();
      findSpy.mockRestore();
    });
  });

  // 7. Fetch contract by ID
  describe('7. Fetch contract by ID', () => {
    it('fetches existing contract by ID', async () => {
      const findSpy = jest
        .spyOn(SLAContractModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockContractRecord) } as never);

      const response = await request(app).get(`/api/sla/contracts/${validContractId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(validContractId);

      findSpy.mockRestore();
    });

    it('returns 404 for missing contract ID', async () => {
      const findSpy = jest
        .spyOn(SLAContractModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);

      const response = await request(app).get(`/api/sla/contracts/${validContractId}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');

      findSpy.mockRestore();
    });
  });

  // 8. Update an eligible contract & 9. Prevent unauthorized changes to active contract terms
  describe('8 & 9. Contract updates and active immutability', () => {
    it('allows updating fields on a Draft contract', async () => {
      const findSpy = jest
        .spyOn(SLAContractModel, 'findById')
        .mockResolvedValueOnce({ ...mockContractRecord, status: 'Draft' } as never);

      const updateSpy = jest.spyOn(SLAContractModel, 'findByIdAndUpdate').mockReturnValue({
        lean: () =>
          Promise.resolve({ ...mockContractRecord, contractName: 'Updated Draft Name' }),
      } as never);

      const response = await request(app)
        .patch(`/api/sla/contracts/${validContractId}`)
        .send({ contractName: 'Updated Draft Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contractName).toBe('Updated Draft Name');

      findSpy.mockRestore();
      updateSpy.mockRestore();
    });

    it('rejects modifying contractual targets or credit rules on an Active contract', async () => {
      const findSpy = jest
        .spyOn(SLAContractModel, 'findById')
        .mockResolvedValueOnce({ ...mockContractRecord, status: 'Active' } as never);

      const response = await request(app)
        .patch(`/api/sla/contracts/${validContractId}`)
        .send({
          targets: [
            {
              metric: 'uptime',
              operator: '>=',
              threshold: 98.0,
              unit: '%',
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('immutable');

      findSpy.mockRestore();
    });
  });

  // 10. Change contract status
  describe('10. Change contract status', () => {
    it('updates contract status successfully', async () => {
      const saveFn = jest.fn().mockResolvedValue(true);
      const contractDoc = {
        ...mockContractRecord,
        status: 'Draft',
        save: saveFn,
        toObject: () => ({ ...mockContractRecord, status: 'Active' }),
      };

      const findSpy = jest
        .spyOn(SLAContractModel, 'findById')
        .mockResolvedValueOnce(contractDoc as never);

      const overlapSpy = jest
        .spyOn(SLAContractModel, 'findOne')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);

      const response = await request(app)
        .patch(`/api/sla/contracts/${validContractId}/status`)
        .send({ status: 'Active' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('Active');

      findSpy.mockRestore();
      overlapSpy.mockRestore();
    });
  });

  // ==================== PART 2: SLA EVALUATION TESTS ====================

  // 11. Evaluate a contract with no breaches
  describe('11. Evaluate contract with no breaches', () => {
    it('evaluates contract and reports 0 breaches when performance meets all targets', async () => {
      const findContractSpy = jest.spyOn(SLAContractModel, 'findById').mockReturnValue({
        lean: () =>
          Promise.resolve({
            ...mockContractRecord,
            status: 'Active',
          }),
      } as never);

      // All checks are UP in 200ms -> Uptime 100%, avg latency 200ms
      const metrics = Array.from({ length: 10 }, (_, i) => ({
        _id: new Types.ObjectId(),
        serviceId: new Types.ObjectId(validServiceId),
        checkedAt: new Date(),
        responseTime: 200,
        status: 'UP',
      }));

      const findMetricsSpy = jest.spyOn(PerformanceMetricModel, 'find').mockReturnValue({
        lean: () => Promise.resolve(metrics),
      } as never);

      const response = await request(app).post(`/api/sla/evaluate/${validContractId}`).send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.targetsViolated).toBe(0);
      expect(response.body.data.breaches).toHaveLength(0);

      findContractSpy.mockRestore();
      findMetricsSpy.mockRestore();
    });
  });

  // 12. Detect uptime violation
  describe('12. Detect uptime violation', () => {
    it('identifies an uptime breach when observed uptime drops below contractual target', async () => {
      const findContractSpy = jest.spyOn(SLAContractModel, 'findById').mockReturnValue({
        lean: () =>
          Promise.resolve({
            ...mockContractRecord,
            status: 'Active',
            targets: [
              {
                metric: 'uptime',
                operator: '>=',
                threshold: 99.9,
                unit: '%',
              },
            ],
          }),
      } as never);

      // 90 UP, 10 DOWN -> Uptime 90.0% < 99.9%
      const metrics = [
        ...Array.from({ length: 90 }, () => ({ status: 'UP', responseTime: 100 })),
        ...Array.from({ length: 10 }, () => ({ status: 'DOWN', responseTime: 0 })),
      ];

      const findMetricsSpy = jest.spyOn(PerformanceMetricModel, 'find').mockReturnValue({
        lean: () => Promise.resolve(metrics),
      } as never);

      const findBreachSpy = jest
        .spyOn(SLABreachModel, 'findOne')
        .mockResolvedValueOnce(null as never);

      const createBreachSpy = jest
        .spyOn(SLABreachModel, 'create')
        .mockResolvedValueOnce(mockBreachRecord as never);

      const response = await request(app).post(`/api/sla/evaluate/${validContractId}`).send();

      expect(response.status).toBe(200);
      expect(response.body.data.targetsViolated).toBe(1);
      expect(response.body.data.newBreachesCount).toBe(1);
      expect(response.body.data.monitoringEvidence.calculatedUptime).toBe(90.0);

      findContractSpy.mockRestore();
      findMetricsSpy.mockRestore();
      findBreachSpy.mockRestore();
      createBreachSpy.mockRestore();
    });
  });

  // 13. Detect response-time violation
  describe('13. Detect response-time violation', () => {
    it('identifies latency breach when observed response time exceeds contractual limit', async () => {
      const findContractSpy = jest.spyOn(SLAContractModel, 'findById').mockReturnValue({
        lean: () =>
          Promise.resolve({
            ...mockContractRecord,
            status: 'Active',
            targets: [
              {
                metric: 'responseTime',
                operator: '<=',
                threshold: 500,
                unit: 'ms',
              },
            ],
          }),
      } as never);

      // All UP with 750ms latency > 500ms limit
      const metrics = Array.from({ length: 10 }, () => ({ status: 'UP', responseTime: 750 }));

      const findMetricsSpy = jest.spyOn(PerformanceMetricModel, 'find').mockReturnValue({
        lean: () => Promise.resolve(metrics),
      } as never);

      const findBreachSpy = jest
        .spyOn(SLABreachModel, 'findOne')
        .mockResolvedValueOnce(null as never);

      const createBreachSpy = jest.spyOn(SLABreachModel, 'create').mockResolvedValueOnce({
        ...mockBreachRecord,
        metric: 'responseTime',
        breachType: 'LATENCY_BREACH',
      } as never);

      const response = await request(app).post(`/api/sla/evaluate/${validContractId}`).send();

      expect(response.status).toBe(200);
      expect(response.body.data.targetsViolated).toBe(1);
      expect(response.body.data.monitoringEvidence.averageResponseTime).toBe(750);

      findContractSpy.mockRestore();
      findMetricsSpy.mockRestore();
      findBreachSpy.mockRestore();
      createBreachSpy.mockRestore();
    });
  });

  // 14. Detect multiple simultaneous violations
  describe('14. Detect multiple simultaneous violations', () => {
    it('records separate breaches when both uptime and response time are violated', async () => {
      const findContractSpy = jest.spyOn(SLAContractModel, 'findById').mockReturnValue({
        lean: () =>
          Promise.resolve({
            ...mockContractRecord,
            status: 'Active',
          }),
      } as never);

      // 80 UP @ 700ms, 20 DOWN -> Uptime 80% (<99.9%), Latency 700ms (>500ms)
      const metrics = [
        ...Array.from({ length: 80 }, () => ({ status: 'UP', responseTime: 700 })),
        ...Array.from({ length: 20 }, () => ({ status: 'DOWN', responseTime: 0 })),
      ];

      const findMetricsSpy = jest.spyOn(PerformanceMetricModel, 'find').mockReturnValue({
        lean: () => Promise.resolve(metrics),
      } as never);

      const findBreachSpy = jest
        .spyOn(SLABreachModel, 'findOne')
        .mockResolvedValue(null as never);

      const createBreachSpy = jest
        .spyOn(SLABreachModel, 'create')
        .mockResolvedValue(mockBreachRecord as never);

      const response = await request(app).post(`/api/sla/evaluate/${validContractId}`).send();

      expect(response.status).toBe(200);
      expect(response.body.data.targetsViolated).toBe(2);

      findContractSpy.mockRestore();
      findMetricsSpy.mockRestore();
      findBreachSpy.mockRestore();
      createBreachSpy.mockRestore();
    });
  });

  // 15. Calculate uptime correctly & 16. Calculate average response time correctly
  describe('15 & 16. Calculation precision for uptime and latency', () => {
    it('calculates uptime and average response time on successful checks accurately', async () => {
      const findContractSpy = jest.spyOn(SLAContractModel, 'findById').mockReturnValue({
        lean: () =>
          Promise.resolve({
            ...mockContractRecord,
            status: 'Active',
          }),
      } as never);

      // 3 successful checks (100ms, 200ms, 300ms) and 1 failed check
      // Uptime: (3/4) * 100 = 75.0%
      // Average latency of UP checks: (100 + 200 + 300) / 3 = 200.0ms
      const metrics = [
        { status: 'UP', responseTime: 100 },
        { status: 'UP', responseTime: 200 },
        { status: 'UP', responseTime: 300 },
        { status: 'DOWN', responseTime: 0 },
      ];

      const findMetricsSpy = jest.spyOn(PerformanceMetricModel, 'find').mockReturnValue({
        lean: () => Promise.resolve(metrics),
      } as never);

      const findBreachSpy = jest
        .spyOn(SLABreachModel, 'findOne')
        .mockResolvedValue(null as never);
      const createBreachSpy = jest
        .spyOn(SLABreachModel, 'create')
        .mockResolvedValue(mockBreachRecord as never);

      const response = await request(app).post(`/api/sla/evaluate/${validContractId}`).send();

      expect(response.status).toBe(200);
      expect(response.body.data.monitoringEvidence.calculatedUptime).toBe(75.0);
      expect(response.body.data.monitoringEvidence.averageResponseTime).toBe(200.0);

      findContractSpy.mockRestore();
      findMetricsSpy.mockRestore();
      findBreachSpy.mockRestore();
      createBreachSpy.mockRestore();
    });
  });

  // 17. Handle zero monitoring records
  describe('17. Handle zero monitoring records', () => {
    it('returns zero evidence summary without creating false breaches when no metrics exist', async () => {
      const findContractSpy = jest.spyOn(SLAContractModel, 'findById').mockReturnValue({
        lean: () =>
          Promise.resolve({
            ...mockContractRecord,
            status: 'Active',
          }),
      } as never);

      const findMetricsSpy = jest.spyOn(PerformanceMetricModel, 'find').mockReturnValue({
        lean: () => Promise.resolve([]),
      } as never);

      const response = await request(app).post(`/api/sla/evaluate/${validContractId}`).send();

      expect(response.status).toBe(200);
      expect(response.body.data.monitoringEvidence.totalChecks).toBe(0);
      expect(response.body.data.targetsViolated).toBe(0);
      expect(response.body.data.breaches).toHaveLength(0);

      findContractSpy.mockRestore();
      findMetricsSpy.mockRestore();
    });
  });

  // 18. Handle incomplete measurement periods
  describe('18. Handle incomplete measurement periods', () => {
    it('rejects evaluation when measurementPeriodEnd is before measurementPeriodStart', async () => {
      const response = await request(app)
        .post(`/api/sla/evaluate/${validContractId}`)
        .send({
          measurementPeriodStart: '2026-06-01T00:00:00.000Z',
          measurementPeriodEnd: '2026-05-01T00:00:00.000Z',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // 19. Prevent duplicate breach records
  describe('19. Prevent duplicate breach records', () => {
    it('updates existing breach instead of creating a duplicate for the same window', async () => {
      const findContractSpy = jest.spyOn(SLAContractModel, 'findById').mockReturnValue({
        lean: () =>
          Promise.resolve({
            ...mockContractRecord,
            status: 'Active',
            targets: [
              {
                metric: 'uptime',
                operator: '>=',
                threshold: 99.9,
                unit: '%',
              },
            ],
          }),
      } as never);

      const metrics = [
        { status: 'UP', responseTime: 100 },
        { status: 'DOWN', responseTime: 0 },
      ];

      const findMetricsSpy = jest.spyOn(PerformanceMetricModel, 'find').mockReturnValue({
        lean: () => Promise.resolve(metrics),
      } as never);

      // Existing breach found
      const findBreachSpy = jest
        .spyOn(SLABreachModel, 'findOne')
        .mockResolvedValueOnce(mockBreachRecord as never);

      const updateBreachSpy = jest
        .spyOn(SLABreachModel, 'findOneAndUpdate')
        .mockResolvedValueOnce({ ...mockBreachRecord, observedValue: 50.0 } as never);

      const response = await request(app).post(`/api/sla/evaluate/${validContractId}`).send();

      expect(response.status).toBe(200);
      expect(response.body.data.updatedBreachesCount).toBe(1);
      expect(response.body.data.newBreachesCount).toBe(0);

      findContractSpy.mockRestore();
      findMetricsSpy.mockRestore();
      findBreachSpy.mockRestore();
      updateBreachSpy.mockRestore();
    });
  });

  // 20. Retrieve breach history
  describe('20. Retrieve breach history', () => {
    it('fetches list of detected breaches with pagination', async () => {
      const countSpy = jest
        .spyOn(SLABreachModel, 'countDocuments')
        .mockResolvedValueOnce(1 as never);

      const findSpy = jest.spyOn(SLABreachModel, 'find').mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({ lean: () => Promise.resolve([mockBreachRecord]) }),
          }),
        }),
      } as never);

      const response = await request(app).get('/api/sla/breaches?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.breaches).toHaveLength(1);

      countSpy.mockRestore();
      findSpy.mockRestore();
    });
  });

  // 21. Update breach review status
  describe('21. Update breach review status', () => {
    it('updates breach review status from Detected to Confirmed', async () => {
      const saveFn = jest.fn().mockResolvedValue(true);
      const breachDoc = {
        ...mockBreachRecord,
        status: 'Detected',
        save: saveFn,
        toObject: () => ({ ...mockBreachRecord, status: 'Confirmed' }),
      };

      const findSpy = jest
        .spyOn(SLABreachModel, 'findById')
        .mockResolvedValueOnce(breachDoc as never);

      const response = await request(app)
        .patch(`/api/sla/breaches/${validBreachId}/status`)
        .send({ status: 'Confirmed' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('Confirmed');

      findSpy.mockRestore();
    });
  });

  // 22. Preserve historical evaluation evidence
  describe('22. Preserve historical evaluation evidence', () => {
    it('retains detailed reproducible evidence on each breach document', async () => {
      const findSpy = jest
        .spyOn(SLABreachModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockBreachRecord) } as never);

      const response = await request(app).get(`/api/sla/breaches/${validBreachId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.evidence).toMatchObject({
        totalChecks: 1000,
        successfulChecks: 950,
        failedChecks: 50,
        calculatedUptime: 95.0,
      });

      findSpy.mockRestore();
    });
  });
});

