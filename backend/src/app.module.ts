import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Database & Common
import { PrismaService } from './database/prisma.service';

// Adapters
import { MetaCloudApiAdapter } from './providers/messaging/meta-cloud-api.adapter';
import { MockMessagingAdapter } from './providers/messaging/mock-messaging.adapter';
import { ExotelNumberAdapter } from './providers/numbers/exotel.adapter';
import { MockNumberAdapter } from './providers/numbers/mock-number.adapter';

// Modules & Services
import { AuthService } from './modules/auth/auth.service';
import { AuthController } from './modules/auth/auth.controller';
import { JwtStrategy } from './modules/auth/jwt.strategy';

import { WalletService } from './modules/wallet/wallet.service';
import { WalletController } from './modules/wallet/wallet.controller';

import { ConsentService } from './modules/consent/consent.service';
import { ContactsService } from './modules/contacts/contacts.service';
import { ContactsController } from './modules/contacts/contacts.controller';

import { CampaignsService } from './modules/campaigns/campaigns.service';
import { CampaignsController } from './modules/campaigns/campaigns.controller';

import { VirtualNumbersService } from './modules/virtual-numbers/virtual-numbers.service';
import { VirtualNumbersController } from './modules/virtual-numbers/virtual-numbers.controller';

import { WhatsAppAccountsService } from './modules/whatsapp-accounts/whatsapp-accounts.service';
import { WhatsAppAccountsController } from './modules/whatsapp-accounts/whatsapp-accounts.controller';

import { TemplatesService } from './modules/templates/templates.service';
import { TemplatesController } from './modules/templates/templates.controller';

import { WebhooksController } from './modules/webhooks/webhooks.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_development_jwt_key_32_chars',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [
    AuthController,
    WalletController,
    ContactsController,
    CampaignsController,
    TemplatesController,
    VirtualNumbersController,
    WhatsAppAccountsController,
    WebhooksController,
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    AuthService,
    WalletService,
    ConsentService,
    ContactsService,
    CampaignsService,
    TemplatesService,
    VirtualNumbersService,
    WhatsAppAccountsService,
    MetaCloudApiAdapter,
    MockMessagingAdapter,
    ExotelNumberAdapter,
    MockNumberAdapter,
  ],
})
export class AppModule {}

