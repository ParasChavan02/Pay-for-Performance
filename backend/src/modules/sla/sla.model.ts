import { HydratedDocument, Schema, Types, model } from 'mongoose';

export const contractStatuses = ['Draft', 'Active', 'Expired', 'Terminated'] as const;
export type ContractStatus = (typeof contractStatuses)[number];

export const targetMetrics = ['uptime', 'responseTime', 'downtime', 'custom'] as const;
export type TargetMetric = (typeof targetMetrics)[number];

export const comparisonOperators = ['<', '<=', '>', '>=', '=='] as const;
export type ComparisonOperator = (typeof comparisonOperators)[number];

export const creditTypes = ['FIXED', 'PERCENTAGE'] as const;
export type CreditType = (typeof creditTypes)[number];

export const breachSeverities = ['Low', 'Medium', 'High', 'Critical'] as const;
export type BreachSeverity = (typeof breachSeverities)[number];

export const breachStatuses = [
  'Detected',
  'UnderReview',
  'Confirmed',
  'Disputed',
  'Resolved',
] as const;
export type BreachStatus = (typeof breachStatuses)[number];

export interface SLATarget {
  metric: TargetMetric | string;
  operator: ComparisonOperator;
  threshold: number;
  unit: string;
  description?: string;
}

export interface SLACreditRule {
  ruleId: string;
  description: string;
  applicableMetric: string;
  operator: ComparisonOperator;
  threshold: number;
  creditType: CreditType;
  creditValue: Types.Decimal128;
  maxCreditLimit?: Types.Decimal128;
  priority: number;
}

export interface SLAMeasurementWindow {
  type: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  durationMinutes?: number;
}

export interface SLAContract {
  serviceId: Types.ObjectId;
  contractName: string;
  contractReference: string;
  providerName: string;
  customerName: string;
  effectiveFrom: Date;
  effectiveUntil: Date;
  status: ContractStatus;
  measurementWindow: SLAMeasurementWindow;
  targets: SLATarget[];
  creditRules: SLACreditRule[];
  source?: {
    fileName?: string;
    fileHash?: string;
    uploadedAt?: Date;
  };
  extractionMetadata?: {
    modelVersion?: string;
    confidenceScore?: number;
    extractedAt?: Date;
    rawSchemaVersion?: string;
  };
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLABreachEvidence {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  avgResponseTime: number | null;
  calculatedUptime: number;
  metricSummary?: string;
}

export interface SLABreach {
  serviceId: Types.ObjectId;
  contractId: Types.ObjectId;
  metric: string;
  contractualThreshold: number;
  observedValue: number;
  comparisonOperator: ComparisonOperator | string;
  severity: BreachSeverity;
  breachType: string;
  measurementPeriodStart: Date;
  measurementPeriodEnd: Date;
  evidence: SLABreachEvidence;
  status: BreachStatus;
  detectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ----------------- SCHEMAS -----------------

const targetSchema = new Schema<SLATarget>(
  {
    metric: { type: String, required: true, trim: true },
    operator: { type: String, enum: comparisonOperators, required: true },
    threshold: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const creditRuleSchema = new Schema<SLACreditRule>(
  {
    ruleId: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    applicableMetric: { type: String, required: true, trim: true },
    operator: { type: String, enum: comparisonOperators, required: true },
    threshold: { type: Number, required: true },
    creditType: { type: String, enum: creditTypes, required: true },
    creditValue: { type: Schema.Types.Decimal128, required: true },
    maxCreditLimit: { type: Schema.Types.Decimal128 },
    priority: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

const contractSchema = new Schema<SLAContract>(
  {
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required'],
      index: true,
    },
    contractName: {
      type: String,
      required: [true, 'Contract name is required'],
      trim: true,
      minlength: [1, 'Contract name cannot be empty'],
    },
    contractReference: {
      type: String,
      required: [true, 'Contract reference is required'],
      trim: true,
      unique: true,
      index: true,
    },
    providerName: {
      type: String,
      required: [true, 'Provider name is required'],
      trim: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    effectiveFrom: {
      type: Date,
      required: [true, 'Effective from date is required'],
      index: true,
    },
    effectiveUntil: {
      type: Date,
      required: [true, 'Effective until date is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: contractStatuses,
        message: 'Status must be Draft, Active, Expired, or Terminated',
      },
      default: 'Draft',
      index: true,
    },
    measurementWindow: {
      type: {
        type: String,
        enum: ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
        default: 'MONTHLY',
      },
      durationMinutes: {
        type: Number,
        default: 43200, // 30 days
      },
    },
    targets: {
      type: [targetSchema],
      default: [],
    },
    creditRules: {
      type: [creditRuleSchema],
      default: [],
    },
    source: {
      fileName: { type: String, trim: true },
      fileHash: { type: String, trim: true },
      uploadedAt: { type: Date },
    },
    extractionMetadata: {
      modelVersion: { type: String, trim: true },
      confidenceScore: { type: Number, min: 0, max: 1 },
      extractedAt: { type: Date },
      rawSchemaVersion: { type: String, trim: true },
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

contractSchema.index({ serviceId: 1, status: 1 });
contractSchema.index({ serviceId: 1, effectiveFrom: 1, effectiveUntil: 1 });

const breachSchema = new Schema<SLABreach>(
  {
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required'],
      index: true,
    },
    contractId: {
      type: Schema.Types.ObjectId,
      ref: 'SLAContract',
      required: [true, 'Contract ID is required'],
      index: true,
    },
    metric: {
      type: String,
      required: [true, 'Metric name is required'],
      trim: true,
    },
    contractualThreshold: {
      type: Number,
      required: [true, 'Contractual threshold is required'],
    },
    observedValue: {
      type: Number,
      required: [true, 'Observed value is required'],
    },
    comparisonOperator: {
      type: String,
      required: [true, 'Comparison operator is required'],
    },
    severity: {
      type: String,
      enum: {
        values: breachSeverities,
        message: 'Severity must be Low, Medium, High, or Critical',
      },
      required: [true, 'Severity is required'],
      index: true,
    },
    breachType: {
      type: String,
      required: [true, 'Breach type is required'],
      trim: true,
    },
    measurementPeriodStart: {
      type: Date,
      required: [true, 'Measurement period start date is required'],
      index: true,
    },
    measurementPeriodEnd: {
      type: Date,
      required: [true, 'Measurement period end date is required'],
      index: true,
    },
    evidence: {
      totalChecks: { type: Number, required: true },
      successfulChecks: { type: Number, required: true },
      failedChecks: { type: Number, required: true },
      avgResponseTime: { type: Number, default: null },
      calculatedUptime: { type: Number, required: true },
      metricSummary: { type: String },
    },
    status: {
      type: String,
      enum: {
        values: breachStatuses,
        message: 'Status must be Detected, UnderReview, Confirmed, Disputed, or Resolved',
      },
      default: 'Detected',
      index: true,
    },
    detectedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Idempotency compound unique index: one breach record per contract + metric + window
breachSchema.index(
  {
    contractId: 1,
    metric: 1,
    measurementPeriodStart: 1,
    measurementPeriodEnd: 1,
  },
  { unique: true }
);

breachSchema.index({ serviceId: 1, status: 1, detectedAt: -1 });

export type SLAContractDocument = HydratedDocument<SLAContract>;
export type SLABreachDocument = HydratedDocument<SLABreach>;

export const SLAContractModel = model<SLAContract>('SLAContract', contractSchema);
export const SLABreachModel = model<SLABreach>('SLABreach', breachSchema);
