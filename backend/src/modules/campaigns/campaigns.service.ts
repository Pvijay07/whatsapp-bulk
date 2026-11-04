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

  async getCampaigns(organizationId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { organizationId },
      include: {
        template: true,
        senderAccount: true,
        contactGroup: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((c) => ({
      ...c,
      reservedINR: (Number(c.reservedPaise) / 100).toFixed(2),
      actualCostINR: (Number(c.actualPaiseCost) / 100).toFixed(2),
    }));
  }

  async getCampaignMessages(
    organizationId: string,
    campaignId: string,
    page = 1,
    limit = 50,
  ) {
    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { organizationId, campaignId },
        include: { contact: true, senderAccount: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.count({ where: { organizationId, campaignId } }),
    ]);

    return {
      items: messages.map((m) => ({
        id: m.id,
        contactName: m.contact.name || 'Unknown',
        phoneNumber: m.contact.phoneNumber,
        status: m.status,
        providerMessageId: m.providerMessageId,
        costINR: (Number(m.costPaise) / 100).toFixed(2),
        errorCode: m.errorCode,
        errorMessage: m.errorMessage,
        sentAt: m.sentAt,
        deliveredAt: m.deliveredAt,
        readAt: m.readAt,
        createdAt: m.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async quickSend(
    organizationId: string,
    data: {
      contactId: string;
      senderAccountId: string;
      templateId?: string;
      customMessage?: string;
    },
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: data.contactId, organizationId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    const sender = await this.prisma.whatsAppAccount.findFirst({
      where: { id: data.senderAccountId, organizationId },
    });
    if (!sender) throw new NotFoundException('Sender account not found');

    // 1. Reserve 100 paise (₹1.00)
    await this.walletService.reserveCampaignEscrow(
      organizationId,
      this.defaultPerMessageCostPaise,
      `quick_${contact.id}`,
    );

    // 2. Create quick campaign
    const campaign = await this.prisma.campaign.create({
      data: {
        organizationId,
        name: `Direct: ${contact.name || contact.phoneNumber}`,
        senderAccountId: sender.id,
        templateId: data.templateId,
        status: CampaignStatus.SENDING,
        totalContacts: 1,
        reservedPaise: this.defaultPerMessageCostPaise,
      },
    });

    // 3. Create message record
    const message = await this.prisma.message.create({
      data: {
        organizationId,
        campaignId: campaign.id,
        contactId: contact.id,
        senderAccountId: sender.id,
        status: MessageStatus.QUEUED,
        costPaise: this.defaultPerMessageCostPaise,
      },
    });

    // 4. Dispatch
    await enqueueCampaignMessages(campaign.id, organizationId, [message.id]);

    return {
      success: true,
      campaignId: campaign.id,
      messageId: message.id,
      phoneNumber: contact.phoneNumber,
    };
  }
}

