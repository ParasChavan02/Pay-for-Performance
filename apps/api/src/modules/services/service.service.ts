import { AppError } from '../../shared/errors/app-error';
import { CreateServiceInput, PaginationInput, UpdateServiceInput } from './service.validation';
import { ServiceModel } from './service.model';
import { monitoringScheduler } from '../monitoring/monitoring.scheduler';

export const serviceService = {
  async create(input: CreateServiceInput) {
    const service = await ServiceModel.create(input);
    if (service.status === 'Active') {
      monitoringScheduler.scheduleService(service);
    }
    return service;
  },

  async list({ page, limit }: PaginationInput) {
    const skip = (page - 1) * limit;
    const [total, active, inactive, services] = await Promise.all([
      ServiceModel.countDocuments(),
      ServiceModel.countDocuments({ status: 'Active' }),
      ServiceModel.countDocuments({ status: 'Inactive' }),
      ServiceModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    return {
      page,
      limit,
      total,
      totalServices: total,
      activeCount: active,
      activeServices: active,
      inactiveCount: inactive,
      inactiveServices: inactive,
      services,
    };
  },

  async getById(id: string) {
    const service = await ServiceModel.findById(id).lean();
    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'Service not found');
    }
    return service;
  },

  async update(id: string, input: UpdateServiceInput) {
    const { _id, createdAt, updatedAt, ...cleanUpdates } = input as Record<string, unknown>;
    const service = await ServiceModel.findByIdAndUpdate(id, cleanUpdates, {
      new: true,
      runValidators: true,
    }).lean();

    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'Service not found');
    }

    monitoringScheduler.rescheduleService(service);
    return service;
  },

  async remove(id: string) {
    const service = await ServiceModel.findByIdAndDelete(id).lean();
    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'Service not found');
    }

    // Unschedule background monitoring; preserve historical metrics in MongoDB for SLA auditing
    monitoringScheduler.unscheduleService(id);
    return service;
  },
};
