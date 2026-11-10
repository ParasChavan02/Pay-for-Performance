export interface ApiSuccess<T = unknown> { success: true; message: string; data?: T }
export interface ApiFailure { success: false; message: string; error: { code: string; details?: unknown } }
