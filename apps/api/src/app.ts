import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import apiRoutes from './routes';
import { requestLogger } from './middleware/request-logger.middleware';
import { notFound } from './middleware/not-found.middleware';
import { errorHandler } from './middleware/error.middleware';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(requestLogger);

app.get('/', (_req, res) =>
  res.json({ success: true, message: 'Pay-for-Performance API' })
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api', apiRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
