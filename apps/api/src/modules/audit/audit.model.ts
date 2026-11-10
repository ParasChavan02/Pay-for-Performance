import { HydratedDocument, Schema, Types, model } from 'mongoose';

export interface AuditLog {
  action: string;
  entityType: 'Policy' | 'Settlement' | 'Approval' | 'PolicyDecision' | string;
  entityId: string;
  settlementId?: Types.ObjectId;
  actorId?: string;
  description: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
}

const auditSchema = new Schema<AuditLog>(
  {
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    settlementId: { type: Schema.Types.ObjectId, ref: 'Settlement', index: true },
    actorId: { type: String },
    description: { type: String, required: true },
    reason: { type: String },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // append-only: no updatedAt
  }
);

auditSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditSchema.index({ settlementId: 1, timestamp: -1 });

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogModel = model<AuditLog>('AuditLog', auditSchema);
