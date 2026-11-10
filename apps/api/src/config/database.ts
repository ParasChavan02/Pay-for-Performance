import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env';

// Configure reliable DNS servers for MongoDB Atlas SRV record resolution
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Ignore in environments where setting servers is restricted
}

let listenersAttached = false;

export const databaseStatus = () =>
  mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  if (!listenersAttached) {
    listenersAttached = true;
    mongoose.connection.on('disconnected', () =>
      console.warn('MongoDB disconnected')
    );
    mongoose.connection.on('error', (error) =>
      console.error('MongoDB error', error)
    );
  }

  await mongoose.connect(env.MONGODB_URI);
  console.info('MongoDB connected');
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
