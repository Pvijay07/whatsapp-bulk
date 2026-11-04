import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import {
  MessagingProvider,
  SendTemplateMessageRequest,
  SendMessageResult,
  MessageStatusResult,
  NormalizedWebhookEvent,
} from './messaging-provider.interface';

@Injectable()
export class MetaCloudApiAdapter implements MessagingProvider {
  readonly providerName = 'meta_cloud';
  private readonly logger = new Logger(MetaCloudApiAdapter.name);

  private readonly apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';
  private readonly defaultApiToken = process.env.WHATSAPP_API_TOKEN;
  private readonly appSecret = process.env.WEBHOOK_APP_SECRET;
  private readonly baseUrl = 'https://graph.facebook.com';

  async sendTemplateMessage(
    request: SendTemplateMessageRequest,
  ): Promise<SendMessageResult> {
    const url = `${this.baseUrl}/${this.apiVersion}/${request.senderPhoneNumberId}/messages`;

    // Construct official WhatsApp Cloud API payload
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: request.recipientPhoneNumber.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: request.templateName,
        language: {
          code: request.languageCode || 'en_US',
        },
        components: request.components || [],
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.defaultApiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const messageId = response.data?.messages?.[0]?.id;
      return {
        providerMessageId: messageId,
        status: 'SENT',
        rawResponse: response.data,
      };
    } catch (error: any) {
      const errorData = error.response?.data?.error;
      this.logger.error(
        `Meta Cloud API send failed: ${errorData?.message || error.message}`,
        error.stack,
      );

      return {
        providerMessageId: '',
        status: 'FAILED',
        errorCode: String(errorData?.code || 'NETWORK_ERROR'),
        errorMessage: errorData?.message || error.message,
        rawResponse: error.response?.data,
      };
    }
  }

  async getMessageStatus(providerMessageId: string): Promise<MessageStatusResult> {
    // Meta Cloud API primarily updates status via async Webhooks
    return {
      providerMessageId,
      status: 'SENT',
      timestamp: new Date(),
    };
  }

  verifyWebhook(headers: Record<string, string>, rawBody: Buffer | string): boolean {
    if (!this.appSecret) {
      this.logger.warn('WEBHOOK_APP_SECRET is not configured; skipping HMAC verification');
      return true;
    }

    const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];
    if (!signature) {
      return false;
    }

    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  parseWebhookPayload(payload: any): NormalizedWebhookEvent[] {
    const events: NormalizedWebhookEvent[] = [];

    if (!payload?.entry) return events;

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;

        // Delivery Status Updates (sent, delivered, read, failed)
        if (value.statuses) {
          for (const status of value.statuses) {
            let normalizedStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' = 'SENT';
            if (status.status === 'delivered') normalizedStatus = 'DELIVERED';
            else if (status.status === 'read') normalizedStatus = 'READ';
            else if (status.status === 'failed') normalizedStatus = 'FAILED';

            events.push({
              eventType: 'MESSAGE_STATUS',
              providerMessageId: status.id,
              recipientPhoneNumber: status.recipient_id,
              status: normalizedStatus,
              timestamp: new Date(Number(status.timestamp) * 1000),
              errorCode: status.errors?.[0]?.code ? String(status.errors[0].code) : undefined,
              errorMessage: status.errors?.[0]?.title || status.errors?.[0]?.message,
            });
          }
        }

        // Inbound User Messages (e.g. STOP / Opt-Out replies)
        if (value.messages) {
          for (const msg of value.messages) {
            events.push({
              eventType: 'INCOMING_MESSAGE',
              providerMessageId: msg.id,
              senderPhoneNumber: `+${msg.from}`,
              timestamp: new Date(Number(msg.timestamp) * 1000),
              incomingText: msg.text?.body,
            });
          }
        }
      }
    }

    return events;
  }
}

