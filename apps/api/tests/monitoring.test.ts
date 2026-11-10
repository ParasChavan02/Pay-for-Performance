import request from 'supertest';
import app from '../src/app';
import { ServiceModel } from '../src/modules/services/service.model';
import { PerformanceMetricModel } from '../src/modules/monitoring/monitoring.model';
import { monitoringScheduler } from '../src/modules/monitoring/monitoring.scheduler';
import { monitoringService } from '../src/modules/monitoring/monitoring.service';

const validServiceId = '507f1f77bcf86cd799439011';
const nonExistentServiceId = '507f1f77bcf86cd799439099';

const mockService = {
  _id: validServiceId,
  name: 'Payment Gateway',
  description: 'Core payment processing API',
  baseUrl: 'https://api.payment.example.com',
  environment: 'Production',
  monitoringInterval: 30,
  expectedUptime: 99.9,
  maxResponseTime: 400,
  status: 'Active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMetric = {
  _id: '60d5ec49f1b2c82b88123456',
  serviceId: validServiceId,
  checkedAt: new Date(),
  responseTime: 120,
  status: 'UP' as const,
  httpStatusCode: 200,
  errorMessage: undefined,
  checkType: 'Manual' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Monitoring Engine & APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    monitoringScheduler.stop();
  });

  afterAll(() => {
    monitoringScheduler.stop();
  });

  // 1. Successful monitoring check
  describe('1. Successful monitoring check', () => {
    it('records UP when HTTP endpoint responds with 2xx status', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
      } as Response);

      const result = await monitoringService.performHttpCheck('https://api.example.com');

      expect(fetchSpy).toHaveBeenCalled();
      expect(result.status).toBe('UP');
      expect(result.httpStatusCode).toBe(200);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.errorMessage).toBeUndefined();

      fetchSpy.mockRestore();
    });
  });

  // 2. Failed HTTP response
  describe('2. Failed HTTP response', () => {
    it('records DOWN when HTTP endpoint responds with a 5xx error', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 503,
        statusText: 'Service Unavailable',
      } as Response);

      const result = await monitoringService.performHttpCheck('https://api.example.com');

      expect(result.status).toBe('DOWN');
      expect(result.httpStatusCode).toBe(503);
      expect(result.errorMessage).toContain('503');

      fetchSpy.mockRestore();
    });
  });

  // 3. Connection failure
  describe('3. Connection failure', () => {
    it('records DOWN when connection fails with network error', async () => {
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await monitoringService.performHttpCheck('https://api.example.com');

      expect(result.status).toBe('DOWN');
      expect(result.httpStatusCode).toBeNull();
      expect(result.errorMessage).toContain('ECONNREFUSED');

      fetchSpy.mockRestore();
    });
  });

  // 4. Request timeout
  describe('4. Request timeout', () => {
    it('records DOWN when check times out', async () => {
      const abortError = new Error('The operation was aborted due to timeout');
      abortError.name = 'TimeoutError';

      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError);

      const result = await monitoringService.performHttpCheck('https://api.example.com', 1000);

      expect(result.status).toBe('DOWN');
      expect(result.httpStatusCode).toBeNull();
      expect(result.errorMessage).toContain('timed out after 1000ms');

      fetchSpy.mockRestore();
    });
  });

  // 5. Manual monitoring API
  describe('5. Manual monitoring API', () => {
    it('triggers an immediate manual check and returns 201 with metric result', async () => {
      const findServiceSpy = jest
        .spyOn(ServiceModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockService) } as never);

      const checkSpy = jest.spyOn(monitoringService, 'performHttpCheck').mockResolvedValueOnce({
        status: 'UP',
        responseTime: 145,
        httpStatusCode: 200,
      });

      const createMetricSpy = jest
        .spyOn(PerformanceMetricModel, 'create')
        .mockResolvedValueOnce(mockMetric as never);

      const response = await request(app).post(`/api/monitoring/${validServiceId}/check`);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('UP');
      expect(createMetricSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          checkType: 'Manual',
          status: 'UP',
        })
      );

      findServiceSpy.mockRestore();
      checkSpy.mockRestore();
      createMetricSpy.mockRestore();
    });
  });

  // 6. Invalid service ID
  describe('6. Invalid service ID', () => {
    it.each([
      ['POST', '/api/monitoring/not-a-valid-id/check'],
      ['GET', '/api/monitoring/not-a-valid-id'],
      ['GET', '/api/monitoring/not-a-valid-id/latest'],
      ['GET', '/api/monitoring/not-a-valid-id/summary'],
    ])('rejects malformed ID with 400 on %s %s', async (method, path) => {
      const req = method === 'POST' ? request(app).post(path) : request(app).get(path);
      const response = await req;

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // 7. Nonexistent service
  describe('7. Nonexistent service', () => {
    it('returns 404 when manual check is requested for missing service', async () => {
      const findServiceSpy = jest
        .spyOn(ServiceModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(null) } as never);

      const response = await request(app).post(`/api/monitoring/${nonExistentServiceId}/check`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');

      findServiceSpy.mockRestore();
    });
  });

  // 8. Latest monitoring record
  describe('8. Latest monitoring record', () => {
    it('returns the most recent monitoring metric for a service', async () => {
      const findServiceSpy = jest
        .spyOn(ServiceModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockService) } as never);

      const findLatestSpy = jest.spyOn(PerformanceMetricModel, 'findOne').mockReturnValue({
        sort: () => ({ lean: () => Promise.resolve(mockMetric) }),
      } as never);

      const response = await request(app).get(`/api/monitoring/${validServiceId}/latest`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(mockMetric._id);
      expect(response.body.data.status).toBe('UP');

      findServiceSpy.mockRestore();
      findLatestSpy.mockRestore();
    });

    it('returns 404 when no metrics exist yet for the service', async () => {
      const findServiceSpy = jest
        .spyOn(ServiceModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockService) } as never);

      const findLatestSpy = jest.spyOn(PerformanceMetricModel, 'findOne').mockReturnValue({
        sort: () => ({ lean: () => Promise.resolve(null) }),
      } as never);

      const response = await request(app).get(`/api/monitoring/${validServiceId}/latest`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');

      findServiceSpy.mockRestore();
      findLatestSpy.mockRestore();
    });
  });

  // 9. Historical monitoring records
  describe('9. Historical monitoring records', () => {
    it('retrieves historical records for a specific service', async () => {
      const findServiceSpy = jest
        .spyOn(ServiceModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockService) } as never);

      const countSpy = jest
        .spyOn(PerformanceMetricModel, 'countDocuments')
        .mockResolvedValueOnce(1 as never);

      const findSpy = jest.spyOn(PerformanceMetricModel, 'find').mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({ lean: () => Promise.resolve([mockMetric]) }),
          }),
        }),
      } as never);

      const response = await request(app).get(`/api/monitoring/${validServiceId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.serviceId).toBe(validServiceId);
      expect(response.body.data.metrics).toHaveLength(1);

      findServiceSpy.mockRestore();
      countSpy.mockRestore();
      findSpy.mockRestore();
    });
  });

  // 10. Pagination
  describe('10. Pagination', () => {
    it('handles pagination parameters correctly on GET /api/monitoring', async () => {
      const countSpy = jest
        .spyOn(PerformanceMetricModel, 'countDocuments')
        .mockResolvedValueOnce(25 as never);

      const findSpy = jest.spyOn(PerformanceMetricModel, 'find').mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({ lean: () => Promise.resolve([mockMetric]) }),
          }),
        }),
      } as never);

      const response = await request(app).get('/api/monitoring?page=2&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(2);
      expect(response.body.data.limit).toBe(5);
      expect(response.body.data.total).toBe(25);

      countSpy.mockRestore();
      findSpy.mockRestore();
    });
  });

  // 11. Filtering by status
  describe('11. Filtering by status', () => {
    it('passes status filter to query', async () => {
      const countSpy = jest
        .spyOn(PerformanceMetricModel, 'countDocuments')
        .mockResolvedValueOnce(2 as never);

      const findSpy = jest.spyOn(PerformanceMetricModel, 'find').mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({ lean: () => Promise.resolve([mockMetric]) }),
          }),
        }),
      } as never);

      const response = await request(app).get('/api/monitoring?status=UP');

      expect(response.status).toBe(200);
      expect(countSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'UP' }));

      countSpy.mockRestore();
      findSpy.mockRestore();
    });
  });

  // 12. Monitoring summary calculations & 13. Uptime percentage calculation
  describe('12 & 13. Performance summary and uptime percentage calculation', () => {
    it('calculates total checks, uptime percentage, and latency bounds accurately', async () => {
      const findServiceSpy = jest
        .spyOn(ServiceModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockService) } as never);

      const aggregateSpy = jest.spyOn(PerformanceMetricModel, 'aggregate').mockResolvedValueOnce([
        {
          _id: null,
          totalChecks: 100,
          successfulChecks: 98,
          failedChecks: 2,
          avgResponseTime: 185.456,
          minResponseTime: 95,
          maxResponseTime: 450,
        },
      ] as never);

      const findLatestSpy = jest.spyOn(PerformanceMetricModel, 'findOne').mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve({ checkedAt: new Date(), status: 'UP' }),
        }),
      } as never);

      const response = await request(app).get(`/api/monitoring/${validServiceId}/summary`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalChecks).toBe(100);
      expect(response.body.data.successfulChecks).toBe(98);
      expect(response.body.data.failedChecks).toBe(2);
      expect(response.body.data.uptimePercentage).toBe(98);
      expect(response.body.data.avgResponseTime).toBe(185.46);
      expect(response.body.data.minResponseTime).toBe(95);
      expect(response.body.data.maxResponseTime).toBe(450);
      expect(response.body.data.currentStatus).toBe('UP');

      findServiceSpy.mockRestore();
      aggregateSpy.mockRestore();
      findLatestSpy.mockRestore();
    });

    it('returns clean zeroed statistics when no records exist for service', async () => {
      const findServiceSpy = jest
        .spyOn(ServiceModel, 'findById')
        .mockReturnValue({ lean: () => Promise.resolve(mockService) } as never);

      const aggregateSpy = jest
        .spyOn(PerformanceMetricModel, 'aggregate')
        .mockResolvedValueOnce([] as never);

      const findLatestSpy = jest.spyOn(PerformanceMetricModel, 'findOne').mockReturnValue({
        sort: () => ({ lean: () => Promise.resolve(null) }),
      } as never);

      const response = await request(app).get(`/api/monitoring/${validServiceId}/summary`);

      expect(response.status).toBe(200);
      expect(response.body.data.totalChecks).toBe(0);
      expect(response.body.data.uptimePercentage).toBe(0);
      expect(response.body.data.currentStatus).toBe('UNKNOWN');
      expect(response.body.data.avgResponseTime).toBeNull();

      findServiceSpy.mockRestore();
      aggregateSpy.mockRestore();
      findLatestSpy.mockRestore();
    });
  });

  // 14. Preventing overlapping checks
  describe('14. Preventing overlapping checks', () => {
    it('rejects concurrent manual checks with 409 conflict', async () => {
      monitoringScheduler.setInFlight(validServiceId, true);

      const response = await request(app).post(`/api/monitoring/${validServiceId}/check`);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');

      monitoringScheduler.setInFlight(validServiceId, false);
    });

    it('scheduler skips execution when a check is already in-flight', async () => {
      monitoringScheduler.setInFlight(validServiceId, true);

      const checkSpy = jest.spyOn(monitoringService, 'checkService');

      await monitoringScheduler.runScheduledCheck(validServiceId);

      expect(checkSpy).not.toHaveBeenCalled();

      monitoringScheduler.setInFlight(validServiceId, false);
      checkSpy.mockRestore();
    });
  });

  // 15. Inactive services are not scheduled
  describe('15. Inactive services are not scheduled', () => {
    it('does not schedule background timer for inactive service', () => {
      const inactiveService = { ...mockService, status: 'Inactive' };

      monitoringScheduler.scheduleService(inactiveService);

      expect(monitoringScheduler.getActiveJobCount()).toBe(0);
    });
  });

  // 16. Scheduler reschedules when monitoring interval changes
  describe('16. Scheduler reschedules when monitoring interval changes', () => {
    it('reschedules timer with new interval', () => {
      monitoringScheduler.scheduleService(mockService);
      expect(monitoringScheduler.getActiveJobCount()).toBe(1);

      const updatedService = { ...mockService, monitoringInterval: 120 };
      monitoringScheduler.rescheduleService(updatedService);

      expect(monitoringScheduler.getActiveJobCount()).toBe(1);
    });
  });

  // 17. Scheduler stops when a service is deactivated
  describe('17. Scheduler stops when a service is deactivated', () => {
    it('stops timer when active service becomes Inactive', () => {
      monitoringScheduler.scheduleService(mockService);
      expect(monitoringScheduler.getActiveJobCount()).toBe(1);

      const deactivated = { ...mockService, status: 'Inactive' };
      monitoringScheduler.rescheduleService(deactivated);

      expect(monitoringScheduler.getActiveJobCount()).toBe(0);
    });
  });

  // SSRF Protection
  describe('SSRF Protection', () => {
    it('blocks private and loopback destinations when SSRF is enforced in production', async () => {
      const oldEnv = process.env.NODE_ENV;
      const oldLocalhost = process.env.ALLOW_LOCALHOST_MONITORING;
      delete process.env.ALLOW_LOCALHOST_MONITORING;
      process.env.NODE_ENV = 'production';

      try {
        const result = await monitoringService.performHttpCheck('http://169.254.169.254/meta-data');
        expect(result.status).toBe('DOWN');
        expect(result.errorMessage).toContain('SSRF security policy');
      } finally {
        process.env.NODE_ENV = oldEnv;
        if (oldLocalhost !== undefined) {
          process.env.ALLOW_LOCALHOST_MONITORING = oldLocalhost;
        }
      }
    });

    it('rejects URLs containing embedded credentials', async () => {
      const result = await monitoringService.performHttpCheck('https://user:pass@api.example.com');
      expect(result.status).toBe('DOWN');
      expect(result.errorMessage).toContain('SSRF security policy');
    });
  });
});
