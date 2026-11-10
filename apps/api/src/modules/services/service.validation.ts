import { z } from 'zod';
import { serviceEnvironments, serviceStatuses } from './service.model';

const objectIdRegex = /^[a-f\d]{24}$/i;

export const serviceIdSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid MongoDB ID'),
});

const baseUrlSchema = z
  .string({ required_error: 'Base URL is required' })
  .trim()
  .url('Base URL must be a valid URL')
  .superRefine((value, ctx) => {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Base URL must use HTTP or HTTPS protocol',
        });
      }
      if (url.username || url.password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Base URL must not contain embedded credentials (username or password)',
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Base URL must be a valid URL',
      });
    }
  });

export const createServiceSchema = z.object({
  name: z
    .string({ required_error: 'Service name is required' })
    .trim()
    .min(1, 'Service name cannot be empty'),
  description: z.string().trim().optional(),
  baseUrl: baseUrlSchema,
  environment: z.enum(serviceEnvironments, {
    errorMap: () => ({ message: 'Environment must be Development, Staging, or Production' }),
  }),
  monitoringInterval: z.coerce
    .number()
    .int('Monitoring interval must be an integer')
    .positive('Monitoring interval must be a positive integer')
    .default(60),
  expectedUptime: z.coerce
    .number()
    .min(0, 'Expected uptime must be between 0 and 100')
    .max(100, 'Expected uptime must be between 0 and 100')
    .default(99.9),
  maxResponseTime: z.coerce
    .number()
    .positive('Maximum response time must be positive')
    .default(500),
  status: z
    .enum(serviceStatuses, {
      errorMap: () => ({ message: 'Status must be Active or Inactive' }),
    })
    .default('Active'),
});

export const updateServiceSchema = z
  .object({
    name: z.string().trim().min(1, 'Service name cannot be empty').optional(),
    description: z.string().trim().optional(),
    baseUrl: baseUrlSchema.optional(),
    environment: z.enum(serviceEnvironments, {
      errorMap: () => ({ message: 'Environment must be Development, Staging, or Production' }),
    }).optional(),
    monitoringInterval: z.coerce
      .number()
      .int('Monitoring interval must be an integer')
      .positive('Monitoring interval must be a positive integer')
      .optional(),
    expectedUptime: z.coerce
      .number()
      .min(0, 'Expected uptime must be between 0 and 100')
      .max(100, 'Expected uptime must be between 0 and 100')
      .optional(),
    maxResponseTime: z.coerce
      .number()
      .positive('Maximum response time must be positive')
      .optional(),
    status: z.enum(serviceStatuses, {
      errorMap: () => ({ message: 'Status must be Active or Inactive' }),
    }).optional(),
    _id: z.never({ message: 'Updates to _id are not allowed' }).optional(),
    createdAt: z.never({ message: 'Updates to createdAt are not allowed' }).optional(),
    updatedAt: z.never({ message: 'Updates to updatedAt are not allowed' }).optional(),
  })
  .strict('Unrecognized or non-updatable fields supplied')
  .refine((input) => Object.keys(input).length > 0, 'At least one updatable field is required');

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
