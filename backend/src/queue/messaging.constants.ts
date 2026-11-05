export const MESSAGING_QUEUE_NAME = 'whatsapp-messaging';

export interface SendMessageJobData {
  campaignId: string;
  messageId: string;
  organizationId: string;
}
