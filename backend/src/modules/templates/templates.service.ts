import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TemplateStatus } from '@prisma/client';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTemplates(organizationId: string) {
    return this.prisma.messageTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(
    organizationId: string,
    data: {
      name: string;
      category: string;
      language?: string;
      components: any;
    },
  ) {
    return this.prisma.messageTemplate.create({
      data: {
        organizationId,
        name: data.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        category: data.category,
        language: data.language || 'en_US',
        components: data.components || [],
        status: TemplateStatus.APPROVED, // Automatically mark approved for mock / dev
      },
    });
  }
}

