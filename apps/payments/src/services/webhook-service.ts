import { paypalClient } from './paypal-client.js';
import { config } from '../config/env.js';
import { db } from '../repositories/database.js';

export interface VerifyWebhookSignatureRequest {
  auth_algo: string;
  cert_url: string;
  transmission_id: string;
  transmission_sig: string;
  transmission_time: string;
  webhook_id: string;
  webhook_event: Record<string, any>;
}

export interface VerifyWebhookSignatureResponse {
  verification_status: 'SUCCESS' | 'FAILURE';
}

export class WebhookService {
  /**
   * Verify the authenticity of an incoming PayPal webhook signature.
   */
  public async verifyWebhookSignature(params: {
    headers: Record<string, string | undefined>;
    rawBody: any;
  }): Promise<boolean> {
    const webhookId = config.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      console.warn('[Webhook] PAYPAL_WEBHOOK_ID not set; skipping verification in development.');
      return true;
    }

    const authAlgo = params.headers['paypal-auth-algo'];
    const certUrl = params.headers['paypal-cert-url'];
    const transmissionId = params.headers['paypal-transmission-id'];
    const transmissionSig = params.headers['paypal-transmission-sig'];
    const transmissionTime = params.headers['paypal-transmission-time'];

    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      console.warn('[Webhook] Missing required PayPal verification headers.');
      return false;
    }

    try {
      const payload: VerifyWebhookSignatureRequest = {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: params.rawBody,
      };

      const result = await paypalClient.request<VerifyWebhookSignatureResponse>(
        'POST',
        '/v1/notifications/verify-webhook-signature',
        payload
      );

      return result.verification_status === 'SUCCESS';
    } catch (err: any) {
      console.error('[Webhook] Verification API call failed:', err.message);
      return false;
    }
  }

  /**
   * Process verified webhook event and update internal state
   */
  public async processWebhookEvent(event: {
    id: string;
    event_type: string;
    resource: Record<string, any>;
  }): Promise<void> {
    const { event_type, resource } = event;

    db.addAuditLog('WEBHOOK_RECEIVED', {
      eventType: event_type,
      eventId: event.id,
      resourceId: resource.id,
    });

    switch (event_type) {
      case 'CHECKOUT.ORDER.APPROVED': {
        const orderId = resource.id;
        const payment = db.getPaymentByOrderId(orderId);
        if (payment && payment.status === 'CREATED') {
          db.updatePayment(payment.id, { status: 'APPROVAL_PENDING' });
        }
        break;
      }
      case 'PAYMENT.AUTHORIZATION.CREATED': {
        const authId = resource.id;
        const payment = db.getPaymentByAuthorizationId(authId);
        if (payment && payment.status !== 'AUTHORIZED') {
          db.updatePayment(payment.id, { status: 'AUTHORIZED' });
        }
        break;
      }
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const captureId = resource.id;
        const capture = db.getCaptureByPayPalId(captureId);
        if (capture && capture.status !== 'COMPLETED') {
          capture.status = 'COMPLETED';
        }
        break;
      }
      case 'PAYMENT.CAPTURE.REFUNDED': {
        const captureId = resource.custom_id || resource.id;
        db.addAuditLog('WEBHOOK_CAPTURE_REFUNDED', { captureId, resource });
        break;
      }
      default:
        console.log(`[Webhook] Unhandled event type: ${event_type}`);
    }
  }
}

export const webhookService = new WebhookService();
