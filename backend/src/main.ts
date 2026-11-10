import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Pre-load .env from either backend/.env or root .env
const envCandidates = [
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '.env'),
];
for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://messaging_user:SecurePassword123!@localhost:5432/messaging?schema=public';
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Body parser size limits for attachments (images, PDFs, media)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Global prefix
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('WhatsApp Bulk Messaging SaaS API')
    .setDescription(
      'Multi-tenant API for Indian Virtual Numbers (+91), WhatsApp Business Platform campaigns, contact CRM, and prepaid wallet ledger.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`SalesBuster API is running on: http://localhost:${port}/${globalPrefix}`);
  logger.log(`Interactive API Docs available on: http://localhost:${port}/api/docs`);
}

bootstrap();

