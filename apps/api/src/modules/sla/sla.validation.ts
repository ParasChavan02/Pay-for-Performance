import { z } from 'zod';
import {
  breachSeverities,
  breachStatuses,
  comparisonOperators,
  contractStatuses,
  creditTypes,
} from './sla.model';

const objectIdRegex = /^[a-f\d]{24}$/i;

export const contractIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid MongoDB Contract ID'),
});

export const evaluateContractParamSchema = z
  .object({
    contractId: z.string().regex(objectIdRegex, 'Invalid MongoDB Contract ID').optional(),
    id: z.string().regex(objectIdRegex, 'Invalid MongoDB Contract ID').optional(),
  })
  .refine((data) => Boolean(data.contractId || data.id), {
    message: 'Invalid MongoDB Contract ID',
  });

export const breachIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid MongoDB Breach ID'),
});

export const serviceIdParamSchema = z.object({
  serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID'),
});

export const slaTargetSchema = z.object({
  metric: z.string().trim().min(1, 'Target metric is required'),
  operator: z.enum(comparisonOperators, {
    errorMap: () => ({ message: 'Operator must be <, <=, >, >=, or ==' }),
  }),
  threshold: z.coerce.number({ required_error: 'Target threshold is required' }),
  unit: z.string().trim().min(1, 'Target unit is required'),
  description: z.string().trim().optional(),
});

export const slaCreditRuleSchema = z.object({
  ruleId: z.string().trim().min(1, 'Rule ID is required'),
  description: z.string().trim().min(1, 'Rule description is required'),
  applicableMetric: z.string().trim().min(1, 'Applicable metric is required'),
  operator: z.enum(comparisonOperators, {
    errorMap: () => ({ message: 'Operator must be <, <=, >, >=, or ==' }),
  }),
  threshold: z.coerce.number({ required_error: 'Credit rule threshold is required' }),
  creditType: z.enum(creditTypes, {
    errorMap: () => ({ message: 'Credit type must be FIXED or PERCENTAGE' }),
  }),
  creditValue: z.union([
    z.coerce.number().positive('Credit value must be positive'),
    z.string().regex(/^\d+(\.\d+)?$/, 'Credit value must be a valid positive decimal'),
  ]),
  maxCreditLimit: z
    .union([
      z.coerce.number().positive(),
      z.string().regex(/^\d+(\.\d+)?$/),
    ])
    .optional(),
  priority: z.coerce.number().int().positive().default(1),
});

export const measurementWindowSchema = z.object({
  type: z
    .enum(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'])
    .default('MONTHLY'),
  durationMinutes: z.coerce.number().int().positive().default(43200),
});

export const createContractSchema = z
  .object({
    serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID'),
    contractName: z.string().trim().min(1, 'Contract name cannot be empty'),
    contractReference: z.string().trim().min(1, 'Contract reference cannot be empty'),
    providerName: z.string().trim().min(1, 'Provider name cannot be empty'),
    customerName: z.string().trim().min(1, 'Customer name cannot be empty'),
    effectiveFrom: z.coerce.date({ required_error: 'Effective from date is required' }),
    effectiveUntil: z.coerce.date({ required_error: 'Effective until date is required' }),
    status: z.enum(contractStatuses).default('Draft'),
    measurementWindow: measurementWindowSchema.default({
      type: 'MONTHLY',
      durationMinutes: 43200,
    }),
    targets: z.array(slaTargetSchema).default([]),
    creditRules: z.array(slaCreditRuleSchema).default([]),
    source: z
      .object({
        fileName: z.string().trim().optional(),
        fileHash: z.string().trim().optional(),
        uploadedAt: z.coerce.date().optional(),
      })
      .optional(),
    extractionMetadata: z
      .object({
        modelVersion: z.string().trim().optional(),
        confidenceScore: z.coerce.number().min(0).max(1).optional(),
        extractedAt: z.coerce.date().optional(),
        rawSchemaVersion: z.string().trim().optional(),
      })
      .optional(),
    version: z.coerce.number().int().positive().default(1),
  })
  .refine((data) => data.effectiveUntil.getTime() > data.effectiveFrom.getTime(), {
    message: 'effectiveUntil date must be strictly after effectiveFrom date',
    path: ['effectiveUntil'],
  });

export const updateContractSchema = z
  .object({
    contractName: z.string().trim().min(1).optional(),
    providerName: z.string().trim().min(1).optional(),
    customerName: z.string().trim().min(1).optional(),
    effectiveFrom: z.coerce.date().optional(),
    effectiveUntil: z.coerce.date().optional(),
    measurementWindow: measurementWindowSchema.optional(),
    targets: z.array(slaTargetSchema).optional(),
    creditRules: z.array(slaCreditRuleSchema).optional(),
    source: z
      .object({
        fileName: z.string().trim().optional(),
        fileHash: z.string().trim().optional(),
        uploadedAt: z.coerce.date().optional(),
      })
      .optional(),
    extractionMetadata: z
      .object({
        modelVersion: z.string().trim().optional(),
        confidenceScore: z.coerce.number().min(0).max(1).optional(),
        extractedAt: z.coerce.date().optional(),
        rawSchemaVersion: z.string().trim().optional(),
      })
      .optional(),
    _id: z.never().optional(),
    serviceId: z.never().optional(),
    contractReference: z.never().optional(),
    status: z.never().optional(),
    createdAt: z.never().optional(),
    updatedAt: z.never().optional(),
  })
  .strict('Unrecognized or non-updatable fields supplied')
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one updatable field must be supplied',
  })
  .refine(
    (data) => {
      if (data.effectiveFrom && data.effectiveUntil) {
        return data.effectiveUntil.getTime() > data.effectiveFrom.getTime();
      }
      return true;
    },
    {
      message: 'effectiveUntil date must be strictly after effectiveFrom date',
      path: ['effectiveUntil'],
    }
  );

export const updateContractStatusSchema = z.object({
  status: z.enum(contractStatuses, {
    errorMap: () => ({ message: 'Status must be Draft, Active, Expired, or Terminated' }),
  }),
});

export const listContractsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID').optional(),
  status: z.enum(contractStatuses).optional(),
  providerName: z.string().trim().optional(),
  customerName: z.string().trim().optional(),
});

export const evaluateContractSchema = z
  .object({
    measurementPeriodStart: z.coerce.date().optional(),
    measurementPeriodEnd: z.coerce.date().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      const start = data.measurementPeriodStart || data.from;
      const end = data.measurementPeriodEnd || data.to;
      if (start && end) {
        return end.getTime() > start.getTime();
      }
      return true;
    },
    {
      message: 'measurementPeriodEnd must be strictly after measurementPeriodStart',
      path: ['measurementPeriodEnd'],
    }
  );

export const updateBreachStatusSchema = z.object({
  status: z.enum(breachStatuses, {
    errorMap: () => ({
      message:
        'Status must be Detected, UnderReview, Confirmed, Disputed, or Resolved',
    }),
  }),
});

export const listBreachesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID').optional(),
  contractId: z.string().regex(objectIdRegex, 'Invalid MongoDB Contract ID').optional(),
  severity: z.enum(breachSeverities).optional(),
  status: z.enum(breachStatuses).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type UpdateContractStatusInput = z.infer<typeof updateContractStatusSchema>;
export type ListContractsQueryInput = z.infer<typeof listContractsQuerySchema>;
export type EvaluateContractInput = z.infer<typeof evaluateContractSchema>;
export type UpdateBreachStatusInput = z.infer<typeof updateBreachStatusSchema>;
export type ListBreachesQueryInput = z.infer<typeof listBreachesQuerySchema>;
