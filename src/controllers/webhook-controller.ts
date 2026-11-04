import { Request, Response } from 'express';
import { webhookService } from '../services/webhook-service.js';

export class WebhookController {
  public async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const isValid = await webhookService.verifyWebhookSignature({
        headers: req.headers as Record<string, string>,
        rawBody: req.body,
      });

      if (!isValid) {
        console.warn('[Webhook] Signature verification failed');
        res.status(400).json({ error: 'Invalid webhook signature' });
        return;
      }

      await webhookService.processWebhookEvent(req.body);

      res.status(200).json({ received: true });
    } catch (err: any) {
      console.error('[Webhook] Processing error:', err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
}

export const webhookController = new WebhookController();
