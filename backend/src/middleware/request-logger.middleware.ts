import morgan from 'morgan'; export const requestLogger = morgan(':method :url :status :response-time ms');
