import { Injectable, Logger } from '@nestjs/common';
import {
  MessagingProvider,
  SendTemplateMessageRequest,
  SendMessageResult,
  MessageStatusResult,
  NormalizedWebhookEvent,
} from './messaging-provider.interface';
import { VirtualPoolManagerService } from './virtual-pool-manager.service';
import { BaileysSessionService } from './baileys-session.service';

@Injectable()
export class VirtualGatewayAdapter implements MessagingProvider {
  readonly providerName = 'virtual_gateway';
  private readonly logger = new Logger(VirtualGatewayAdapter.name);

  constructor(
    private readonly poolManager: VirtualPoolManagerService,
    private readonly baileysService: BaileysSessionService,
  ) {}

  /**
   * Dispatches via real WhatsApp session (Baileys WebSocket) or real Virtual Number Pool.
   * Fails honestly if no real device is connected (zero mock data).
   */
  async sendTemplateMessage(
    request: SendTemplateMessageRequest,
  ): Promise<SendMessageResult> {
    const bodyText =
      request.components?.find((c) => c.type === 'body')?.parameters?.[0]?.text ||
      `Direct WhatsApp message to ${request.recipientPhoneNumber}`;

    // 1. If primary multi-device Baileys session is online, send REAL message
    if (this.baileysService.getSessionStatus().isOnline) {
      const realResult = await this.baileysService.sendRealMessage(
        request.recipientPhoneNumber,
        bodyText,
      );

      if (realResult.success) {
        return {
          providerMessageId: realResult.messageId,
          status: 'SENT',
          rawResponse: {
            dispatchedVia: this.baileysService.getSessionStatus().connectedNumber,
            id: realResult.messageId,
          },
        };
      } else {
        return {
          providerMessageId: '',
          status: 'FAILED',
          errorCode: 'REAL_DELIVERY_FAILED',
          errorMessage: realResult.error,
        };
      }
    }

    // 2. Dispatch through pool manager
    const result = await this.poolManager.dispatchPoolMessage(
      request.recipientPhoneNumber,
      bodyText,
    );

    if (result.success) {
      return {
        providerMessageId: result.messageId,
        status: 'SENT',
        rawResponse: {
          dispatchedVia: result.senderNumber,
          isPoolRotation: true,
          id: result.messageId,
        },
      };
    } else {
      return {
        providerMessageId: '',
        status: 'FAILED',
        errorCode: 'NO_ACTIVE_WHATSAPP_SESSION',
        errorMessage:
          result.error ||
          'No active WhatsApp session connected. Please scan the QR code in Virtual Numbers to link your real WhatsApp account.',
      };
    }
  }

  async getMessageStatus(providerMessageId: string): Promise<MessageStatusResult> {
    return {
      providerMessageId,
      status: 'SENT',
      timestamp: new Date(),
    };
  }

  verifyWebhook(_headers: Record<string, string>, _rawBody: Buffer | string): boolean {
    return true;
  }

  parseWebhookPayload(_payload: any): NormalizedWebhookEvent[] {
    return [];
  }
}
