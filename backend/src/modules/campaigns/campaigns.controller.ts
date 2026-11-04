import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

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
}

