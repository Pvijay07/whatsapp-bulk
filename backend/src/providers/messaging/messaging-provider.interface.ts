export interface SendTemplateMessageRequest {
  senderPhoneNumberId: string;
  recipientPhoneNumber: string;
  templateName: string;
  languageCode: string;
  components?: Array<{
    type: 'header' | 'body' | 'button';
    subType?: 'quick_reply' | 'url';
    index?: number;
    parameters: Array<{
      type: 'text' | 'image' | 'document' | 'video';
      text?: string;
      image?: { link: string };
      document?: { link: string; filename?: string };
    }>;
  }>;
}

export interface SendMessageResult {
  providerMessageId: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: any;
}

export interface MessageStatusResult {
  providerMessageId: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  timestamp: Date;
  errorCode?: string;
  errorMessage?: string;
}

export interface NormalizedWebhookEvent {
  eventType: 'MESSAGE_STATUS' | 'INCOMING_MESSAGE' | 'ACCOUNT_ALERT';
  providerMessageId?: string;
  recipientPhoneNumber?: string;
  senderPhoneNumber?: string;
  status?: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  timestamp: Date;
  errorCode?: string;
  errorMessage?: string;
  incomingText?: string;
}

export interface MessagingProvider {
  readonly providerName: string;

  /**
   * Dispatch an approved pre-registered WhatsApp template message
   */
  sendTemplateMessage(request: SendTemplateMessageRequest): Promise<SendMessageResult>;

  /**
   * Check status directly from provider
   */
  getMessageStatus(providerMessageId: string): Promise<MessageStatusResult>;

  /**
   * Verify cryptographic webhook signature from Meta / BSP
   */
  verifyWebhook(headers: Record<string, string>, rawBody: Buffer | string): boolean;

  /**
   * Parse vendor-specific webhook payload into normalized event objects
   */
  parseWebhookPayload(payload: any): NormalizedWebhookEvent[];
}

