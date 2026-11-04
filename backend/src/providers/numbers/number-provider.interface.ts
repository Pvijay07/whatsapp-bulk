export interface AvailableNumber {
  providerNumberId: string;
  phoneNumber: string;
  countryCode: string;
  monthlyRentalPaise: bigint;
  setupCostPaise: bigint;
  type: 'MOBILE' | 'LANDLINE_DID' | 'TOLL_FREE';
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    whatsappEligible: boolean;
  };
  region?: string;
}

export interface ProvisionedNumber {
  providerNumberId: string;
  phoneNumber: string;
  status: 'ACTIVE' | 'PENDING_KYC' | 'ALLOCATED';
  kycRequired: boolean;
  provisionedAt: Date;
}

export interface NumberStatus {
  providerNumberId: string;
  phoneNumber: string;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  renewalDate?: Date;
}

export interface NumberProvider {
  readonly providerName: string;

  /**
   * Search for available Indian (+91) or international numbers
   */
  searchNumbers(options: {
    countryCode?: string;
    type?: 'MOBILE' | 'LANDLINE_DID' | 'TOLL_FREE';
    capabilities?: string[];
  }): Promise<AvailableNumber[]>;

  /**
   * Purchase/provision an Indian virtual number for an organization
   */
  purchaseNumber(
    providerNumberId: string,
    organizationKycRef: string,
  ): Promise<ProvisionedNumber>;

  /**
   * Release or cancel a virtual number allocation
   */
  releaseNumber(providerNumberId: string): Promise<void>;

  /**
   * Fetch current live status of the provisioned number from the telco/cloud provider
   */
  getNumberStatus(providerNumberId: string): Promise<NumberStatus>;
}

