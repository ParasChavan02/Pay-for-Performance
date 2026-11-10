import { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler';
import { success } from '../../shared/utils/api-response';
import { auditService } from './audit.service';
import { AppError } from '../../shared/errors/app-error';

const objectIdRegex = /^[a-f\d]{24}$/i;

export const settlementAudit: RequestHandler = asyncHandler(async (req, res) => {
  const settlementId = req.params['id'] as string;
  if (!objectIdRegex.test(settlementId)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid settlement ID format');
  }

  const logs = await auditService.getBySettlement(settlementId);
  success(res, 'Settlement audit trail retrieved successfully', logs);
});

export const listAuditLogs: RequestHandler = asyncHandler(async (req, res) => {
  const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 50;
  const logs = await auditService.listAll(limit);
  success(res, 'Audit trail retrieved successfully', logs);
});
