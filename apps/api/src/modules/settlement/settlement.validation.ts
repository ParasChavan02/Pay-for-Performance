import { z } from 'zod';
import { settlementStatuses } from './settlement.model';

const objectIdRegex = /^[a-f\d]{24}$/i;

// ------------------------------------------------------------------ params

export const settlementIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid MongoDB Settlement ID'),
});

export const paymentIdParamSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
});

export const settlementServiceIdParamSchema = z.object({
  serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID'),
});

// ------------------------------------------------------------------- body

export const calculateSettlementSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID'),
  contractId: z.string().regex(objectIdRegex, 'Invalid MongoDB Contract ID'),
  breachIds: z
    .array(z.string().regex(objectIdRegex, 'Each breachId must be a valid MongoDB ObjectId'))
    .min(0)
    .default([]),
  /** Authorized amount as a decimal string; also accepted as number */
  authorizedAmount: z.union([
    z.string().regex(/^\d+(\.\d{1,10})?$/, 'authorizedAmount must be a valid positive decimal'),
    z.number().positive('authorizedAmount must be a positive number'),
  ]),
  currency: z
    .string()
    .length(3, 'currency must be a 3-letter ISO 4217 code')
    .toUpperCase()
    .default('USD'),
});

// ------------------------------------------------------------------ query

export const listSettlementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(settlementStatuses).optional(),
  serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID').optional(),
  contractId: z.string().regex(objectIdRegex, 'Invalid MongoDB Contract ID').optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z
    .enum(['calculatedAt', 'finalPayableAmount', 'totalCredit', 'createdAt'])
    .default('calculatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ------------------------------------------------------------------ types

export type CalculateSettlementInput = z.infer<typeof calculateSettlementSchema>;
export type ListSettlementsQueryInput = z.infer<typeof listSettlementsQuerySchema>;
