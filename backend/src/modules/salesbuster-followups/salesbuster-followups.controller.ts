import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SalesBusterFollowupsService } from './salesbuster-followups.service';
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

  @Get('reports')
  async getReports(
    @Query('stage') stage?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.followupsService.getReports(
      stage,
      limit ? parseInt(limit, 10) : 100,
    );
    return {
      mongoConfigured: this.mongoService.isConfigured(),
      ...data,
    };
  }

  @Get('states')
  async getStates(@Query('limit') limit?: string) {
    const states = await this.followupsService.getStates(
      limit ? parseInt(limit, 10) : 100,
    );
    return { states };
  }

  @Post('run-now')
  async runNow() {
    if (!this.mongoService.isConfigured()) {
      return {
        success: false,
        message: 'SALESBUSTER_MONGO_URI is not configured in backend/.env',
      };
    }
    const result = await this.followupsService.runFollowupCycle();
    return { success: true, ...result };
  }
}
