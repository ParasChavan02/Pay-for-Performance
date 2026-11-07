import { z } from 'zod';
import {
  conditionOperators,
  logicalOperators,
  policyActions,
  policyCategories,
  policyScopes,
} from './policy.model';

const objectIdRegex = /^[a-f\d]{24}$/i;

// ----------------------------------------------------------------- Conditions

export const conditionRuleSchema = z.object({
  field: z.string().trim().min(1, 'Condition field is required'),
  operator: z.enum(conditionOperators, {
    errorMap: () => ({
      message: `Operator must be one of: ${conditionOperators.join(', ')}`,
    }),
  }),
  value: z.unknown(),
});

export const conditionGroupSchema = z.object({
  logicalOperator: z.enum(logicalOperators).default('AND'),
  rules: z.array(conditionRuleSchema).min(1, 'At least one condition rule is required'),
});

// ----------------------------------------------------------------- Policy CRUD

export const createPolicySchema = z
  .object({
    name: z.string().trim().min(1, 'Policy name is required'),
    description: z.string().trim().min(1, 'Policy description is required'),
    policyCode: z
      .string()
      .trim()
      .min(1, 'Policy code is required')
      .toUpperCase(),
    category: z.enum(policyCategories, {
      errorMap: () => ({
        message: `Category must be one of: ${policyCategories.join(', ')}`,
      }),
    }),
    priority: z.coerce.number().int().positive().default(1),
    enabled: z.boolean().default(true),
    scope: z.enum(policyScopes).default('Global'),
    serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID').optional(),
    conditions: conditionGroupSchema,
    action: z.enum(policyActions, {
      errorMap: () => ({
        message: `Action must be one of: ${policyActions.join(', ')}`,
      }),
    }),
    reason: z.string().trim().min(1, 'Policy decision reason is required'),
    effectiveFrom: z.coerce.date().optional(),
    effectiveUntil: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.effectiveFrom && data.effectiveUntil) {
        return data.effectiveUntil.getTime() > data.effectiveFrom.getTime();
      }
      return true;
    },
    {
      message: 'effectiveUntil must be strictly after effectiveFrom',
      path: ['effectiveUntil'],
    }
  )
  .refine(
    (data) => {
      if (data.scope === 'Service' && !data.serviceId) {
        return false;
      }
      return true;
    },
    {
      message: 'serviceId is required when scope is Service',
      path: ['serviceId'],
    }
  );

export const updatePolicySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    category: z.enum(policyCategories).optional(),
    priority: z.coerce.number().int().positive().optional(),
    enabled: z.boolean().optional(),
    scope: z.enum(policyScopes).optional(),
    serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID').optional(),
    conditions: conditionGroupSchema.optional(),
    action: z.enum(policyActions).optional(),
    reason: z.string().trim().min(1).optional(),
    effectiveFrom: z.coerce.date().optional(),
    effectiveUntil: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be supplied to update a policy',
  })
  .refine(
    (data) => {
      if (data.effectiveFrom && data.effectiveUntil) {
        return data.effectiveUntil.getTime() > data.effectiveFrom.getTime();
      }
      return true;
    },
    {
      message: 'effectiveUntil must be strictly after effectiveFrom',
      path: ['effectiveUntil'],
    }
  );

export const updatePolicyStatusSchema = z.object({
  enabled: z.boolean({ required_error: 'enabled boolean is required' }),
});

export const policyIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid MongoDB Policy ID'),
});

export const policyServiceIdParamSchema = z.object({
  serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID'),
});

export const listPoliciesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  category: z.enum(policyCategories).optional(),
  enabled: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  scope: z.enum(policyScopes).optional(),
  serviceId: z.string().regex(objectIdRegex, 'Invalid MongoDB Service ID').optional(),
  action: z.enum(policyActions).optional(),
});

// ----------------------------------------------------------- Evaluation & Decisions

export const evaluateSettlementParamSchema = z.object({
  settlementId: z.string().regex(objectIdRegex, 'Invalid MongoDB Settlement ID'),
});

export const decisionIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid MongoDB PolicyDecision ID'),
});

export const listDecisionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  settlementId: z.string().regex(objectIdRegex, 'Invalid MongoDB Settlement ID').optional(),
  finalDecision: z.enum(policyActions).optional(),
});

// ----------------------------------------------------------------- Types

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
export type UpdatePolicyStatusInput = z.infer<typeof updatePolicyStatusSchema>;
export type ListPoliciesQueryInput = z.infer<typeof listPoliciesQuerySchema>;
export type ListDecisionsQueryInput = z.infer<typeof listDecisionsQuerySchema>;
