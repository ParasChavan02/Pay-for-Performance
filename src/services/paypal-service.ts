import { paypalClient } from './paypal-client.js';
import { config } from '../config/env.js';
import {
  PayPalCreateOrderRequest,
  PayPalCreateOrderResponse,
  PayPalAuthorizeOrderResponse,
  PayPalCaptureAuthorizationRequest,
  PayPalCaptureResponse,
  PayPalRefundRequest,
  PayPalRefundResponse,
  PayPalAuthorization,
} from '../types/paypal.js';

export class PayPalService {
  /**
   * 1. Create an Order with intent=AUTHORIZE using Orders API v2
   */
  public async createOrder(params: {
    amount: number;
    currency: string;
    description?: string;
    customId?: string;
    returnUrl?: string;
    cancelUrl?: string;
    requestId?: string;
  }): Promise<{ orderId: string; approvalUrl: string; rawResponse: PayPalCreateOrderResponse }> {
    const amountStr = params.amount.toFixed(2);

    const payload: PayPalCreateOrderRequest = {
      intent: 'AUTHORIZE',
      purchase_units: [
        {
          reference_id: 'default',
          description: params.description || 'Pay-for-Performance SLA Settlement',
          custom_id: params.customId,
          amount: {
            currency_code: params.currency,
            value: amountStr,
          },
        },
      ],
      application_context: {
        brand_name: 'Pay-for-Performance',
        landing_page: 'NO_PREFERENCE',
        user_action: 'CONTINUE',
        return_url: params.returnUrl || config.PAYPAL_RETURN_URL,
        cancel_url: params.cancelUrl || config.PAYPAL_CANCEL_URL,
      },
    };

    const response = await paypalClient.request<PayPalCreateOrderResponse>(
      'POST',
      '/v2/checkout/orders',
      payload,
      { requestId: params.requestId }
    );

    const approveLink =
      response.links.find((l) => l.rel === 'approve' || l.rel === 'payer-action')?.href || '';

    return {
      orderId: response.id,
      approvalUrl: approveLink,
      rawResponse: response,
    };
  }

  /**
   * 2. Authorize the Order after buyer approval using Orders API v2
   */
  public async authorizeOrder(
    orderId: string,
    requestId?: string
  ): Promise<{
    authorizationId: string;
    status: string;
    authorizedAmount: number;
    currency: string;
    rawResponse: PayPalAuthorizeOrderResponse;
  }> {
    const response = await paypalClient.request<PayPalAuthorizeOrderResponse>(
      'POST',
      `/v2/checkout/orders/${orderId}/authorize`,
      {},
      { requestId }
    );

    // Extract authorization details from purchase_units
    const purchaseUnit = response.purchase_units?.[0];
    const authorization: PayPalAuthorization | undefined =
      purchaseUnit?.payments?.authorizations?.[0];

    if (!authorization || !authorization.id) {
      throw new Error(`PayPal order ${orderId} authorization did not return an authorization ID.`);
    }

    return {
      authorizationId: authorization.id,
      status: authorization.status,
      authorizedAmount: parseFloat(authorization.amount.value),
      currency: authorization.amount.currency_code,
      rawResponse: response,
    };
  }

  /**
   * 3. Capture an authorized payment using Payments API v2
   */
  public async captureAuthorization(params: {
    authorizationId: string;
    amount: number;
    currency: string;
    finalCapture: boolean;
    noteToPayer?: string;
    requestId?: string;
  }): Promise<{
    captureId: string;
    status: string;
    capturedAmount: number;
    currency: string;
    finalCapture: boolean;
    rawResponse: PayPalCaptureResponse;
  }> {
    const payload: PayPalCaptureAuthorizationRequest = {
      amount: {
        currency_code: params.currency,
        value: params.amount.toFixed(2),
      },
      final_capture: params.finalCapture,
      note_to_payer: params.noteToPayer || 'SLA approved performance settlement',
    };

    const response = await paypalClient.request<PayPalCaptureResponse>(
      'POST',
      `/v2/payments/authorizations/${params.authorizationId}/capture`,
      payload,
      { requestId: params.requestId }
    );

    return {
      captureId: response.id,
      status: response.status,
      capturedAmount: parseFloat(response.amount.value),
      currency: response.amount.currency_code,
      finalCapture: response.final_capture,
      rawResponse: response,
    };
  }

  /**
   * 4. Refund a captured payment using Payments API v2
   */
  public async refundCapture(params: {
    captureId: string;
    amount?: number;
    currency?: string;
    noteToPayer?: string;
    requestId?: string;
  }): Promise<{
    refundId: string;
    status: string;
    refundedAmount: number;
    currency: string;
    rawResponse: PayPalRefundResponse;
  }> {
    const payload: PayPalRefundRequest = {};

    if (params.amount !== undefined && params.currency) {
      payload.amount = {
        currency_code: params.currency,
        value: params.amount.toFixed(2),
      };
    }

    if (params.noteToPayer) {
      payload.note_to_payer = params.noteToPayer;
    }

    const response = await paypalClient.request<PayPalRefundResponse>(
      'POST',
      `/v2/payments/captures/${params.captureId}/refund`,
      payload,
      { requestId: params.requestId }
    );

    return {
      refundId: response.id,
      status: response.status,
      refundedAmount: parseFloat(response.amount.value),
      currency: response.amount.currency_code,
      rawResponse: response,
    };
  }

  /**
   * Get Order Details
   */
  public async getOrder(orderId: string): Promise<any> {
    return paypalClient.request('GET', `/v2/checkout/orders/${orderId}`);
  }

  /**
   * Get Authorization Details
   */
  public async getAuthorization(authorizationId: string): Promise<PayPalAuthorization> {
    return paypalClient.request<PayPalAuthorization>(
      'GET',
      `/v2/payments/authorizations/${authorizationId}`
    );
  }

  /**
   * Get Capture Details
   */
  public async getCapture(captureId: string): Promise<PayPalCaptureResponse> {
    return paypalClient.request<PayPalCaptureResponse>(
      'GET',
      `/v2/payments/captures/${captureId}`
    );
  }
}

export const paypalService = new PayPalService();
