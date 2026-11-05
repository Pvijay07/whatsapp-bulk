import { Controller, Get, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { BaileysSessionService } from '../../providers/messaging/baileys-session.service';

@Controller('session')
export class SessionController {
  constructor(private readonly baileysService: BaileysSessionService) {}

  @Get('status')
  getStatus() {
    return this.baileysService.getSessionStatus();
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
}
