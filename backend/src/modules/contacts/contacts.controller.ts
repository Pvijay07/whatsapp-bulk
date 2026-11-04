import { Controller, Get, Post, Body, Query, UseGuards, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async getContacts(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.contactsService.getContacts(req.user.organizationId, parseInt(page, 10), parseInt(limit, 10));
  }

  @Post()
  async createContact(
    @Request() req: any,
    @Body() body: { phoneNumber: string; name?: string; metadata?: any; optInConsent?: boolean },
  ) {
    return this.contactsService.createContact(req.user.organizationId, body);
  }

  @Post('import')
  async importContactsRaw(
    @Request() req: any,
    @Body() body: { csvData: string; groupId?: string; consentConfirmed: boolean },
  ) {
    const buffer = Buffer.from(body.csvData, 'utf-8');
    return this.contactsService.importCsvContacts(
      req.user.organizationId,
      buffer,
      body.groupId,
      body.consentConfirmed,
    );
  }
}

