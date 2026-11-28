import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  FollowupCampaignConfig,
  FollowupOrgScope,
  SalesBusterFollowupsService,
} from './salesbuster-followups.service';
import { SalesBusterMongoService } from './salesbuster-mongo.service';

@ApiTags('SalesBuster Followups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('salesbuster-followups')
export class SalesBusterFollowupsController {
  constructor(
    private readonly followupsService: SalesBusterFollowupsService,
    private readonly mongoService: SalesBusterMongoService,
  ) {}

  private extractOrgScope(req: any): FollowupOrgScope | undefined {
    const tenantDbName = req?.user?.tenantDbName;
    const mongoOrgId = req?.user?.mongoOrgId;
    const orgName = req?.user?.orgName;
    if (!tenantDbName && !mongoOrgId) return undefined;
    return { tenantDbName, mongoOrgId, orgName };
  }

  @Get('reports')
  async getReports(
    @Request() req: any,
    @Query('stage') stage?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = this.extractOrgScope(req);
    const data = await this.followupsService.getReports(
      stage,
      limit ? parseInt(limit, 10) : 100,
      scope,
    );
    return {
      mongoConfigured: this.mongoService.isConfigured(),
      scopedOrganization: scope?.orgName || null,
      scopedTenantDb: scope?.tenantDbName || null,
      ...data,
    };
  }

  @Get('states')
  async getStates(@Request() req: any, @Query('limit') limit?: string) {
    const scope = this.extractOrgScope(req);
    const states = await this.followupsService.getStates(
      limit ? parseInt(limit, 10) : 100,
      scope,
    );
    return { states };
  }

  @Get('config')
  getConfig() {
    return this.followupsService.getConfig();
  }

  @Post('config')
  updateConfig(@Body() body: Partial<FollowupCampaignConfig>) {
    return {
      success: true,
      config: this.followupsService.updateConfig(body),
    };
  }

  @Get('preview')
  async previewDueLeads(@Request() req: any) {
    if (!this.mongoService.isConfigured()) {
      return {
        success: false,
        dueCount: 0,
        dueLeads: [],
        message: 'SALESBUSTER_MONGO_URI is not configured in backend/.env',
      };
    }
    const scope = this.extractOrgScope(req);
    const result = await this.followupsService.previewDueLeads(new Date(), scope);
    return { success: true, ...result };
  }

  @Post('run-now')
  async runNow(@Request() req: any, @Body() body?: { selectedKeys?: string[] }) {
    if (!this.mongoService.isConfigured()) {
      return {
        success: false,
        message: 'SALESBUSTER_MONGO_URI is not configured in backend/.env',
      };
    }
    const scope = this.extractOrgScope(req);
    const result = this.followupsService.triggerBackgroundRun(body?.selectedKeys, scope);
    return { success: true, ...result };
  }

  @Post('stop')
  stopNow() {
    return this.followupsService.stopFollowupCycle();
  }

  @Post('clear')
  async clearAll(@Request() req: any) {
    const scope = this.extractOrgScope(req);
    return this.followupsService.clearFollowupData(scope);
  }
}
