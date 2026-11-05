import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { VirtualPoolManagerService } from '../../providers/messaging/virtual-pool-manager.service';
import { OtpRentalService } from '../../providers/numbers/otp-rental.service';
import { AccountWarmerService } from '../../providers/messaging/account-warmer.service';

@Controller('virtual-pool')
export class VirtualPoolController {
  constructor(
    private readonly poolManager: VirtualPoolManagerService,
    private readonly otpService: OtpRentalService,
    private readonly warmerService: AccountWarmerService,
  ) {}

  @Get()
  getPoolStatus() {
    return this.poolManager.getPoolStatus();
  }

  @Post('auto-provision')
  @HttpCode(HttpStatus.OK)
  async autoProvision(@Body() body: { country?: string }) {
    return this.otpService.autoProvisionNumber(body.country || 'india');
  }

  @Post('warmup/trigger')
  @HttpCode(HttpStatus.OK)
  triggerWarmup() {
    const entry = this.warmerService.runWarmupCycle();
    return { success: true, entry };
  }

  @Get('warmup/logs')
  getWarmupLogs() {
    return this.warmerService.getWarmupLogs();
  }

  @Delete(':phoneNumber')
  removeNumber(@Param('phoneNumber') phoneNumber: string) {
    const success = this.poolManager.removeNumber(phoneNumber);
    return { success };
  }
}

