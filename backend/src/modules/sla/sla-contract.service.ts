import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error';
import { ServiceModel } from '../services/service.model';
import {
  ContractStatus,
  SLAContractDocument,
  SLAContractModel,
  SLACreditRule,
} from './sla.model';
import {
  CreateContractInput,
  ListContractsQueryInput,
  UpdateContractInput,
} from './sla.validation';

/**
 * Checks if another active contract overlaps with the given effective period for a service.
 */
async function checkActiveContractOverlap(
  serviceId: string,
  start: Date,
  end: Date,
  excludeContractId?: string
): Promise<void> {
  const filter: Record<string, unknown> = {
    serviceId: new Types.ObjectId(serviceId),
    status: 'Active',
    effectiveFrom: { $lt: end },
    effectiveUntil: { $gt: start },
  };

  if (excludeContractId) {
    filter._id = { $ne: new Types.ObjectId(excludeContractId) };
  }

  const existingOverlap = await SLAContractModel.findOne(filter).lean();
  if (existingOverlap) {
    throw new AppError(
      409,
      'CONFLICT',
      `An active contract (${existingOverlap.contractReference}) already covers this time window for the service`
    );
  }
}

/**
 * Normalizes credit rules to ensure exact Decimal128 representation for financial calculations.
 */
function normalizeCreditRules(rules: CreateContractInput['creditRules']): SLACreditRule[] {
  return rules.map((r) => ({
    ruleId: r.ruleId,
    description: r.description,
    applicableMetric: r.applicableMetric,
    operator: r.operator,
    threshold: r.threshold,
    creditType: r.creditType,
    creditValue: Types.Decimal128.fromString(r.creditValue.toString()),
    maxCreditLimit: r.maxCreditLimit
      ? Types.Decimal128.fromString(r.maxCreditLimit.toString())
      : undefined,
    priority: r.priority,
  }));
}

export const slaContractService = {
  /**
   * Creates a new SLA contract after validating the referenced service and reference uniqueness.
   */
  async create(input: CreateContractInput): Promise<SLAContractDocument> {
    const service = await ServiceModel.findById(input.serviceId).lean();
    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'Referenced service does not exist');
    }

    const existingRef = await SLAContractModel.findOne({
      contractReference: input.contractReference,
    }).lean();

    if (existingRef) {
      throw new AppError(409, 'CONFLICT', 'Contract reference already exists');
    }

    if (input.status === 'Active') {
      await checkActiveContractOverlap(input.serviceId, input.effectiveFrom, input.effectiveUntil);
    }

    const normalizedCreditRules = normalizeCreditRules(input.creditRules);

    const contract = await SLAContractModel.create({
      ...input,
      serviceId: new Types.ObjectId(input.serviceId),
      creditRules: normalizedCreditRules,
    });

    return contract;
  },

  /**
   * Retrieves a paginated list of SLA contracts matching the provided filter criteria.
   */
  async list(input: ListContractsQueryInput) {
    const { page, limit, serviceId, status, providerName, customerName } = input;
    const filter: Record<string, unknown> = {};

    if (serviceId) {
      filter.serviceId = new Types.ObjectId(serviceId);
    }
    if (status) {
      filter.status = status;
    }
    if (providerName) {
      filter.providerName = { $regex: providerName, $options: 'i' };
    }
    if (customerName) {
      filter.customerName = { $regex: customerName, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [total, contracts] = await Promise.all([
      SLAContractModel.countDocuments(filter),
      SLAContractModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    return {
      page,
      limit,
      total,
      contracts,
    };
  },

  /**
   * Retrieves an SLA contract by ID.
   */
  async getById(id: string) {
    const contract = await SLAContractModel.findById(id).lean();
    if (!contract) {
      throw new AppError(404, 'NOT_FOUND', 'SLA Contract not found');
    }
    return contract;
  },

  /**
   * Retrieves all SLA contracts associated with a specific service.
   */
  async getByServiceId(serviceId: string) {
    const service = await ServiceModel.findById(serviceId).lean();
    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'Referenced service does not exist');
    }

    const contracts = await SLAContractModel.find({
      serviceId: new Types.ObjectId(serviceId),
    })
      .sort({ createdAt: -1 })
      .lean();

    return {
      serviceId,
      total: contracts.length,
      contracts,
    };
  },

  /**
   * Updates an SLA contract. Protects active contracts from direct modification of immutable terms.
   */
  async update(id: string, input: UpdateContractInput) {
    const contract = await SLAContractModel.findById(id);
    if (!contract) {
      throw new AppError(404, 'NOT_FOUND', 'SLA Contract not found');
    }

    // Protect active contracts from direct alteration of contractual obligations
    if (contract.status === 'Active') {
      const immutableFieldAttempt =
        input.targets !== undefined ||
        input.creditRules !== undefined ||
        input.effectiveFrom !== undefined ||
        input.effectiveUntil !== undefined ||
        input.measurementWindow !== undefined;

      if (immutableFieldAttempt) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Active contract terms are immutable. Transition contract to Draft or create a new contract version.'
        );
      }
    }

    const updates: Record<string, unknown> = { ...input };

    if (input.creditRules) {
      updates.creditRules = normalizeCreditRules(input.creditRules);
    }

    const updated = await SLAContractModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).lean();

    return updated;
  },

  /**
   * Transitions contract status (Draft, Active, Expired, Terminated).
   * Validates date window and prevents overlapping active contracts.
   */
  async updateStatus(id: string, newStatus: ContractStatus) {
    const contract = await SLAContractModel.findById(id);
    if (!contract) {
      throw new AppError(404, 'NOT_FOUND', 'SLA Contract not found');
    }

    if (newStatus === 'Active') {
      await checkActiveContractOverlap(
        contract.serviceId.toString(),
        contract.effectiveFrom,
        contract.effectiveUntil,
        id
      );
    }

    contract.status = newStatus;
    await contract.save();

    return contract.toObject();
  },
};
