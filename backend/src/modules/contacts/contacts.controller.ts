import { Controller, Get, Post, Delete, Body, Param, Query, Request, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactsService } from './contacts.service';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async getContacts(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '1000',
    @Query('source') source?: string,
  ) {
    const orgId = req.user?.organizationId || (await this.contactsService.getOrCreateDefaultOrgId());
    const tenantDbName = req.user?.tenantDbName || undefined;
    return this.contactsService.getContacts(
      orgId,
      parseInt(page, 10),
      parseInt(limit, 10),
      tenantDbName,
      source,
    );
  }

  @Post()
  async createContact(
    @Request() req: any,
    @Body()
    body: {
      phoneNumber: string;
      name?: string;
      metadata?: any;
      optInConsent?: boolean;
      tag?: string;
      service?: string;
    },
  ) {
    const orgId = req.user?.organizationId || (await this.contactsService.getOrCreateDefaultOrgId());
    return this.contactsService.createContact(orgId, body);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  async bulkCreateContacts(
    @Request() req: any,
    @Body() body: { contacts: any[] },
  ) {
    const orgId = req.user?.organizationId || (await this.contactsService.getOrCreateDefaultOrgId());
    return this.contactsService.bulkUpsert(orgId, body.contacts || []);
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  async bulkDeleteContacts(@Request() req: any, @Body() body: { ids: string[] }) {
    const orgId = req.user?.organizationId || (await this.contactsService.getOrCreateDefaultOrgId());
    return this.contactsService.bulkDelete(orgId, body?.ids || []);
  }

  @Delete(':id')
  async deleteContact(@Request() req: any, @Param('id') id: string) {
    const orgId = req.user?.organizationId || (await this.contactsService.getOrCreateDefaultOrgId());
    return this.contactsService.deleteContact(orgId, id);
  }

  @Delete()
  async clearAllContacts(@Request() req: any) {
    const orgId = req.user?.organizationId || (await this.contactsService.getOrCreateDefaultOrgId());
    return this.contactsService.clearAll(orgId);
  }

  @Post('import')
  async importContactsRaw(
    @Request() req: any,
    @Body() body: { csvData: string; groupId?: string; consentConfirmed: boolean },
  ) {
    const orgId = req.user?.organizationId || (await this.contactsService.getOrCreateDefaultOrgId());
    const buffer = Buffer.from(body.csvData, 'utf-8');
    return this.contactsService.importCsvContacts(
      orgId,
      buffer,
      body.groupId,
      body.consentConfirmed,
    );
  }
}
