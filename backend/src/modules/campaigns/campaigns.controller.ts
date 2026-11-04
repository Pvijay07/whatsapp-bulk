import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  async getCampaigns(@Request() req: any) {
    return this.campaignsService.getCampaigns(req.user.organizationId);
  }

  @Post()
  async createCampaign(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      senderAccountId: string;
      templateId: string;
      contactGroupId?: string;
      scheduledAt?: string;
    },
  ) {
    return this.campaignsService.createCampaign(req.user.organizationId, {
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    });
  }

  @Post(':id/start')
  async startCampaign(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.startCampaign(req.user.organizationId, id);
  }

  @Post(':id/pause')
  async pauseCampaign(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.pauseCampaign(req.user.organizationId, id);
  }

  @Post(':id/resume')
  async resumeCampaign(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.resumeCampaign(req.user.organizationId, id);
  }

  @Get(':id/report')
  async getReport(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.getCampaignReport(req.user.organizationId, id);
  }

  @Get(':id/messages')
  async getMessages(
    @Request() req: any,
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.campaignsService.getCampaignMessages(
      req.user.organizationId,
      id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Post('quick-send')
  async quickSend(
    @Request() req: any,
    @Body()
    body: {
      contactId: string;
      senderAccountId: string;
      templateId?: string;
      customMessage?: string;
    },
  ) {
    return this.campaignsService.quickSend(req.user.organizationId, body);
  }
}

