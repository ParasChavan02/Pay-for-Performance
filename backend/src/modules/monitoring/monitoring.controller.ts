import { RequestHandler } from 'express';
import { AppError } from '../../shared/errors/app-error';
import { success } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { monitoringScheduler } from './monitoring.scheduler';
import { monitoringService } from './monitoring.service';
import {
  MonitoringQueryInput,
  ServiceHistoryQueryInput,
  SummaryQueryInput,
} from './monitoring.validation';

/**
 * Triggers an immediate manual check for a registered service.
 */
export const triggerManualCheck: RequestHandler = asyncHandler(async (req, res) => {
  const serviceId = req.params.serviceId as string;

  if (monitoringScheduler.isInFlight(serviceId)) {
    throw new AppError(
      409,
      'CONFLICT',
      'A monitoring check is already in progress for this service'
    );
  }

  monitoringScheduler.setInFlight(serviceId, true);
  try {
    const metric = await monitoringService.checkService(serviceId, 'Manual');
    return success(res, 'Monitoring check completed successfully', metric, 201);
  } finally {
    monitoringScheduler.setInFlight(serviceId, false);
  }
});

/**
 * Retrieves paginated monitoring records across services with query filters.
 */
export const listMetrics: RequestHandler = asyncHandler(async (req, res) => {
  const result = await monitoringService.listMetrics(req.query as unknown as MonitoringQueryInput);
  return success(res, 'Monitoring records retrieved successfully', result);
});

/**
 * Retrieves historical monitoring records for a specific service.
 */
export const getServiceMetrics: RequestHandler = asyncHandler(async (req, res) => {
  const serviceId = req.params.serviceId as string;
  const result = await monitoringService.getServiceMetrics(
    serviceId,
    req.query as unknown as ServiceHistoryQueryInput
  );
  return success(res, 'Service monitoring records retrieved successfully', result);
});

/**
 * Retrieves the most recent monitoring check result for a service.
 */
export const getLatestMetric: RequestHandler = asyncHandler(async (req, res) => {
  const serviceId = req.params.serviceId as string;
  const result = await monitoringService.getLatestMetric(serviceId);
  return success(res, 'Latest monitoring record retrieved successfully', result);
});

/**
 * Retrieves calculated performance summary statistics for a service.
 */
export const getServiceSummary: RequestHandler = asyncHandler(async (req, res) => {
  const serviceId = req.params.serviceId as string;
  const result = await monitoringService.getSummary(
    serviceId,
    req.query as unknown as SummaryQueryInput
  );
  return success(res, 'Performance summary retrieved successfully', result);
});
