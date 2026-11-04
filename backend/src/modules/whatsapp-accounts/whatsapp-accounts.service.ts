import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WhatsAppAccountStatus } from '@prisma/client';

@Injectable()
export class WhatsAppAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async connectAccount(
    organizationId: string,
    data: {
      virtualNumberId?: string;
      displayNumber: string;
      externalAccountId: string; // Meta Phone Number ID
      provider?: string;
    },
  ) {
    if (data.virtualNumberId) {
      const number = await this.prisma.virtualNumber.findFirst({
        where: { id: data.virtualNumberId, organizationId },
      });
      if (!number) {
        throw new BadRequestException('Virtual number does not belong to this organization');
      }
    }

    return this.prisma.whatsAppAccount.create({
      data: {
        organizationId,
        virtualNumberId: data.virtualNumberId,
        displayNumber: data.displayNumber,
        externalAccountId: data.externalAccountId,
        provider: data.provider || 'meta_cloud',
        status: WhatsAppAccountStatus.CONNECTED,
      },
    });
  }

  async getOrganizationAccounts(organizationId: string) {
    return this.prisma.whatsAppAccount.findMany({
      where: { organizationId },
      include: { virtualNumber: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}

