import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { enqueueCampaignMessages } from '../../queue/messaging.queue';
import { CampaignStatus, MessageStatus } from '@prisma/client';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  // Default WhatsApp marketing conversation cost in India: ~₹0.85 (85 paise) + SaaS margin
  private readonly defaultPerMessageCostPaise = 100n; // ₹1.00 per message (100 paise)

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  async createCampaign(
    organizationId: string,
    data: {
      name: string;
      senderAccountId: string;
      templateId: string;
      contactGroupId?: string;
      scheduledAt?: Date;
    },
  ) {
    // Validate sender account
    const sender = await this.prisma.whatsAppAccount.findFirst({
      where: { id: data.senderAccountId, organizationId },
    });
    if (!sender) {
      throw new BadRequestException('Sender WhatsApp account does not belong to this organization');
    }

    // Count eligible contacts
    let totalContacts = 0;
    if (data.contactGroupId) {
      totalContacts = await this.prisma.contactGroupMember.count({
        where: {
          groupId: data.contactGroupId,
          contact: { organizationId, isSuppressed: false },
        },
      });
    }

    return this.prisma.campaign.create({
      data: {
        organizationId,
        name: data.name,
        senderAccountId: data.senderAccountId,
        templateId: data.templateId,
        contactGroupId: data.contactGroupId,
        scheduledAt: data.scheduledAt,
        status: CampaignStatus.DRAFT,
        totalContacts,
      },
    });
  }

  async startCampaign(organizationId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { contactGroup: true, template: true },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot start campaign in status: ${campaign.status}`);
    }

    // 1. Fetch eligible contacts
    const members = await this.prisma.contactGroupMember.findMany({
      where: {
        groupId: campaign.contactGroupId!,
        contact: { organizationId, isSuppressed: false },
      },
      include: { contact: true },
    });

    if (members.length === 0) {
      throw new BadRequestException('No eligible, unsuppressed contacts in selected group');
    }

    // 2. Financial Pre-check & Escrow Hold
    const estimatedCostPaise = BigInt(members.length) * this.defaultPerMessageCostPaise;
    await this.walletService.reserveCampaignEscrow(
      organizationId,
      estimatedCostPaise,
      campaignId,
    );

    // 3. Create initial message records
    const createdMessages = await this.prisma.$transaction(
      members.map((member) =>
        this.prisma.message.create({
          data: {
            organizationId,
            campaignId,
            contactId: member.contact.id,
            senderAccountId: campaign.senderAccountId,
            status: MessageStatus.QUEUED,
            costPaise: this.defaultPerMessageCostPaise,
          },
        }),
      ),
    );

    // 4. Update Campaign status
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.SENDING,
        totalContacts: members.length,
        reservedPaise: estimatedCostPaise,
      },
    });

    // 5. Enqueue into BullMQ
    const messageIds = createdMessages.map((m) => m.id);
    await enqueueCampaignMessages(campaignId, organizationId, messageIds);

    this.logger.log(
      `Dispatched campaign ${campaignId} with ${messageIds.length} messages. Reserved ₹${
        Number(estimatedCostPaise) / 100
      }`,
    );

    return {
      success: true,
      campaignId,
      queuedCount: messageIds.length,
      reservedPaise: estimatedCostPaise.toString(),
    };
  }

  async pauseCampaign(organizationId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.PAUSED },
    });
  }

  async resumeCampaign(organizationId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.SENDING },
    });
  }

  async getCampaignReport(organizationId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: {
        template: true,
        senderAccount: true,
      },
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      totalContacts: campaign.totalContacts,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      failedCount: campaign.failedCount,
      reservedINR: (Number(campaign.reservedPaise) / 100).toFixed(2),
      actualCostINR: (Number(campaign.actualPaiseCost) / 100).toFixed(2),
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt,
    };
  }
}

