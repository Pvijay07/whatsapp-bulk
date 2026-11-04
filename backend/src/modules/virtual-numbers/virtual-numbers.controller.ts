import { Controller, Get, Post, Body, UseGuards, Request, Query } from '@nestjs/common';
import { VirtualNumbersService } from './virtual-numbers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('numbers')
@UseGuards(JwtAuthGuard)
export class VirtualNumbersController {
  constructor(private readonly numbersService: VirtualNumbersService) {}

  @Get('search')
  async searchNumbers(@Query('countryCode') countryCode = '+91') {
    return this.numbersService.searchAvailableNumbers(countryCode);
  }

  @Post('purchase')
  async purchaseNumber(
    @Request() req: any,
    @Body() body: { providerNumberId: string; kycReference: string },
  ) {
    return this.numbersService.purchaseNumber(
      req.user.organizationId,
      body.providerNumberId,
      body.kycReference,
    );
  }

  @Get()
  async getNumbers(@Request() req: any) {
    return this.numbersService.getOrganizationNumbers(req.user.organizationId);
  }
}

