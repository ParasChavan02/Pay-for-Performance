import { Types } from 'mongoose';
import { AuditLog, AuditLogDocument, AuditLogModel } from './audit.model';

export interface AppendAuditInput {
  action: string;
  entityType: 'Policy' | 'Settlement' | 'Approval' | 'PolicyDecision' | string;
  entityId: string;
  settlementId?: string | Types.ObjectId;
  actorId?: string;
  description: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export const auditService = {
  /**
   * Append an immutable audit trail entry.
   * This is append-only across the entire system.
   */
  async append(input: AppendAuditInput): Promise<AuditLogDocument> {
    const doc = await AuditLogModel.create({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      settlementId: input.settlementId ? new Types.ObjectId(input.settlementId) : undefined,
      actorId: input.actorId,
      description: input.description,
      reason: input.reason,
      before: input.before,
      after: input.after,
      metadata: input.metadata ?? {},
      timestamp: new Date(),
    });

    return doc;
  },

  /**
   * Retrieve the complete audit trail for a settlement, ordered chronologically.
   */
  async getBySettlement(settlementId: string): Promise<AuditLogDocument[]> {
    const logs = await AuditLogModel.find({
      $or: [
        { settlementId: new Types.ObjectId(settlementId) },
        { entityType: 'Settlement', entityId: settlementId },
      ],
    })
      .sort({ timestamp: 1 })
      .lean();

    return logs as unknown as AuditLogDocument[];
  },

  /**
   * Retrieve audit logs by entity type and ID.
   */
  async getByEntity(entityType: string, entityId: string): Promise<AuditLogDocument[]> {
    const logs = await AuditLogModel.find({ entityType, entityId })
      .sort({ timestamp: 1 })
      .lean();

    return logs as unknown as AuditLogDocument[];
  },
};
