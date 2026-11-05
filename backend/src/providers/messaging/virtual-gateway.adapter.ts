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
   * Dispatches via Saasyto-style Multi-Number Virtual Pool with Round-Robin load balancing
   */
  async sendTemplateMessage(
    request: SendTemplateMessageRequest,
  ): Promise<SendMessageResult> {
    const bodyText =
      request.components?.find((c) => c.type === 'body')?.parameters?.[0]?.text ||
      `Direct WhatsApp message to ${request.recipientPhoneNumber}`;

    // 1. Dispatch through the Virtual Number Pool Manager (Round-Robin)
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
        errorCode: 'POOL_DISPATCH_ERROR',
        errorMessage: result.error,
      };
    }
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
