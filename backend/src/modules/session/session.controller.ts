import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
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
}

