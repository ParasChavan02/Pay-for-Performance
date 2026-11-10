import app from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { monitoringScheduler } from './modules/monitoring/monitoring.scheduler';

const server = app.listen(env.PORT, async () => {
  try {
    await connectDatabase();
    console.info(`Server listening on ${env.PORT}`);
    await monitoringScheduler.start();
  } catch (error) {
    console.error('Database connection failed', error);
  }
});

const shutdown = async () => {
  monitoringScheduler.stop();
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
