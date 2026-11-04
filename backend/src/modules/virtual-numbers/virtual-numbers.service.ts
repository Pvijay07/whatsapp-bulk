import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ExotelNumberAdapter } from '../../providers/numbers/exotel.adapter';
import { MockNumberAdapter } from '../../providers/numbers/mock-number.adapter';
import { NumberProvider } from '../../providers/numbers/number-provider.interface';
import { NumberStatus } from '@prisma/client';

@Injectable()
export class VirtualNumbersService {
  private readonly logger = new Logger(VirtualNumbersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  private getProvider(): NumberProvider {
    const providerName = process.env.NUMBER_PROVIDER || 'mock';
    if (providerName === 'exotel') {
      return new ExotelNumberAdapter();
    }
    return new MockNumberAdapter();
  }

  async searchAvailableNumbers(countryCode = '+91') {
    const provider = this.getProvider();
    const numbers = await provider.searchNumbers({ countryCode });
    return numbers.map((num) => ({
      ...num,
      monthlyRentalPaise: num.monthlyRentalPaise.toString(),
      monthlyRentalINR: (Number(num.monthlyRentalPaise) / 100).toFixed(2),
    }));
  }

  async purchaseNumber(
    organizationId: string,
    providerNumberId: string,
    kycReference: string,
  ) {
    const provider = this.getProvider();
    const availableNumbers = await provider.searchNumbers({ countryCode: '+91' });
    const selected = availableNumbers.find((n) => n.providerNumberId === providerNumberId);

    if (!selected) {
      throw new NotFoundException('Selected number is no longer available');
    }

    const totalCostPaise = selected.setupCostPaise + selected.monthlyRentalPaise;

    // Check wallet balance
    const wallet = await this.walletService.getOrCreateWallet(organizationId);
    if (BigInt(wallet.availablePaise) < totalCostPaise) {
      throw new BadRequestException(
        `Insufficient balance for number rental. Required: ₹${(
          Number(totalCostPaise) / 100
        ).toFixed(2)}, Available: ₹${wallet.availableINR}`,
      );
    }

    // Provision from telco provider
    const provisionResult = await provider.purchaseNumber(providerNumberId, kycReference);

    // Debit wallet atomically
    await this.walletService.creditWallet(
      organizationId,
      -totalCostPaise,
      `number_purchase_${providerNumberId}_${Date.now()}`,
      undefined,
      { providerNumberId, phoneNumber: provisionResult.phoneNumber },
    );

    // Save virtual number record
    const record = await this.prisma.virtualNumber.create({
      data: {
        organizationId,
        provider: provider.providerName,
        providerNumberId: provisionResult.providerNumberId,
        phoneNumber: provisionResult.phoneNumber,
        countryCode: '+91',
        capabilities: selected.capabilities,
        status: provisionResult.status === 'ACTIVE' ? NumberStatus.ALLOCATED : NumberStatus.PENDING_VERIFICATION,
      },
    });

    return record;
  }

  async getOrganizationNumbers(organizationId: string) {
    return this.prisma.virtualNumber.findMany({
      where: { organizationId },
      include: { whatsappAccounts: true },
    });
  }
}

