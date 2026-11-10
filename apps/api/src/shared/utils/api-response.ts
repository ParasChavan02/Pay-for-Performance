import { Response } from 'express';
export const success = <T>(res: Response, message: string, data?: T, status = 200) => res.status(status).json({ success: true, message, ...(data === undefined ? {} : { data }) });
export const initialized = (module: string) => ({ success: true, message: `${module} module is initialized; business logic is not implemented yet.` });
