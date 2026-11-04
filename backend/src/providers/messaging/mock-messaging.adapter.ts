import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  MessagingProvider,
  SendTemplateMessageRequest,
  SendMessageResult,
  MessageStatusResult,
  NormalizedWebhookEvent,
} from './messaging-provider.interface';

@Injectable()
export class MockMessagingAdapter implements MessagingProvider {
  readonly providerName = 'mock_messaging';
  private readonly logger = new Logger(MockMessagingAdapter.name);

  async sendTemplateMessage(
    request: SendTemplateMessageRequest,
  ): Promise<SendMessageResult> {
    const mockId = `wamid.mock.${crypto.randomBytes(8).toString('hex')}`;
    this.logger.log(
      `[MOCK] Dispatched WhatsApp template "${request.templateName}" to ${request.recipientPhoneNumber}. Generated ID: ${mockId}`,
    );

    // Simulate 98% instant success rate, 2% failure for realistic sandbox testing
    const isFailure = request.recipientPhoneNumber.endsWith('0000');
    if (isFailure) {
      return {
        providerMessageId: '',
        status: 'FAILED',
        errorCode: '131026',
        errorMessage: 'Receiver does not have a WhatsApp account',
      };
    }

    return {
      providerMessageId: mockId,
      status: 'SENT',
      rawResponse: { messages: [{ id: mockId }] },
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

