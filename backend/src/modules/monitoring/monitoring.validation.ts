import { z } from 'zod';
import { metricStatuses } from './monitoring.model';

const objectIdRegex = /^[a-f\d]{24}$/i;

export const serviceIdParamSchema = z.object({
  serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID'),
});

export const monitoringQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID').optional(),
  status: z.enum(metricStatuses).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortBy: z.enum(['checkedAt', 'responseTime', 'status']).default('checkedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const serviceHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(metricStatuses).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const summaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type MonitoringQueryInput = z.infer<typeof monitoringQuerySchema>;
export type ServiceHistoryQueryInput = z.infer<typeof serviceHistoryQuerySchema>;
export type SummaryQueryInput = z.infer<typeof summaryQuerySchema>;
