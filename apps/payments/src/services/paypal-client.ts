import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from '../config/env.js';
import {
  PayPalOAuthTokenResponse,
  PayPalApiErrorResponse,
} from '../types/paypal.js';

export class PayPalApiError extends Error {
  public statusCode: number;
  public details?: any;
  public debugId?: string;

  constructor(message: string, statusCode: number, details?: any, debugId?: string) {
    super(message);
    this.name = 'PayPalApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.debugId = debugId;
  }
}

export class PayPalClient {
  private axiosInstance: AxiosInstance;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.PAYPAL_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * OAuth 2.0 client credentials token acquisition with automatic caching and renewal.
   */
  public async getAccessToken(): Promise<string> {
    const now = Date.now();
    // Re-use token if still valid (with a 60-second buffer before expiry)
    if (this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    if (!config.PAYPAL_CLIENT_ID || !config.PAYPAL_CLIENT_SECRET) {
      throw new PayPalApiError(
        'PayPal credentials are not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.',
        500
      );
    }

    try {
      const authHeader = Buffer.from(
        `${config.PAYPAL_CLIENT_ID}:${config.PAYPAL_CLIENT_SECRET}`
      ).toString('base64');

      const response = await this.axiosInstance.post<PayPalOAuthTokenResponse>(
        '/v1/oauth2/token',
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data;
      this.cachedToken = data.access_token;
      // expires_in is in seconds
      this.tokenExpiresAt = now + data.expires_in * 1000;
      return this.cachedToken;
    } catch (err: any) {
      this.handleAxiosError('OAuth Token Request Failed', err);
    }
  }

  /**
   * Make an authenticated request to PayPal REST API v2 with centralized error handling.
   */
  public async request<T = any>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    data?: any,
    options?: {
      requestId?: string; // Used for PayPal-Request-Id header (idempotency)
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    const token = await this.getAccessToken();

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    };

    if (options?.requestId) {
      requestHeaders['PayPal-Request-Id'] = options.requestId;
    }

    try {
      const response: AxiosResponse<T> = await this.axiosInstance.request({
        method,
        url,
        data,
        headers: requestHeaders,
      });

      return response.data;
    } catch (err: any) {
      this.handleAxiosError(`PayPal API ${method} ${url} failed`, err);
    }
  }

  /**
   * Centralized PayPal API error normalization.
   */
  private handleAxiosError(contextMessage: string, err: any): never {
    if (axios.isAxiosError(err) && err.response) {
      const errorData = err.response.data as PayPalApiErrorResponse | undefined;
      const statusCode = err.response.status;
      const debugId = errorData?.debug_id || (err.response.headers['paypal-debug-id'] as string);

      let message = `${contextMessage} (HTTP ${statusCode})`;
      if (errorData?.message) {
        message += `: ${errorData.message}`;
      } else if (errorData?.name) {
        message += `: ${errorData.name}`;
      }

      console.error('[PayPal API Error]', {
        status: statusCode,
        debugId,
        details: errorData?.details || errorData,
      });

      throw new PayPalApiError(message, statusCode, errorData?.details || errorData, debugId);
    }

    if (err instanceof PayPalApiError) {
      throw err;
    }

    console.error(`[PayPal Network/Unknown Error] ${contextMessage}:`, err.message || err);
    throw new PayPalApiError(`${contextMessage}: ${err.message || 'Unknown network error'}`, 503);
  }
}

export const paypalClient = new PayPalClient();
