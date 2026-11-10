import { createApp } from './app.js';
import { config } from './config/env.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log('========================================================');
  console.log(`🚀 Pay-for-Performance PayPal Integration Module running`);
  console.log(`🌐 Base URL: http://localhost:${config.PORT}`);
  console.log(`💳 PayPal Base URL: ${config.PAYPAL_BASE_URL}`);
  console.log(`📦 Environment: ${config.NODE_ENV}`);
  console.log('========================================================');
});

// Graceful shutdown
const handleShutdown = () => {
  console.log('\nStopping server gracefully...');
  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
