import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConsentStatus } from '@prisma/client';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a contact is eligible for messaging (must have valid consent and not be suppressed)
   */
  async isEligible(organizationId: string, phoneNumber: string, channel = 'whatsapp'): Promise<boolean> {
    const contact = await this.prisma.contact.findUnique({
      where: {
        organizationId_phoneNumber: {
          organizationId,
          phoneNumber,
        },
      },
      include: {
        consents: {
          where: { channel, consentStatus: ConsentStatus.OPTED_IN },
        },
      },
    });

    if (!contact) return false;
    if (contact.isSuppressed) return false;

    // Contact is eligible if not suppressed and has opt-in consent
    return contact.consents.length > 0;
  }

  /**
   * Record explicit opt-in consent
   */
  async recordOptIn(
    organizationId: string,
    contactId: string,
    channel = 'whatsapp',
    purpose = 'marketing',
    source = 'website_form',
  ) {
    return this.prisma.contactConsent.create({
      data: {
        organizationId,
        contactId,
        channel,
        purpose,
        consentStatus: ConsentStatus.OPTED_IN,
        source,
        consentedAt: new Date(),
      },
    });
  }

  /**
   * Suppress contact globally across organization (triggered on user STOP reply or complaints)
   */
  async suppressContact(organizationId: string, phoneNumber: string, reason = 'USER_OPT_OUT_STOP') {
    this.logger.warn(`Suppressing phone number ${phoneNumber} for org ${organizationId}. Reason: ${reason}`);

    const contact = await this.prisma.contact.findUnique({
      where: {
        organizationId_phoneNumber: {
          organizationId,
          phoneNumber,
        },
      },
    });

    if (!contact) return null;

    // Mark contact as suppressed and revoke consents
    await this.prisma.$transaction([
      this.prisma.contact.update({
        where: { id: contact.id },
        data: { isSuppressed: true },
      }),
      this.prisma.contactConsent.updateMany({
        where: { contactId: contact.id },
        data: {
          consentStatus: ConsentStatus.OPTED_OUT,
          revokedAt: new Date(),
        },
      }),
    ]);

    return contact;
  }
}

