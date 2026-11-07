import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error';
import { PerformanceMetricModel } from '../monitoring/monitoring.model';
import { ServiceModel } from '../services/service.model';
import {
  BreachSeverity,
  BreachStatus,
  ComparisonOperator,
  SLABreachDocument,
  SLABreachModel,
  SLAContractModel,
  SLATarget,
} from './sla.model';
import {
  EvaluateContractInput,
  ListBreachesQueryInput,
} from './sla.validation';

/**
 * Evaluates whether an observed metric value violates a contractual target threshold.
 */
function isTargetViolated(
  observed: number,
  operator: ComparisonOperator,
  threshold: number
): boolean {
  switch (operator) {
    case '>=':
      return observed < threshold;
    case '>':
      return observed <= threshold;
    case '<=':
      return observed > threshold;
    case '<':
      return observed >= threshold;
    case '==':
      return observed !== threshold;
    default:
      return false;
  }
}

/**
 * Deterministically calculates breach severity based on the gap between observed and target values.
 */
function calculateSeverity(
  metric: string,
  observed: number,
  threshold: number
): BreachSeverity {
  if (metric === 'uptime') {
    const gap = threshold - observed;
    if (gap >= 5.0) return 'Critical';
    if (gap >= 1.0) return 'High';
    return 'Medium';
  }

  if (metric === 'responseTime') {
    const ratio = threshold > 0 ? observed / threshold : 1;
    if (ratio >= 2.0) return 'Critical';
    if (ratio >= 1.5) return 'High';
    if (ratio >= 1.2) return 'Medium';
    return 'Low';
  }

  return 'Medium';
}

export const slaEvaluationService = {
  /**
   * Deterministically evaluates an active SLA contract against recorded monitoring evidence.
   * Calculates actual uptime & response time, detects breaches, and upserts idempotent breach records.
   */
  async evaluateContract(contractId: string, input: EvaluateContractInput) {
    const contract = await SLAContractModel.findById(contractId).lean();
    if (!contract) {
      throw new AppError(404, 'NOT_FOUND', 'SLA Contract not found');
    }

    if (contract.status !== 'Active') {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Contract ${contract.contractReference} is not active (current status: ${contract.status}). Only active contracts can be evaluated.`
      );
    }

    // Determine evaluation window: explicit query parameters or default to contract's measurement window
    const now = new Date();
    const end = input.measurementPeriodEnd || input.to || now;
    const windowMinutes = contract.measurementWindow?.durationMinutes || 43200; // default 30 days
    const start =
      input.measurementPeriodStart ||
      input.from ||
      new Date(end.getTime() - windowMinutes * 60 * 1000);

    if (end.getTime() <= start.getTime()) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'measurementPeriodEnd must be strictly after measurementPeriodStart'
      );
    }

    // Retrieve factual monitoring metrics from the existing PerformanceMetric collection
    const metrics = await PerformanceMetricModel.find({
      serviceId: contract.serviceId,
      checkedAt: { $gte: start, $lte: end },
    }).lean();

    const totalChecks = metrics.length;
    const successfulChecks = metrics.filter((m) => m.status === 'UP').length;
    const failedChecks = metrics.filter((m) => m.status === 'DOWN').length;

    // Handle zero monitoring records gracefully without assuming downtime
    if (totalChecks === 0) {
      return {
        contractId: contract._id.toString(),
        serviceId: contract.serviceId.toString(),
        contractName: contract.contractName,
        contractReference: contract.contractReference,
        measurementPeriod: {
          start,
          end,
        },
        monitoringEvidence: {
          totalChecks: 0,
          successfulChecks: 0,
          failedChecks: 0,
          calculatedUptime: 0,
          averageResponseTime: null,
          note: 'Insufficient monitoring evidence recorded for this measurement window',
        },
        targetsEvaluated: contract.targets.length,
        targetsViolated: 0,
        breaches: [],
        newBreachesCount: 0,
        updatedBreachesCount: 0,
      };
    }

    const calculatedUptime = Number(
      ((successfulChecks / totalChecks) * 100).toFixed(2)
    );

    const successfulMetrics = metrics.filter((m) => m.status === 'UP' && m.responseTime > 0);
    const avgResponseTime =
      successfulMetrics.length > 0
        ? Number(
            (
              successfulMetrics.reduce((sum, m) => sum + m.responseTime, 0) /
              successfulMetrics.length
            ).toFixed(2)
          )
        : Number(
            (metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalChecks).toFixed(2)
          );

    const breaches: SLABreachDocument[] = [];
    let newBreachesCount = 0;
    let updatedBreachesCount = 0;

    // Evaluate each contractual target independently
    for (const target of contract.targets) {
      let observedValue: number | null = null;
      let breachType = 'SLA_TARGET_BREACH';

      if (target.metric === 'uptime') {
        observedValue = calculatedUptime;
        breachType = 'UPTIME_BREACH';
      } else if (target.metric === 'responseTime') {
        observedValue = avgResponseTime;
        breachType = 'LATENCY_BREACH';
      } else if (target.metric === 'downtime') {
        // Approximate downtime based on check intervals of failed checks
        observedValue = failedChecks * 60; // seconds
        breachType = 'DOWNTIME_BREACH';
      } else {
        // Custom or unmapped metric
        observedValue = calculatedUptime;
      }

      if (
        observedValue !== null &&
        isTargetViolated(observedValue, target.operator, target.threshold)
      ) {
        const severity = calculateSeverity(target.metric, observedValue, target.threshold);

        const filter = {
          contractId: contract._id,
          metric: target.metric,
          measurementPeriodStart: start,
          measurementPeriodEnd: end,
        };

        const breachData = {
          serviceId: contract.serviceId,
          contractId: contract._id,
          metric: target.metric,
          contractualThreshold: target.threshold,
          observedValue,
          comparisonOperator: target.operator,
          severity,
          breachType,
          measurementPeriodStart: start,
          measurementPeriodEnd: end,
          evidence: {
            totalChecks,
            successfulChecks,
            failedChecks,
            avgResponseTime,
            calculatedUptime,
            metricSummary: `Observed ${target.metric} of ${observedValue}${target.unit} violated target requirement (${target.operator} ${target.threshold}${target.unit})`,
          },
          status: 'Detected' as const,
          detectedAt: new Date(),
        };

        const existing = await SLABreachModel.findOne(filter);
        if (existing) {
          const updated = await SLABreachModel.findOneAndUpdate(
            filter,
            { $set: breachData },
            { new: true }
          );
          if (updated) {
            breaches.push(updated);
            updatedBreachesCount++;
          }
        } else {
          const created = await SLABreachModel.create(breachData);
          breaches.push(created);
          newBreachesCount++;
        }
      }
    }

    return {
      contractId: contract._id.toString(),
      serviceId: contract.serviceId.toString(),
      contractName: contract.contractName,
      contractReference: contract.contractReference,
      measurementPeriod: {
        start,
        end,
      },
      monitoringEvidence: {
        totalChecks,
        successfulChecks,
        failedChecks,
        calculatedUptime,
        averageResponseTime: avgResponseTime,
      },
      targetsEvaluated: contract.targets.length,
      targetsViolated: breaches.length,
      breaches,
      newBreachesCount,
      updatedBreachesCount,
    };
  },

  /**
   * Evaluates all active contracts for a specific service.
   */
  async evaluateService(serviceId: string, input: EvaluateContractInput) {
    const service = await ServiceModel.findById(serviceId).lean();
    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'Service not found');
    }

    const activeContracts = await SLAContractModel.find({
      serviceId: new Types.ObjectId(serviceId),
      status: 'Active',
    }).lean();

    const evaluations = [];
    for (const contract of activeContracts) {
      const evaluation = await this.evaluateContract(contract._id.toString(), input);
      evaluations.push(evaluation);
    }

    return {
      serviceId,
      serviceName: service.name,
      evaluatedContractsCount: activeContracts.length,
      evaluations,
    };
  },

  /**
   * Lists detected SLA breaches with filtering and pagination.
   */
  async listBreaches(input: ListBreachesQueryInput) {
    const { page, limit, serviceId, contractId, severity, status, from, to } = input;
    const filter: Record<string, unknown> = {};

    if (serviceId) {
      filter.serviceId = new Types.ObjectId(serviceId);
    }
    if (contractId) {
      filter.contractId = new Types.ObjectId(contractId);
    }
    if (severity) {
      filter.severity = severity;
    }
    if (status) {
      filter.status = status;
    }

    if (from || to) {
      filter.detectedAt = {};
      if (from) (filter.detectedAt as Record<string, unknown>).$gte = from;
      if (to) (filter.detectedAt as Record<string, unknown>).$lte = to;
    }

    const skip = (page - 1) * limit;

    const [total, breaches] = await Promise.all([
      SLABreachModel.countDocuments(filter),
      SLABreachModel.find(filter)
        .sort({ detectedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return {
      page,
      limit,
      total,
      breaches,
    };
  },

  /**
   * Retrieves breach details by ID.
   */
  async getBreachById(id: string) {
    const breach = await SLABreachModel.findById(id).lean();
    if (!breach) {
      throw new AppError(404, 'NOT_FOUND', 'SLA Breach not found');
    }
    return breach;
  },

  /**
   * Retrieves all breaches associated with a service.
   */
  async getBreachesByServiceId(serviceId: string) {
    const service = await ServiceModel.findById(serviceId).lean();
    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'Service not found');
    }

    const breaches = await SLABreachModel.find({
      serviceId: new Types.ObjectId(serviceId),
    })
      .sort({ detectedAt: -1 })
      .lean();

    return {
      serviceId,
      total: breaches.length,
      breaches,
    };
  },

  /**
   * Updates the review status of an SLA breach (e.g. UnderReview, Confirmed, Disputed, Resolved).
   */
  async updateBreachStatus(id: string, newStatus: BreachStatus) {
    const breach = await SLABreachModel.findById(id);
    if (!breach) {
      throw new AppError(404, 'NOT_FOUND', 'SLA Breach not found');
    }

    breach.status = newStatus;
    await breach.save();

    return breach.toObject();
  },
};
