import { Injectable, Logger } from '@nestjs/common';
import {
  NumberProvider,
  AvailableNumber,
  ProvisionedNumber,
  NumberStatus,
} from './number-provider.interface';

@Injectable()
export class MockNumberAdapter implements NumberProvider {
  readonly providerName = 'mock_provider';
  private readonly logger = new Logger(MockNumberAdapter.name);

  async searchNumbers(options: {
    countryCode?: string;
    type?: 'MOBILE' | 'LANDLINE_DID' | 'TOLL_FREE';
  }): Promise<AvailableNumber[]> {
    this.logger.log(`Searching mock Indian numbers with options: ${JSON.stringify(options)}`);
    return [
      {
        providerNumberId: 'mock-did-080-45678901',
        phoneNumber: '+918045678901',
        countryCode: '+91',
        monthlyRentalPaise: 49900n, // ₹499.00
        setupCostPaise: 0n,
        type: 'LANDLINE_DID',
        capabilities: {
          voice: true, // Supports Voice OTP verification for Meta Cloud API!
          sms: false,
          mms: false,
          whatsappEligible: true,
        },
        region: 'Bangalore / Karnataka',
      },
      {
        providerNumberId: 'mock-mob-919876543210',
        phoneNumber: '+919876543210',
        countryCode: '+91',
        monthlyRentalPaise: 79900n, // ₹799.00
        setupCostPaise: 10000n,
        type: 'MOBILE',
        capabilities: {
          voice: true,
          sms: true,
          mms: false,
          whatsappEligible: true,
        },
        region: 'Mumbai / Maharashtra',
      },
    ];
  }

  async purchaseNumber(
    providerNumberId: string,
    organizationKycRef: string,
  ): Promise<ProvisionedNumber> {
    this.logger.log(
      `Purchased mock number ${providerNumberId} with KYC ref ${organizationKycRef}`,
    );
    return {
      providerNumberId,
      phoneNumber: providerNumberId.includes('080') ? '+918045678901' : '+919876543210',
      status: 'ACTIVE',
      kycRequired: false,
      provisionedAt: new Date(),
    };
  }

  async releaseNumber(providerNumberId: string): Promise<void> {
    this.logger.log(`Released mock number: ${providerNumberId}`);
  }

  async getNumberStatus(providerNumberId: string): Promise<NumberStatus> {
    return {
      providerNumberId,
      phoneNumber: '+918045678901',
      status: 'ACTIVE',
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }
}

