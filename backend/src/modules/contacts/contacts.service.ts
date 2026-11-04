import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConsentStatus } from '@prisma/client';
import { parse } from 'csv-parse';
import { Readable } from 'stream';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getContacts(organizationId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.contact.findMany({
        where: { organizationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contact.count({ where: { organizationId } }),
    ]);

    return { items, total, page, limit };
  }

  async createContact(
    organizationId: string,
    data: { phoneNumber: string; name?: string; metadata?: any; optInConsent?: boolean },
  ) {
    const normalizedPhone = this.normalizePhoneNumber(data.phoneNumber);

    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.upsert({
        where: {
          organizationId_phoneNumber: {
            organizationId,
            phoneNumber: normalizedPhone,
          },
        },
        update: {
          name: data.name,
          metadata: data.metadata || {},
        },
        create: {
          organizationId,
          phoneNumber: normalizedPhone,
          name: data.name,
          metadata: data.metadata || {},
        },
      });

      if (data.optInConsent) {
        await tx.contactConsent.create({
          data: {
            organizationId,
            contactId: contact.id,
            channel: 'whatsapp',
            purpose: 'marketing',
            consentStatus: ConsentStatus.OPTED_IN,
            source: 'manual_entry',
            consentedAt: new Date(),
          },
        });
      }

      return contact;
    });
  }

  /**
   * High performance streaming CSV import for contacts with batching
   */
  async importCsvContacts(
    organizationId: string,
    fileBuffer: Buffer,
    groupId?: string,
    consentConfirmed = false,
  ) {
    if (!consentConfirmed) {
      throw new BadRequestException(
        'You must confirm that imported contacts have provided explicit opt-in consent under WhatsApp policies.',
      );
    }

    const stream = Readable.from(fileBuffer);
    const parser = stream.pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }),
    );

    let importedCount = 0;
    const batchSize = 100;
    let batch: Array<{ phoneNumber: string; name?: string; metadata: any }> = [];

    for await (const row of parser) {
      const phoneRaw = row.phone || row.phoneNumber || row.mobile || row.Phone || row.Mobile;
      if (!phoneRaw) continue;

      const normalizedPhone = this.normalizePhoneNumber(phoneRaw);
      const name = row.name || row.Name || row.fullName || '';
      
      batch.push({
        phoneNumber: normalizedPhone,
        name,
        metadata: row,
      });

      if (batch.length >= batchSize) {
        await this.flushBatch(organizationId, batch, groupId);
        importedCount += batch.length;
        batch = [];
      }
    }

    if (batch.length > 0) {
      await this.flushBatch(organizationId, batch, groupId);
      importedCount += batch.length;
    }

    this.logger.log(`Successfully imported ${importedCount} contacts for org ${organizationId}`);
    return { success: true, count: importedCount };
  }

  private async flushBatch(
    organizationId: string,
    batch: Array<{ phoneNumber: string; name?: string; metadata: any }>,
    groupId?: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      for (const item of batch) {
        const contact = await tx.contact.upsert({
          where: {
            organizationId_phoneNumber: {
              organizationId,
              phoneNumber: item.phoneNumber,
            },
          },
          update: {
            name: item.name,
            metadata: item.metadata,
          },
          create: {
            organizationId,
            phoneNumber: item.phoneNumber,
            name: item.name,
            metadata: item.metadata,
          },
        });

        // Add consent
        await tx.contactConsent.create({
          data: {
            organizationId,
            contactId: contact.id,
            channel: 'whatsapp',
            purpose: 'marketing',
            consentStatus: ConsentStatus.OPTED_IN,
            source: 'csv_import',
            consentedAt: new Date(),
          },
        });

        // Add to group if specified
        if (groupId) {
          await tx.contactGroupMember.upsert({
            where: {
              groupId_contactId: {
                groupId,
                contactId: contact.id,
              },
            },
            create: {
              groupId,
              contactId: contact.id,
            },
            update: {},
          });
        }
      }
    });
  }

  private normalizePhoneNumber(phone: string): string {
    let clean = phone.replace(/[^\d+]/g, '');
    if (!clean.startsWith('+')) {
      if (clean.length === 10) {
        clean = `+91${clean}`; // Default to India (+91)
      } else {
        clean = `+${clean}`;
      }
    }
    return clean;
  }
}

