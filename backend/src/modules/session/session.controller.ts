import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { BaileysSessionService } from '../../providers/messaging/baileys-session.service';
import { CampaignQueueService } from './campaign-queue.service';

@Controller('session')
export class SessionController {
  constructor(
    private readonly baileysService: BaileysSessionService,
    private readonly queueService: CampaignQueueService,
  ) {}

  @Get('status')
  getStatus() {
    return this.baileysService.getSessionStatus();
  }

  /**
   * Retrieves real-time delivery receipts (SENT / DELIVERED / READ / FAILED)
   * from active WhatsApp WebSocket session.
   */
  @Get('receipts')
  getReceipts() {
    const statuses = this.baileysService.getMessageStatuses();
    return Array.from(statuses.entries()).map(([messageId, data]) => ({
      messageId,
      ...data,
    }));
  }

  /**
   * Checks whether a phone number is registered on WhatsApp.
   */
  @Post('check-number')
  @HttpCode(HttpStatus.OK)
  async checkNumber(@Body() body: { phoneNumber: string }) {
    if (!body.phoneNumber) {
      throw new BadRequestException('phoneNumber is required');
    }
    return this.baileysService.checkNumberOnWhatsApp(body.phoneNumber);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return this.baileysService.logout();
  }

  /**
   * Generates or refreshes a live, authentic WhatsApp multi-device pairing QR code.
   */
  @Post('qr')
  @HttpCode(HttpStatus.OK)
  async generateQr() {
    const res = await this.baileysService.generateFreshQr();
    if (!res.success && res.error) {
      throw new BadRequestException(res.error);
    }
    return res;
  }

  /**
   * Generates an 8-character pairing code for an existing WhatsApp number without QR camera scanning.
   */
  @Post('pairing-code')
  @HttpCode(HttpStatus.OK)
  async getPairingCode(@Body() body: { phoneNumber: string }) {
    if (!body.phoneNumber) {
      throw new BadRequestException('phoneNumber is required');
    }
    try {
      const pairingCode = await this.baileysService.requestPairingCode(body.phoneNumber);
      return { success: true, pairingCode };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Transmits a  message over the live Baileys WebSocket protocol.
   * Throws an authentic error if device is not linked (NO mock data / NO simulated delivery).
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendDirectMessage(
    @Body()
    body: {
      recipientPhoneNumber: string;
      messageText?: string;
      buttons?: Array<{ id?: string; type: string; text: string; value?: string }>;
      media?: {
        base64?: string;
        url?: string;
        mimeType: string;
        fileName: string;
        fileSize?: number;
      };
    },
  ) {
    if (!body.recipientPhoneNumber || (!body.messageText && !body.media)) {
      throw new BadRequestException('recipientPhoneNumber and either messageText or media are required');
    }

    const session = this.baileysService.getSessionStatus();
    if (!session.isOnline) {
      throw new BadRequestException(
        'WhatsApp device is not linked. Scan the QR code in Virtual Numbers to link your real WhatsApp account.',
      );
    }

    const result = await this.baileysService.sendRealMessage(
      body.recipientPhoneNumber,
      body.messageText || '',
      body.buttons,
      body.media,
    );

    if (!result.success) {
      throw new BadRequestException(result.error || 'Failed to deliver message via WhatsApp');
    }

    return result;
  }

  /**
   * Enqueues N numbers of messages into the server-side persistent background queue.
   * Client receives instant confirmation and can safely close browser.
   */
  @Post('queue-campaign')
  @HttpCode(HttpStatus.OK)
  async enqueueCampaign(
    @Body()
    body: {
      campaignName: string;
      dispatchType?: 'MULTI_NUMBER_POOL' | 'DEDICATED_NUMBER';
      senderNumber?: string;
      senderPoolCount?: number;
      customMessageText: string;
      buttons?: any[];
      media?: any;
      recipients: Array<{ phoneNumber: string; name?: string }>;
      delayIntervalSec?: number;
      spintaxEnabled?: boolean;
      totalCostINR?: number;
    },
  ) {
    return this.queueService.enqueueCampaign(body);
  }

  /**
   * Retrieves all enqueued campaigns and their live background progress metrics.
   */
  @Get('queue-campaigns')
  async getAllQueuedCampaigns() {
    return this.queueService.getAllCampaigns();
  }

  /**
   * Retrieves single campaign with detailed recipient logs.
   */
  @Get('queue-campaigns/:id')
  async getQueuedCampaign(@Param('id') id: string) {
    return this.queueService.getCampaign(id);
  }

  /**
   * Pauses an active background queue campaign.
   */
  @Post('queue-campaigns/:id/pause')
  @HttpCode(HttpStatus.OK)
  async pauseCampaign(@Param('id') id: string) {
    return this.queueService.pauseCampaign(id);
  }

  /**
   * Resumes a paused background queue campaign.
   */
  @Post('queue-campaigns/:id/resume')
  @HttpCode(HttpStatus.OK)
  async resumeCampaign(@Param('id') id: string) {
    return this.queueService.resumeCampaign(id);
  }

  /**
   * Cancels a background queue campaign.
   */
  @Post('queue-campaigns/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelCampaign(@Param('id') id: string) {
    return this.queueService.cancelCampaign(id);
  }
}
