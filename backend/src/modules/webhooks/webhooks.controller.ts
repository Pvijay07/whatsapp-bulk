import { Controller, Get, Post, Query, Body, Headers, HttpCode, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConsentService } from '../consent/consent.service';
import { MetaCloudApiAdapter } from '../../providers/messaging/meta-cloud-api.adapter';
import { MessageStatus } from '@prisma/client';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly metaAdapter = new MetaCloudApiAdapter();
  private readonly verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'saas_whatsapp_verify_token_123';

  constructor(
    private readonly prisma: PrismaService,
    private readonly consentService: ConsentService,
  ) {}

  /**
   * Meta WhatsApp Webhook Challenge Verification (GET)
   */
  @Get('meta')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('Meta Webhook verified successfully');
      return challenge;
    }
    throw new BadRequestException('Webhook verification failed: Invalid verify token');
  }

  /**
   * Process Inbound Meta WhatsApp Webhook Notifications (POST)
   */
  @Post('meta')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers() headers: Record<string, string>,
    @Body() payload: any,
  ) {
    // 1. Verify HMAC SHA-256 signature
    const isValid = this.metaAdapter.verifyWebhook(headers, JSON.stringify(payload));
    if (!isValid) {
      this.logger.warn('Rejected webhook: HMAC SHA-256 signature verification failed');
      return { status: 'invalid_signature' };
    }

    // 2. Parse normalized events
    const events = this.metaAdapter.parseWebhookPayload(payload);

    for (const event of events) {
      // Handle Message Delivery Status Update
      if (event.eventType === 'MESSAGE_STATUS' && event.providerMessageId) {
        await this.handleStatusUpdate(event);
      }

      // Handle Inbound Messages & Automatic Opt-Out (STOP)
      if (event.eventType === 'INCOMING_MESSAGE' && event.incomingText) {
        await this.handleIncomingMessage(event);
      }
    }

    return { status: 'received' };
  }

  private async handleStatusUpdate(event: any) {
    const message = await this.prisma.message.findFirst({
      where: { providerMessageId: event.providerMessageId },
    });

    if (!message) return;

    let newStatus: MessageStatus = MessageStatus.SENT;
    const updateData: any = {};

    if (event.status === 'DELIVERED') {
      newStatus = MessageStatus.DELIVERED;
      updateData.deliveredAt = event.timestamp;
      if (message.campaignId) {
        await this.prisma.campaign.update({
          where: { id: message.campaignId },
          data: { deliveredCount: { increment: 1 } },
        });
      }
    } else if (event.status === 'READ') {
      newStatus = MessageStatus.READ;
      updateData.readAt = event.timestamp;
      if (message.campaignId) {
        await this.prisma.campaign.update({
          where: { id: message.campaignId },
          data: { readCount: { increment: 1 } },
        });
      }
    } else if (event.status === 'FAILED') {
      newStatus = MessageStatus.FAILED;
      updateData.errorCode = event.errorCode;
      updateData.errorMessage = event.errorMessage;
      if (message.campaignId) {
        await this.prisma.campaign.update({
          where: { id: message.campaignId },
          data: { failedCount: { increment: 1 } },
        });
      }
    }

    updateData.status = newStatus;
    await this.prisma.message.update({
      where: { id: message.id },
      data: updateData,
    });
  }

  private async handleIncomingMessage(event: any) {
    const text = event.incomingText?.trim().toUpperCase();
    const stopKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'OPT OUT', 'DND'];

    if (stopKeywords.includes(text) && event.senderPhoneNumber) {
      this.logger.warn(
        `Recipient ${event.senderPhoneNumber} requested opt-out with keyword: "${text}". Auto-suppressing...`,
      );

      // Find organization by finding recent message to this phone number
      const recentMessage = await this.prisma.message.findFirst({
        where: { contact: { phoneNumber: event.senderPhoneNumber } },
        select: { organizationId: true },
      });

      if (recentMessage) {
        await this.consentService.suppressContact(
          recentMessage.organizationId,
          event.senderPhoneNumber,
          `USER_STOP_REPLY_${text}`,
        );
      }
    }
  }
}

