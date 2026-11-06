import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Initial load
dotenv.config();

const reloadEnv = () => {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
};

export const config = {
  get PORT(): number {
    reloadEnv();
    return parseInt(process.env.PORT || '3000', 10);
  },
  get NODE_ENV(): 'development' | 'test' | 'production' {
    return (process.env.NODE_ENV as 'development' | 'test' | 'production') || 'development';
  },
  get PAYPAL_CLIENT_ID(): string {
    reloadEnv();
    return (process.env.PAYPAL_CLIENT_ID || '').trim();
  },
  get PAYPAL_CLIENT_SECRET(): string {
    reloadEnv();
    return (process.env.PAYPAL_CLIENT_SECRET || '').trim();
  },
  get PAYPAL_BASE_URL(): string {
    reloadEnv();
    return (process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com').trim();
  },
  get PAYPAL_WEBHOOK_ID(): string | undefined {
    reloadEnv();
    return process.env.PAYPAL_WEBHOOK_ID?.trim() || undefined;
  },
  get PAYPAL_RETURN_URL(): string {
    reloadEnv();
    return process.env.PAYPAL_RETURN_URL || 'http://localhost:3000/api/payments/return';
  },
  get PAYPAL_CANCEL_URL(): string {
    reloadEnv();
    return process.env.PAYPAL_CANCEL_URL || 'http://localhost:3000/api/payments/cancel';
  },
  get DATABASE_STORAGE_PATH(): string {
    reloadEnv();
    return process.env.DATABASE_STORAGE_PATH || './data/pay_for_performance.json';
  },
};
