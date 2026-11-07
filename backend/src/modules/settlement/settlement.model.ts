import { HydratedDocument, Schema, Types, model } from 'mongoose';

// ------------------------------------------------------------------ constants

export const settlementStatuses = [
  'Draft',
  'Calculated',
  'RequiresReview',
  'Approved',
  'Rejected',
  'Blocked',
  'ReadyForPayment',
  'PaymentPending',
  'Paid',
  'Failed',
] as const;

export type SettlementStatus = (typeof settlementStatuses)[number];

// ---------------------------------------------------------------- interfaces

export interface CalculationBreakdownItem {
  ruleId: string;
  ruleDescription: string;
  breachId: string;
  metric: string;
  contractualThreshold: number;
  observedValue: number;
  creditType: 'FIXED' | 'PERCENTAGE';
  creditValue: Types.Decimal128;
  creditAmountCalculated: Types.Decimal128;
  applied: boolean;
  reason: string;
}

export interface Settlement {
  paymentId: string;
  serviceId: Types.ObjectId;
  contractId: Types.ObjectId;
  breachIds: Types.ObjectId[];
  authorizedAmount: Types.Decimal128;
  totalCredit: Types.Decimal128;
  finalPayableAmount: Types.Decimal128;
  currency: string;
  calculationBreakdown: CalculationBreakdownItem[];
  calculationVersion: string;
  contractVersion: number;
  status: SettlementStatus;
  requiresReviewReason?: string;
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ------------------------------------------------------------------ schemas

const breakdownItemSchema = new Schema<CalculationBreakdownItem>(
  {
    ruleId: { type: String, required: true },
    ruleDescription: { type: String, required: true },
    breachId: { type: String, required: true },
    metric: { type: String, required: true },
    contractualThreshold: { type: Number, required: true },
    observedValue: { type: Number, required: true },
    creditType: { type: String, enum: ['FIXED', 'PERCENTAGE'], required: true },
    creditValue: { type: Schema.Types.Decimal128, required: true },
    creditAmountCalculated: { type: Schema.Types.Decimal128, required: true },
    applied: { type: Boolean, required: true },
    reason: { type: String, required: true },
  },
  { _id: false }
);

const settlementSchema = new Schema<Settlement>(
  {
    paymentId: {
      type: String,
      required: [true, 'Payment ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
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
    breachIds: {
      type: [Schema.Types.ObjectId],
      ref: 'SLABreach',
      default: [],
    },
    authorizedAmount: {
      type: Schema.Types.Decimal128,
      required: [true, 'Authorized amount is required'],
    },
    totalCredit: {
      type: Schema.Types.Decimal128,
      required: [true, 'Total credit is required'],
    },
    finalPayableAmount: {
      type: Schema.Types.Decimal128,
      required: [true, 'Final payable amount is required'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    calculationBreakdown: {
      type: [breakdownItemSchema],
      default: [],
    },
    calculationVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    contractVersion: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: settlementStatuses,
        message: `Status must be one of: ${settlementStatuses.join(', ')}`,
      },
      default: 'Calculated',
      index: true,
    },
    requiresReviewReason: {
      type: String,
      trim: true,
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

settlementSchema.index({ serviceId: 1, status: 1 });
settlementSchema.index({ contractId: 1, status: 1 });
settlementSchema.index({ serviceId: 1, calculatedAt: -1 });

export type SettlementDocument = HydratedDocument<Settlement>;
export const SettlementModel = model<Settlement>('Settlement', settlementSchema);
