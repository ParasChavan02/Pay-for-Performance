import { HydratedDocument, Schema, model } from 'mongoose';

export const serviceEnvironments = ['Development', 'Staging', 'Production'] as const;
export const serviceStatuses = ['Active', 'Inactive'] as const;

export type ServiceEnvironment = (typeof serviceEnvironments)[number];
export type ServiceStatus = (typeof serviceStatuses)[number];

export interface Service {
  name: string;
  description?: string;
  baseUrl: string;
  environment: ServiceEnvironment;
  monitoringInterval: number;
  expectedUptime: number;
  maxResponseTime: number;
  status: ServiceStatus;
  createdAt: Date;
  updatedAt: Date;
}

const baseUrlValidator = (value: string): boolean => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
};

const serviceSchema = new Schema<Service>(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      minlength: [1, 'Service name cannot be empty'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    baseUrl: {
      type: String,
      required: [true, 'Base URL is required'],
      trim: true,
      validate: {
        validator: baseUrlValidator,
        message: 'baseUrl must be an HTTP or HTTPS URL without embedded credentials',
      },
    },
    environment: {
      type: String,
      enum: {
        values: serviceEnvironments,
        message: 'Environment must be Development, Staging, or Production',
      },
      required: [true, 'Environment is required'],
    },
    monitoringInterval: {
      type: Number,
      default: 60,
      min: [1, 'Monitoring interval must be a positive integer'],
      validate: {
        validator: Number.isInteger,
        message: 'monitoringInterval must be an integer',
      },
    },
    expectedUptime: {
      type: Number,
      default: 99.9,
      min: [0, 'Expected uptime must be between 0 and 100'],
      max: [100, 'Expected uptime must be between 0 and 100'],
    },
    maxResponseTime: {
      type: Number,
      default: 500,
      min: [0.000001, 'Maximum response time must be positive'],
    },
    status: {
      type: String,
      enum: {
        values: serviceStatuses,
        message: 'Status must be Active or Inactive',
      },
      default: 'Active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

serviceSchema.index({ status: 1, createdAt: -1 });

export type ServiceDocument = HydratedDocument<Service>;
export const ServiceModel = model<Service>('Service', serviceSchema);
