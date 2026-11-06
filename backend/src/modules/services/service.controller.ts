import { RequestHandler } from 'express';
import { success } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { CreateServiceInput, PaginationInput, UpdateServiceInput } from './service.validation';
import { serviceService } from './service.service';

export const createService: RequestHandler = asyncHandler(async (req, res) => {
  const service = await serviceService.create(req.body as CreateServiceInput);
  return success(res, 'Service created successfully', service, 201);
});

export const listServices: RequestHandler = asyncHandler(async (req, res) => {
  const result = await serviceService.list(req.query as unknown as PaginationInput);
  return success(res, 'Services retrieved successfully', result);
});

export const getService: RequestHandler = asyncHandler(async (req, res) => {
  const service = await serviceService.getById(req.params.id as string);
  return success(res, 'Service retrieved successfully', service);
});

export const updateService: RequestHandler = asyncHandler(async (req, res) => {
  const service = await serviceService.update(
    req.params.id as string,
    req.body as UpdateServiceInput
  );
  return success(res, 'Service updated successfully', service);
});

export const deleteService: RequestHandler = asyncHandler(async (req, res) => {
  await serviceService.remove(req.params.id as string);
  return success(res, 'Service deleted successfully');
});
