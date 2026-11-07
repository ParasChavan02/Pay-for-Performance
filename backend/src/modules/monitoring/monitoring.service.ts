import { SortOrder, Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error';
import { ServiceModel } from '../services/service.model';
import { CheckType, MetricStatus, PerformanceMetricModel } from './monitoring.model';
import {
  MonitoringQueryInput,
  ServiceHistoryQueryInput,
  SummaryQueryInput,
} from './monitoring.validation';
import { validateSSRF } from './ssrf.validator';

export interface HttpCheckResult {
  status: MetricStatus;
  responseTime: number;
  httpStatusCode: number | null;
  errorMessage?: string;
}

export const monitoringService = {
  /**
   * Executes an isolated HTTP GET check against a target URL.
   * Measures response latency and determines UP or DOWN status with SSRF prevention.
   */
  async performHttpCheck(baseUrl: string, timeoutMs = 5000): Promise<HttpCheckResult> {
    // Validate target URL against SSRF rules before dispatching network request
    const ssrfCheck = await validateSSRF(baseUrl);
    if (!ssrfCheck.safe) {
      return {
        status: 'DOWN',
        responseTime: 0,
        httpStatusCode: null,
        errorMessage: `Destination blocked by SSRF security policy: ${ssrfCheck.reason}`,
      };
    }

    const startTime = performance.now();

    try {
      const response = await fetch(baseUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'manual', // Prevent arbitrary redirect following
      });

      const responseTime = Math.max(1, Math.round(performance.now() - startTime));

      // 2xx responses are considered UP; 3xx/4xx/5xx are considered DOWN in initial MVP
      if (response.status >= 200 && response.status < 300) {
        return {
          status: 'UP',
          responseTime,
          httpStatusCode: response.status,
        };
      }

      return {
        status: 'DOWN',
        responseTime,
        httpStatusCode: response.status,
        errorMessage: `HTTP response status ${response.status}${response.statusText ? ` (${response.statusText})` : ''}`,
      };
    } catch (error) {
      const responseTime = Math.max(1, Math.round(performance.now() - startTime));
      const err = error as Error;

      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return {
          status: 'DOWN',
          responseTime,
          httpStatusCode: null,
          errorMessage: `Request timed out after ${timeoutMs}ms`,
        };
      }

      return {
        status: 'DOWN',
        responseTime,
        httpStatusCode: null,
        errorMessage: `Connection failed: ${err.message || 'Network error'}`,
      };
    }
  },

  /**
   * Performs a monitoring check on a service by ID and persists the result.
   */
  async checkService(serviceId: string, checkType: CheckType = 'Scheduled') {
    const service = await ServiceModel.findById(serviceId).lean();
    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'Service not found');
    }

    const checkResult = await this.performHttpCheck(service.baseUrl, 5000);

    const metric = await PerformanceMetricModel.create({
      serviceId: new Types.ObjectId(serviceId),
      checkedAt: new Date(),
      responseTime: checkResult.responseTime,
      status: checkResult.status,
      httpStatusCode: checkResult.httpStatusCode,
      errorMessage: checkResult.errorMessage,
      checkType,
    });

    return metric;
  },

  /**
   * Retrieves paginated monitoring records across all services with filtering.
   */
  async listMetrics(input: MonitoringQueryInput) {
    const { page, limit, serviceId, status, from, to, startDate, endDate, sortBy, sortOrder } =
      input;
    const filter: Record<string, unknown> = {};

    if (serviceId) {
      filter.serviceId = new Types.ObjectId(serviceId);
    }

    if (status) {
      filter.status = status;
    }

    const effectiveFrom = from || startDate;
    const effectiveTo = to || endDate;

    if (effectiveFrom || effectiveTo) {
      filter.checkedAt = {};
      if (effectiveFrom) (filter.checkedAt as Record<string, unknown>).$gte = effectiveFrom;
      if (effectiveTo) (filter.checkedAt as Record<string, unknown>).$lte = effectiveTo;
    }

    const skip = (page - 1) * limit;
    const sortDirection: SortOrder = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, SortOrder> = { [sortBy]: sortDirection };

    const [total, metrics] = await Promise.all([
      PerformanceMetricModel.countDocuments(filter),
      PerformanceMetricModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    ]);

    return {
      page,
      limit,
      total,
      metrics,
    };
  },

  /**
   * Retrieves historical monitoring records for a specific service.
   */
  async getServiceMetrics(serviceId: string, input: ServiceHistoryQueryInput) {
    const service = await ServiceModel.findById(serviceId).lean();
    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'Service not found');
    }

    const { page, limit, status, from, to, startDate, endDate } = input;
    const filter: Record<string, unknown> = { serviceId: new Types.ObjectId(serviceId) };

    if (status) {
      filter.status = status;
    }

    const effectiveFrom = from || startDate;
    const effectiveTo = to || endDate;

    if (effectiveFrom || effectiveTo) {
      filter.checkedAt = {};
      if (effectiveFrom) (filter.checkedAt as Record<string, unknown>).$gte = effectiveFrom;
      if (effectiveTo) (filter.checkedAt as Record<string, unknown>).$lte = effectiveTo;
    }

    const skip = (page - 1) * limit;

    const [total, metrics] = await Promise.all([
      PerformanceMetricModel.countDocuments(filter),
      PerformanceMetricModel.find(filter)
        .sort({ checkedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return {
      serviceId,
      page,
      limit,
      total,
      metrics,
    };
  },

  /**
   * Retrieves the most recent monitoring result for a service.
   */
  async getLatestMetric(serviceId: string) {
    const service = await ServiceModel.findById(serviceId).lean();
    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'Service not found');
    }

    const metric = await PerformanceMetricModel.findOne({
      serviceId: new Types.ObjectId(serviceId),
    })
      .sort({ checkedAt: -1 })
      .lean();

    if (!metric) {
      throw new AppError(404, 'NOT_FOUND', 'No monitoring records found for this service');
    }

    return metric;
  },

  /**
   * Calculates performance summary statistics (uptime, response time, check counts).
   */
  async getSummary(serviceId: string, input: SummaryQueryInput) {
    const service = await ServiceModel.findById(serviceId).lean();
    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'Service not found');
    }

    const effectiveFrom = input.from || input.startDate;
    const effectiveTo = input.to || input.endDate;

    const match: Record<string, unknown> = {
      serviceId: new Types.ObjectId(serviceId),
    };

    if (effectiveFrom || effectiveTo) {
      match.checkedAt = {};
      if (effectiveFrom) (match.checkedAt as Record<string, unknown>).$gte = effectiveFrom;
      if (effectiveTo) (match.checkedAt as Record<string, unknown>).$lte = effectiveTo;
    }

    const [stats] = await PerformanceMetricModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalChecks: { $sum: 1 },
          successfulChecks: {
            $sum: { $cond: [{ $eq: ['$status', 'UP'] }, 1, 0] },
          },
          failedChecks: {
            $sum: { $cond: [{ $eq: ['$status', 'DOWN'] }, 1, 0] },
          },
          avgResponseTime: { $avg: '$responseTime' },
          minResponseTime: { $min: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' },
        },
      },
    ]);

    const latest = await PerformanceMetricModel.findOne(match)
      .sort({ checkedAt: -1 })
      .lean();

    if (!stats || stats.totalChecks === 0) {
      return {
        serviceId,
        serviceName: service.name,
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        uptimePercentage: 0,
        avgResponseTime: null,
        minResponseTime: null,
        maxResponseTime: null,
        lastCheckedAt: null,
        currentStatus: 'UNKNOWN',
      };
    }

    const uptimePercentage = Number(
      ((stats.successfulChecks / stats.totalChecks) * 100).toFixed(2)
    );

    return {
      serviceId,
      serviceName: service.name,
      totalChecks: stats.totalChecks,
      successfulChecks: stats.successfulChecks,
      failedChecks: stats.failedChecks,
      uptimePercentage,
      avgResponseTime: Number(stats.avgResponseTime.toFixed(2)),
      minResponseTime: stats.minResponseTime,
      maxResponseTime: stats.maxResponseTime,
      lastCheckedAt: latest?.checkedAt ?? null,
      currentStatus: latest?.status ?? 'UNKNOWN',
    };
  },
};
