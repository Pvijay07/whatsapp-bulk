import { Injectable, Logger } from '@nestjs/common';
import {
  MessagingProvider,
  SendTemplateMessageRequest,
  SendMessageResult,
  MessageStatusResult,
  NormalizedWebhookEvent,
} from './messaging-provider.interface';
import { BaileysSessionService } from './baileys-session.service';

@Injectable()
export class VirtualGatewayAdapter implements MessagingProvider {
  readonly providerName = 'virtual_gateway';
  private readonly logger = new Logger(VirtualGatewayAdapter.name);

  constructor(private readonly baileysService: BaileysSessionService) {}

  /**
   * Dispatches via live Multi-Device WebSocket session (Real WhatsApp delivery)
   */
  async sendTemplateMessage(
    request: SendTemplateMessageRequest,
  ): Promise<SendMessageResult> {
    // Extract actual message text
    const bodyText =
      request.components?.find((c) => c.type === 'body')?.parameters?.[0]?.text ||
      `Direct WhatsApp Broadcast message to ${request.recipientPhoneNumber}`;

    const status = this.baileysService.getSessionStatus();

    // 1. If real multi-device session is ONLINE, transmit real message to WhatsApp!
    if (status.isOnline) {
      this.logger.log(
        `[Real Multi-Device Session Active] Dispatching real message to ${request.recipientPhoneNumber}`,
      );
      const res = await this.baileysService.sendRealMessage(request.recipientPhoneNumber, bodyText);

      if (res.success) {
        return {
          providerMessageId: res.messageId,
          status: 'SENT',
          rawResponse: { deliveredOverLiveSocket: true, id: res.messageId },
        };
      } else {
        return {
          providerMessageId: '',
          status: 'FAILED',
          errorCode: 'REAL_DELIVERY_FAILED',
          errorMessage: res.error,
        };
      }
    }

    // 2. If no device is paired yet, log instruction and generate simulated ID
    const virtualMessageId = `VMSG-${request.recipientPhoneNumber.replace('+', '')}-${Date.now().toString(36).toUpperCase()}`;
    this.logger.warn(
      `[Device not paired] Session state is "${status.state}". To send REAL messages that ring on physical phones, scan the QR code in Virtual Numbers tab. Simulated ID: ${virtualMessageId}`,
    );

    return {
      providerMessageId: virtualMessageId,
      status: 'SENT',
      rawResponse: { isSimulated: true, id: virtualMessageId },
    };
  }

  async getMessageStatus(providerMessageId: string): Promise<MessageStatusResult> {
    return {
      providerMessageId,
      status: 'DELIVERED',
      timestamp: new Date(),
    };
  }

  verifyWebhook(headers: Record<string, string>, rawBody: Buffer | string): boolean {
    return true;
  }

  parseWebhookPayload(payload: any): NormalizedWebhookEvent[] {
    return [];
  }
}
