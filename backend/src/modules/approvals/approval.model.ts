import { HydratedDocument, Schema, Types, model } from 'mongoose';

export const approvalStatuses = ['Pending', 'Approved', 'Rejected', 'Cancelled'] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export interface ApprovalHistoryItem {
  status: ApprovalStatus;
  transitionAt: Date;
  actorId?: string;
  actorName?: string;
  comments?: string;
  reason?: string;
}

export interface Approval {
  settlementId: Types.ObjectId;
  policyDecisionId: Types.ObjectId;
  approvalStatus: ApprovalStatus;
  requestedAt: Date;
  reviewedAt?: Date;
  reviewerId?: string;
  reviewerName?: string;
  comments?: string;
  rejectionReason?: string;
  approvalHistory: ApprovalHistoryItem[];
  createdAt: Date;
  updatedAt: Date;
}

const approvalHistoryItemSchema = new Schema<ApprovalHistoryItem>(
  {
    status: {
      type: String,
      enum: approvalStatuses,
      required: true,
    },
    transitionAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    actorId: { type: String },
    actorName: { type: String },
    comments: { type: String },
    reason: { type: String },
  },
  { _id: false }
);

const approvalSchema = new Schema<Approval>(
  {
    settlementId: {
      type: Schema.Types.ObjectId,
      ref: 'Settlement',
      required: [true, 'Settlement ID is required'],
      index: true,
    },
    policyDecisionId: {
      type: Schema.Types.ObjectId,
      ref: 'PolicyDecision',
      required: [true, 'Policy decision ID is required'],
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: {
        values: approvalStatuses,
        message: `Status must be one of: ${approvalStatuses.join(', ')}`,
      },
      default: 'Pending',
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reviewedAt: {
      type: Date,
    },
    reviewerId: {
      type: String,
      trim: true,
    },
    reviewerName: {
      type: String,
      trim: true,
    },
    comments: {
      type: String,
      trim: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    approvalHistory: {
      type: [approvalHistoryItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

approvalSchema.index({ settlementId: 1, approvalStatus: 1 });
approvalSchema.index({ requestedAt: -1 });

export type ApprovalDocument = HydratedDocument<Approval>;
export const ApprovalModel = model<Approval>('Approval', approvalSchema);
