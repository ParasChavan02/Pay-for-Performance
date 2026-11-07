import { HydratedDocument, Schema, model, Types } from 'mongoose';

export const metricStatuses = ['UP', 'DOWN'] as const;
export const checkTypes = ['Scheduled', 'Manual'] as const;

export type MetricStatus = (typeof metricStatuses)[number];
export type CheckType = (typeof checkTypes)[number];

export interface PerformanceMetric {
  serviceId: Types.ObjectId;
  checkedAt: Date;
  responseTime: number;
  status: MetricStatus;
  httpStatusCode: number | null;
  errorMessage?: string;
  checkType: CheckType;
  createdAt: Date;
  updatedAt: Date;
}

const performanceMetricSchema = new Schema<PerformanceMetric>(
  {
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required'],
      index: true,
    },
    checkedAt: {
      type: Date,
      required: [true, 'Check timestamp is required'],
      default: Date.now,
      index: true,
    },
    responseTime: {
      type: Number,
      required: [true, 'Response time is required'],
      min: [0, 'Response time cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: metricStatuses,
        message: 'Status must be UP or DOWN',
      },
      required: [true, 'Status is required'],
      index: true,
    },
    httpStatusCode: {
      type: Number,
      default: null,
    },
    errorMessage: {
      type: String,
      trim: true,
      default: undefined,
    },
    checkType: {
      type: String,
      enum: {
        values: checkTypes,
        message: 'Check type must be Scheduled or Manual',
      },
      required: [true, 'Check type is required'],
      default: 'Scheduled',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal historical and performance queries
performanceMetricSchema.index({ serviceId: 1, checkedAt: -1 });
performanceMetricSchema.index({ serviceId: 1, status: 1, checkedAt: -1 });

export type PerformanceMetricDocument = HydratedDocument<PerformanceMetric>;
export const PerformanceMetricModel = model<PerformanceMetric>(
  'PerformanceMetric',
  performanceMetricSchema
);
