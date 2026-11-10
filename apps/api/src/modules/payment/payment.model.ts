import { Document, Schema, Types, model } from 'mongoose';

export type PaymentStatus =
  | 'CREATED'
  | 'APPROVAL_PENDING'
  | 'AUTHORIZED'
  | 'PARTIALLY_CAPTURED'
  | 'CAPTURED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'VOIDED'
  | 'FAILED';

export interface PaymentDocument extends Document {
  paymentId: string;
  orderId?: string;
  authorizationId?: string;
  captureId?: string;
  refundId?: string;
  settlementId?: Types.ObjectId | string;
  serviceId?: Types.ObjectId | string;
  contractId?: Types.ObjectId | string;
  authorizedAmount: Types.Decimal128;
  capturedAmount: Types.Decimal128;
  refundedAmount: Types.Decimal128;
  currency: string;
  paymentStatus: PaymentStatus;
  approvalUrl?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentDocument>(
  {
    paymentId: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, unique: true, sparse: true, index: true },
    authorizationId: { type: String, sparse: true, index: true },
    captureId: { type: String, sparse: true, index: true },
    refundId: { type: String, sparse: true, index: true },
    settlementId: { type: Schema.Types.ObjectId, ref: 'Settlement', sparse: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', sparse: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'SLAContract', sparse: true },
    authorizedAmount: { type: Schema.Types.Decimal128, required: true },
    capturedAmount: { type: Schema.Types.Decimal128, default: () => Types.Decimal128.fromString('0.00') },
    refundedAmount: { type: Schema.Types.Decimal128, default: () => Types.Decimal128.fromString('0.00') },
    currency: { type: String, default: 'USD', uppercase: true },
    paymentStatus: {
      type: String,
      enum: [
        'CREATED',
        'APPROVAL_PENDING',
        'AUTHORIZED',
        'PARTIALLY_CAPTURED',
        'CAPTURED',
        'PARTIALLY_REFUNDED',
        'REFUNDED',
        'VOIDED',
        'FAILED',
      ],
      default: 'CREATED',
      index: true,
    },
    approvalUrl: { type: String },
    description: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const PaymentModel = model<PaymentDocument>('Payment', paymentSchema);
