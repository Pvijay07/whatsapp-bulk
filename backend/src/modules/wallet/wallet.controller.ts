import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@Request() req: any) {
    return this.walletService.getOrCreateWallet(req.user.organizationId);
  }

  @Get('transactions')
  async getTransactions(@Request() req: any) {
    return this.walletService.getTransactionHistory(req.user.organizationId);
  }

  /**
   * Mock or Payment Gateway Top-up confirmation
   */
  @Post('topup')
  async topUp(
    @Request() req: any,
    @Body() body: { amountPaise: number; idempotencyKey: string; referenceId?: string },
  ) {
    return this.walletService.creditWallet(
      req.user.organizationId,
      BigInt(body.amountPaise),
      body.idempotencyKey,
      body.referenceId,
      { source: 'manual_recharge' },
    );
  }
}

