import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async getTemplates(@Request() req: any) {
    return this.templatesService.getTemplates(req.user.organizationId);
  }

  @Post()
  async createTemplate(
    @Request() req: any,
    @Body() body: { name: string; category: string; language?: string; components: any },
  ) {
    return this.templatesService.createTemplate(req.user.organizationId, body);
  }
}

