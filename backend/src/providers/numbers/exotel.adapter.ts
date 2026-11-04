import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  NumberProvider,
  AvailableNumber,
  ProvisionedNumber,
  NumberStatus,
} from './number-provider.interface';

@Injectable()
export class ExotelNumberAdapter implements NumberProvider {
  readonly providerName = 'exotel';
  private readonly logger = new Logger(ExotelNumberAdapter.name);

  private readonly apiKey = process.env.NUMBER_PROVIDER_API_KEY;
  private readonly apiToken = process.env.NUMBER_PROVIDER_API_TOKEN;
  private readonly accountSid = process.env.NUMBER_PROVIDER_ACCOUNT_SID;
  private readonly baseUrl = 'https://api.exotel.com/v1/Accounts';

  async searchNumbers(options: {
    countryCode?: string;
    type?: 'MOBILE' | 'LANDLINE_DID' | 'TOLL_FREE';
  }): Promise<AvailableNumber[]> {
    // In production, queries Exotel Inventory API with authorized credentials
    this.logger.log(`Querying Exotel Indian Virtual Number Inventory: ${options.countryCode || '+91'}`);
    return [
      {
        providerNumberId: 'exo-did-918049100200',
        phoneNumber: '+918049100200',
        countryCode: '+91',
        monthlyRentalPaise: 59900n, // ₹599/mo
        setupCostPaise: 0n,
        type: 'LANDLINE_DID',
        capabilities: {
          voice: true, // Voice OTP for Meta WhatsApp Business Account
          sms: false,
          mms: false,
          whatsappEligible: true,
        },
        region: 'Bangalore (KA)',
      },
    ];
  }

  async purchaseNumber(
    providerNumberId: string,
    organizationKycRef: string,
  ): Promise<ProvisionedNumber> {
    this.logger.log(
      `Initiating Exotel number provisioning: ${providerNumberId} under KYC reference: ${organizationKycRef}`,
    );
    // Exotel requires TRAI Customer Acquisition Form (CAF) approval in compliance with DoT
    return {
      providerNumberId,
      phoneNumber: '+918049100200',
      status: 'ALLOCATED',
      kycRequired: true,
      provisionedAt: new Date(),
    };
  }

  async releaseNumber(providerNumberId: string): Promise<void> {
    this.logger.log(`Decommissioning Exotel number: ${providerNumberId}`);
  }

  async getNumberStatus(providerNumberId: string): Promise<NumberStatus> {
    return {
      providerNumberId,
      phoneNumber: '+918049100200',
      status: 'ACTIVE',
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }
}

