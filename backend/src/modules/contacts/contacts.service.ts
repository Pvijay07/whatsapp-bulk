import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SalesBusterMongoService } from '../salesbuster-followups/salesbuster-mongo.service';
import { ConsentStatus } from '@prisma/client';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mongoService: SalesBusterMongoService,
  ) {}

  private getStorageFile(): string {
    const baseDir =
      process.env.DATA_DIR ||
      (fs.existsSync(path.resolve(process.cwd(), 'backend'))
        ? path.resolve(process.cwd(), 'backend')
        : process.cwd());
    const dataDir = path.resolve(baseDir, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'contacts.json');
  }

  /**
   * Resolves or auto-creates the primary organization record in PostgreSQL.
   */
  async getOrCreateDefaultOrgId(): Promise<string> {
    try {
      const existing = await this.prisma.organization.findFirst();
      if (existing) {
        return existing.id;
      }
      const created = await this.prisma.organization.create({
        data: {
          name: 'Petsfolio Organization',
          status: 'ACTIVE',
        },
      });
      this.logger.log(`Created default organization in PostgreSQL: ${created.id}`);
      return created.id;
    } catch (e: any) {
      this.logger.warn(`PostgreSQL organization query notice: ${e.message}`);
      return '00000000-0000-0000-0000-000000000001';
    }
  }

  /**
   * Retrieves contacts from PostgreSQL/JSON and merges live SalesBuster MongoDB leads
   * scoped to the logged-in organization (tenantDbName) when available.
   */
  async getContacts(
    organizationId?: string,
    page = 1,
    limit = 1000,
    tenantDbName?: string,
    sourceFilter?: string,
  ) {
    const orgId = organizationId || (await this.getOrCreateDefaultOrgId());
    const skip = (page - 1) * limit;

    let localItems: any[] = [];
    let localSource = 'POSTGRESQL';

    if (sourceFilter !== 'mongodb') {
      try {
        const items = await this.prisma.contact.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: 'desc' },
        });
        if (items && items.length > 0) {
          localItems = items;
        }
      } catch (e: any) {
        this.logger.warn(`PostgreSQL getContacts query error: ${e.message}. Using JSON fallback.`);
      }

      if (localItems.length === 0) {
        const file = this.getStorageFile();
        if (fs.existsSync(file)) {
          try {
            localItems = JSON.parse(fs.readFileSync(file, 'utf8'));
            localSource = 'JSON_STORE';
          } catch (e) {}
        }
      }
    }

    let mongoItems: any[] = [];
    if (sourceFilter !== 'local' && this.mongoService?.isConfigured()) {
      try {
        const allOrgs = await this.mongoService.fetchActiveOrganizations();
        const targetOrgs = tenantDbName
          ? allOrgs.filter((o) => o.tenantDbName === tenantDbName)
          : allOrgs;

        for (const org of targetOrgs) {
          const leads = await this.mongoService.fetchEligibleLeads(org.tenantDbName);
          for (const lead of leads) {
            const rawPhone = lead.phoneNormalized || lead.phone || '';
            if (!rawPhone) continue;
            const phone = this.normalizePhoneNumber(rawPhone);
            const createdIso = lead.createdAt
              ? new Date(lead.createdAt).toISOString()
              : new Date().toISOString();
            const createdTime = lead.createdAt
              ? new Date(lead.createdAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recent';

            mongoItems.push({
              id: `mongo_${org.tenantDbName}_${lead._id}`,
              organizationId: orgId,
              name: lead.name?.trim() || phone,
              phoneNumber: phone,
              optInConsent: !lead.isOptedOut,
              isSuppressed: String(lead.status || '').toUpperCase() === 'DND',
              createdAt: createdIso,
              metadata: {
                tag: lead.folder || 'SalesBuster CRM',
                service: lead.service || lead.folder || 'SalesBuster Lead',
                source: 'SalesBuster CRM',
                status: lead.status || 'New',
                assignedRep: org.name || 'CRM',
                enquiredTime: createdTime,
                mongoLeadId: lead._id,
                tenantDbName: org.tenantDbName,
              },
            });
          }
        }
      } catch (mongoErr: any) {
        this.logger.warn(`MongoDB leads fetch in Contacts notice: ${mongoErr.message}`);
      }
    }

    // Merge & de-duplicate by normalized phone (MongoDB CRM leads first when present)
    const seenPhones = new Set<string>();
    const merged: any[] = [];

    for (const item of [...mongoItems, ...localItems]) {
      const norm = this.normalizePhoneNumber(item.phoneNumber || '');
      if (norm && seenPhones.has(norm)) continue;
      if (norm) seenPhones.add(norm);
      merged.push(item);
    }

    return {
      items: merged.slice(skip, skip + limit),
      total: merged.length,
      mongoCount: mongoItems.length,
      localCount: localItems.length,
      page,
      limit,
      source: mongoItems.length > 0 ? `${localSource}+MONGODB` : localSource,
    };
  }

  /**
   * Creates or updates a single contact in PostgreSQL.
   */
  async createContact(
    organizationId: string,
    data: { phoneNumber: string; name?: string; metadata?: any; optInConsent?: boolean; tag?: string; service?: string },
  ) {
    const orgId = organizationId || (await this.getOrCreateDefaultOrgId());
    const normalizedPhone = this.normalizePhoneNumber(data.phoneNumber);
    const meta = data.metadata || {
      tag: data.tag || 'General',
      service: data.service || 'New Inquiries',
      source: 'WhatsApp',
      status: 'New',
      assignedRep: 'ABHI',
      enquiredTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };

    try {
      const contact = await this.prisma.$transaction(async (tx) => {
        const c = await tx.contact.upsert({
          where: {
            organizationId_phoneNumber: {
              organizationId: orgId,
              phoneNumber: normalizedPhone,
            },
          },
          update: {
            name: data.name,
            metadata: meta,
          },
          create: {
            organizationId: orgId,
            phoneNumber: normalizedPhone,
            name: data.name,
            metadata: meta,
          },
        });

        if (data.optInConsent) {
          try {
            await tx.contactConsent.create({
              data: {
                organizationId: orgId,
                contactId: c.id,
                channel: 'whatsapp',
                purpose: 'marketing',
                consentStatus: ConsentStatus.OPTED_IN,
                source: 'manual_entry',
                consentedAt: new Date(),
              },
            });
          } catch (e) {}
        }

        return c;
      });

      this.saveContactToJsonFallback(contact);
      return contact;
    } catch (dbErr: any) {
      this.logger.warn(`PostgreSQL createContact deferred: ${dbErr.message}. Saving to JSON fallback.`);
      const fallbackContact = {
        id: `c-${Date.now()}`,
        organizationId: orgId,
        phoneNumber: normalizedPhone,
        name: data.name || '',
        metadata: meta,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.saveContactToJsonFallback(fallbackContact);
      return fallbackContact;
    }
  }

  /**
   * Batch upserts multiple contacts directly into PostgreSQL.
   */
  async bulkUpsert(organizationId: string, contacts: any[]) {
    const orgId = organizationId || (await this.getOrCreateDefaultOrgId());
    if (!contacts || !Array.isArray(contacts)) return { success: false, count: 0 };

    let count = 0;
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const c of contacts) {
          if (!c.phoneNumber) continue;
          const phone = this.normalizePhoneNumber(c.phoneNumber);
          const meta = c.metadata || {
            tag: c.tag || 'General',
            service: c.service || 'New Inquiries',
            source: c.source || 'WhatsApp',
            status: c.status || 'New',
            assignedRep: c.assignedRep || 'ABHI',
            enquiredTime: c.enquiredTime || 'Recent',
          };

          await tx.contact.upsert({
            where: {
              organizationId_phoneNumber: {
                organizationId: orgId,
                phoneNumber: phone,
              },
            },
            update: {
              name: c.name,
              metadata: meta,
            },
            create: {
              organizationId: orgId,
              phoneNumber: phone,
              name: c.name,
              metadata: meta,
            },
          });
          count++;
        }
      });
      this.logger.log(`✅ Committed ${count} contacts to PostgreSQL database.`);
    } catch (e: any) {
      this.logger.warn(`PostgreSQL bulkUpsert deferred: ${e.message}. Syncing to JSON store.`);
      count = this.syncToJsonFallback(contacts, orgId);
    }

    // Always mirror to disk JSON for maximum safety
    this.syncToJsonFallback(contacts, orgId);
    return { success: true, count };
  }

  /**
   * Deletes a contact by ID from PostgreSQL.
   */
  async deleteContact(organizationId: string, id: string) {
    const orgId = organizationId || (await this.getOrCreateDefaultOrgId());
    try {
      await this.prisma.contact.deleteMany({
        where: { id, organizationId: orgId },
      });
    } catch (e) {}

    // Also remove from JSON fallback
    const file = this.getStorageFile();
    if (fs.existsSync(file)) {
      try {
        const items = JSON.parse(fs.readFileSync(file, 'utf8'));
        const filtered = items.filter((x: any) => x.id !== id);
        fs.writeFileSync(file, JSON.stringify(filtered, null, 2), 'utf8');
      } catch (e) {}
    }

    return { success: true };
  }

  /**
   * Bulk deletes selected contacts by IDs from PostgreSQL & JSON fallback.
   */
  async bulkDelete(organizationId: string, ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: true, count: 0 };
    }
    const orgId = organizationId || (await this.getOrCreateDefaultOrgId());
    let deletedCount = 0;

    try {
      const res = await this.prisma.contact.deleteMany({
        where: { id: { in: ids }, organizationId: orgId },
      });
      deletedCount = res.count;
    } catch (e) {}

    const idSet = new Set(ids);
    const file = this.getStorageFile();
    if (fs.existsSync(file)) {
      try {
        const items = JSON.parse(fs.readFileSync(file, 'utf8'));
        const filtered = items.filter((x: any) => !idSet.has(x.id));
        if (!deletedCount) deletedCount = items.length - filtered.length;
        fs.writeFileSync(file, JSON.stringify(filtered, null, 2), 'utf8');
      } catch (e) {}
    }

    return { success: true, count: deletedCount };
  }

  /**
   * Clears all contacts from PostgreSQL.
   */
  async clearAll(organizationId: string) {
    const orgId = organizationId || (await this.getOrCreateDefaultOrgId());
    try {
      await this.prisma.contact.deleteMany({
        where: { organizationId: orgId },
      });
    } catch (e) {}

    const file = this.getStorageFile();
    if (fs.existsSync(file)) {
      try {
        fs.writeFileSync(file, '[]', 'utf8');
      } catch (e) {}
    }

    return { success: true };
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

  private saveContactToJsonFallback(contact: any) {
    try {
      const file = this.getStorageFile();
      let list: any[] = [];
      if (fs.existsSync(file)) {
        list = JSON.parse(fs.readFileSync(file, 'utf8'));
      }
      const existingIdx = list.findIndex(
        (x) => x.phoneNumber === contact.phoneNumber || x.id === contact.id,
      );
      if (existingIdx >= 0) {
        list[existingIdx] = contact;
      } else {
        list.unshift(contact);
      }
      fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {}
  }

  private syncToJsonFallback(contacts: any[], orgId: string): number {
    try {
      const file = this.getStorageFile();
      let list: any[] = [];
      if (fs.existsSync(file)) {
        try {
          list = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (e) {}
      }

      for (const c of contacts) {
        const phone = this.normalizePhoneNumber(c.phoneNumber);
        const idx = list.findIndex((x) => x.phoneNumber === phone);
        const item = {
          id: c.id || `c-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          organizationId: orgId,
          phoneNumber: phone,
          name: c.name || '',
          metadata: c.metadata || {
            tag: c.tag || 'General',
            service: c.service || 'New Inquiries',
            source: c.source || 'WhatsApp',
            status: c.status || 'New',
            assignedRep: c.assignedRep || 'ABHI',
          },
          createdAt: c.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (idx >= 0) {
          list[idx] = item;
        } else {
          list.unshift(item);
        }
      }
      fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
      return contacts.length;
    } catch (e) {
      return 0;
    }
  }

  private normalizePhoneNumber(phone: string): string {
    let clean = (phone || '').replace(/[^\d+]/g, '');
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
