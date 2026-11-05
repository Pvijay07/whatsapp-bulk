import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Database & Common
import { PrismaService } from './database/prisma.service';

// Adapters & Virtual Pool Engine
import { VirtualPoolManagerService } from './providers/messaging/virtual-pool-manager.service';
import { OtpRentalService } from './providers/numbers/otp-rental.service';
import { AccountWarmerService } from './providers/messaging/account-warmer.service';
import { BaileysSessionService } from './providers/messaging/baileys-session.service';
import { VirtualGatewayAdapter } from './providers/messaging/virtual-gateway.adapter';
import { MockMessagingAdapter } from './providers/messaging/mock-messaging.adapter';
import { ExotelNumberAdapter } from './providers/numbers/exotel.adapter';
import { MockNumberAdapter } from './providers/numbers/mock-number.adapter';

// Modules & Services
import { AuthService } from './modules/auth/auth.service';
import { AuthController } from './modules/auth/auth.controller';
import { JwtStrategy } from './modules/auth/jwt.strategy';

import { SessionController } from './modules/session/session.controller';
import { VirtualPoolController } from './modules/virtual-pool/virtual-pool.controller';

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
    SessionController,
    VirtualPoolController,
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
    VirtualPoolManagerService,
    OtpRentalService,
    AccountWarmerService,
    BaileysSessionService,
    VirtualGatewayAdapter,
    MockMessagingAdapter,
    ExotelNumberAdapter,
    MockNumberAdapter,
  ],
})
export class AppModule {}

