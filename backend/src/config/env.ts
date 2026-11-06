import 'dotenv/config'; import { z } from 'zod';
const schema = z.object({ PORT: z.coerce.number().int().positive().default(5000), NODE_ENV: z.enum(['development', 'test', 'production']).default('development'), MONGODB_URI: z.string().min(1), FRONTEND_URL: z.string().url() });
const parsed = schema.safeParse(process.env); if (!parsed.success) throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
export const env = parsed.data;
