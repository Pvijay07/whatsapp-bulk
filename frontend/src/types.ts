export interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  isSuppressed: boolean;
  optInConsent: boolean;
  tag: string;
  createdAt: string;
}

export interface VirtualNumber {
  id: string;
  phoneNumber: string;
  provider: string;
  type: 'LANDLINE_DID' | 'MOBILE' | 'TOLL_FREE';
  status: 'ACTIVE' | 'PENDING_KYC';
  monthlyRentalINR: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    whatsappEligible: boolean;
  };
  region: string;
}

export interface WhatsAppAccount {
  id: string;
  virtualNumberId: string;
  displayNumber: string;
  qualityRating: 'GREEN' | 'YELLOW' | 'RED';
  messagingLimitTier: string;
  status: 'CONNECTED' | 'PENDING';
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  header?: string;
  bodyText: string;
  buttons?: string[];
  supportsSpintax?: boolean;
}

export interface AutoResponderRule {
  id: string;
  keyword: string;
  matchType: 'EXACT' | 'CONTAINS';
  replyText: string;
  isActive: boolean;
  triggerCount: number;
}

export interface Campaign {
  id: string;
  name: string;
  dispatchMode: 'OFFICIAL_CLOUD_API' | 'VIRTUAL_NUMBER_POOL';
  senderNumber: string;
  senderPoolCount?: number;
  templateName: string;
  status: 'DRAFT' | 'SENDING' | 'COMPLETED' | 'PAUSED';
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  delayIntervalSec?: number;
  spintaxEnabled?: boolean;
  reservedINR: string;
  actualCostINR: string;
  createdAt: string;
}

export interface MessageLog {
  id: string;
  campaignId: string;
  contactName: string;
  phoneNumber: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  providerMessageId: string;
  costINR: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  errorCode?: string;
}

export interface WalletTransaction {
  id: string;
  transactionType: 'CREDIT' | 'DEBIT' | 'ESCROW_HOLD' | 'ESCROW_RELEASE';
  amountINR: string;
  balanceAfterINR: string;
  referenceId?: string;
  idempotencyKey: string;
  reason: string;
  createdAt: string;
}

export interface WalletData {
  balanceINR: string;
  reservedINR: string;
  availableINR: string;
  transactions: WalletTransaction[];
}

