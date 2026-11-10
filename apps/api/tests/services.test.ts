import request from 'supertest';
import app from '../src/app';
import { serviceService } from '../src/modules/services/service.service';
import { AppError } from '../src/shared/errors/app-error';

jest.mock('../src/modules/services/service.service', () => ({
  serviceService: {
    create: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockedService = serviceService as jest.Mocked<typeof serviceService>;
const validId = '507f1f77bcf86cd799439011';
const nonExistentId = '507f1f77bcf86cd799439012';

const validPayload = {
  name: 'Payment API',
  description: 'Main payment processing service',
  baseUrl: 'https://example.com',
  environment: 'Production' as const,
  monitoringInterval: 60,
  expectedUptime: 99.9,
  maxResponseTime: 500,
  status: 'Active' as const,
};

const mockServiceRecord = {
  _id: validId,
  ...validPayload,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Service Management API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Successfully creating a service
  describe('1. Successfully creating a service', () => {
    it('creates a service with complete payload', async () => {
      mockedService.create.mockResolvedValue(mockServiceRecord as never);

      const response = await request(app).post('/api/services').send(validPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Service created successfully');
      expect(response.body.data.name).toBe('Payment API');
      expect(mockedService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Payment API',
          baseUrl: 'https://example.com',
          environment: 'Production',
        })
      );
    });

    it('creates a service with default values when optional fields are omitted', async () => {
      const minimalPayload = {
        name: 'Auth API',
        baseUrl: 'https://auth.example.com',
        environment: 'Development',
      };

      mockedService.create.mockResolvedValue({
        _id: validId,
        ...minimalPayload,
        monitoringInterval: 60,
        expectedUptime: 99.9,
        maxResponseTime: 500,
        status: 'Active',
      } as never);

      const response = await request(app).post('/api/services').send(minimalPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(mockedService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Auth API',
          monitoringInterval: 60,
          expectedUptime: 99.9,
          maxResponseTime: 500,
          status: 'Active',
        })
      );
    });
  });

  // 2. Rejecting an empty service name
  describe('2. Rejecting an empty service name', () => {
    it.each([
      { ...validPayload, name: '' },
      { ...validPayload, name: '   ' },
    ])('rejects empty or whitespace-only service name', async (payload) => {
      const response = await request(app).post('/api/services').send(payload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockedService.create).not.toHaveBeenCalled();
    });
  });

  // 3. Rejecting an invalid URL
  describe('3. Rejecting an invalid URL', () => {
    it.each([
      ['non-url string', { ...validPayload, baseUrl: 'not-a-url' }],
      ['unsupported protocol (ftp)', { ...validPayload, baseUrl: 'ftp://example.com' }],
      ['embedded username/password', { ...validPayload, baseUrl: 'https://user:pass@example.com' }],
    ])('rejects %s', async (_label, payload) => {
      const response = await request(app).post('/api/services').send(payload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockedService.create).not.toHaveBeenCalled();
    });
  });

  // 4. Rejecting invalid expected uptime
  describe('4. Rejecting invalid expected uptime', () => {
    it.each([
      ['uptime greater than 100', { ...validPayload, expectedUptime: 100.1 }],
      ['negative uptime', { ...validPayload, expectedUptime: -1 }],
    ])('rejects %s', async (_label, payload) => {
      const response = await request(app).post('/api/services').send(payload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockedService.create).not.toHaveBeenCalled();
    });
  });

  // 5. Fetching all services
  describe('5. Fetching all services', () => {
    it('fetches all services list successfully', async () => {
      mockedService.list.mockResolvedValue({
        page: 1,
        limit: 10,
        total: 1,
        totalServices: 1,
        activeCount: 1,
        activeServices: 1,
        inactiveCount: 0,
        inactiveServices: 0,
        services: [mockServiceRecord],
      } as never);

      const response = await request(app).get('/api/services');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.services).toHaveLength(1);
      expect(response.body.data.services[0].name).toBe('Payment API');
    });
  });

  // 6. Fetching a service by ID
  describe('6. Fetching a service by ID', () => {
    it('returns a service when a valid ID is found', async () => {
      mockedService.getById.mockResolvedValue(mockServiceRecord as never);

      const response = await request(app).get(`/api/services/${validId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(validId);
      expect(response.body.data.name).toBe('Payment API');
      expect(mockedService.getById).toHaveBeenCalledWith(validId);
    });
  });

  // 7. Returning 404 for a nonexistent service
  describe('7. Returning 404 for a nonexistent service', () => {
    it('returns 404 when service is not found by ID', async () => {
      mockedService.getById.mockRejectedValue(
        new AppError(404, 'NOT_FOUND', 'Service not found')
      );

      const response = await request(app).get(`/api/services/${nonExistentId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // 8. Updating a service
  describe('8. Updating a service', () => {
    it('updates a service with partial valid fields', async () => {
      const updatedRecord = { ...mockServiceRecord, status: 'Inactive' as const };
      mockedService.update.mockResolvedValue(updatedRecord as never);

      const response = await request(app)
        .patch(`/api/services/${validId}`)
        .send({ status: 'Inactive' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('Inactive');
      expect(mockedService.update).toHaveBeenCalledWith(
        validId,
        expect.objectContaining({ status: 'Inactive' })
      );
    });

    it('rejects updates to internal MongoDB fields such as _id, createdAt, updatedAt', async () => {
      const response = await request(app)
        .patch(`/api/services/${validId}`)
        .send({ _id: '507f1f77bcf86cd799439099' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockedService.update).not.toHaveBeenCalled();
    });

    it('rejects an empty update body', async () => {
      const response = await request(app)
        .patch(`/api/services/${validId}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockedService.update).not.toHaveBeenCalled();
    });

    it('returns 404 when updating a nonexistent service', async () => {
      mockedService.update.mockRejectedValue(
        new AppError(404, 'NOT_FOUND', 'Service not found')
      );

      const response = await request(app)
        .patch(`/api/services/${nonExistentId}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // 9. Rejecting invalid MongoDB IDs
  describe('9. Rejecting invalid MongoDB IDs', () => {
    it.each([
      ['GET', '/api/services/not-a-valid-id'],
      ['PATCH', '/api/services/short-id'],
      ['DELETE', '/api/services/12345678901234567890123z'],
    ])('rejects malformed ID on %s %s', async (method, path) => {
      const response =
        method === 'GET'
          ? await request(app).get(path)
          : method === 'PATCH'
          ? await request(app).patch(path).send({ name: 'Test' })
          : await request(app).delete(path);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // 10. Deleting a service
  describe('10. Deleting a service', () => {
    it('deletes an existing service successfully', async () => {
      mockedService.remove.mockResolvedValue(mockServiceRecord as never);

      const response = await request(app).delete(`/api/services/${validId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Service deleted successfully');
      expect(mockedService.remove).toHaveBeenCalledWith(validId);
    });

    it('returns 404 when deleting a nonexistent service', async () => {
      mockedService.remove.mockRejectedValue(
        new AppError(404, 'NOT_FOUND', 'Service not found')
      );

      const response = await request(app).delete(`/api/services/${nonExistentId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // 11. Handling pagination
  describe('11. Handling pagination', () => {
    it('handles custom page and limit query parameters', async () => {
      mockedService.list.mockResolvedValue({
        page: 2,
        limit: 5,
        total: 12,
        totalServices: 12,
        activeCount: 10,
        activeServices: 10,
        inactiveCount: 2,
        inactiveServices: 2,
        services: [mockServiceRecord],
      } as never);

      const response = await request(app).get('/api/services?page=2&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(2);
      expect(response.body.data.limit).toBe(5);
      expect(mockedService.list).toHaveBeenCalledWith({ page: 2, limit: 5 });
    });
  });

  // 12. Returning correct active and inactive counts
  describe('12. Returning correct active and inactive counts', () => {
    it('returns total, active, and inactive counts in list response', async () => {
      mockedService.list.mockResolvedValue({
        page: 1,
        limit: 10,
        total: 15,
        totalServices: 15,
        activeCount: 10,
        activeServices: 10,
        inactiveCount: 5,
        inactiveServices: 5,
        services: [mockServiceRecord],
      } as never);

      const response = await request(app).get('/api/services');

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        total: 15,
        activeCount: 10,
        inactiveCount: 5,
      });
    });
  });
});
