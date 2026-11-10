import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/pay_for_performance'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  PAYMENT_SERVICE_URL: z.string().url().default('http://localhost:3000/api'),
  SLA_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  INTERNAL_API_TOKEN: z.string().default('p4p-internal-secret-token-2026'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`
  );
}

export const env = parsed.data;
