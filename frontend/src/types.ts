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
  status: 'ACTIVE' | 'CONNECTED' | 'PENDING_SYNC';
  sessionStatus: 'CONNECTED' | 'DISCONNECTED' | 'PAIRING';
  dailyLimit: number;
  dailySentCount: number;
  healthScore?: number;
  warmupStage?: 'UNWARMED' | 'WARMING' | 'WARMED_READY';
  proxyDisplay?: string;
  monthlyRentalINR: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    virtualMessaging: boolean;
  };
  region: string;
}

export interface WhatsAppAccount {
  id: string;
  virtualNumberId: string;
  displayNumber: string;
  sessionState: 'ONLINE' | 'OFFLINE';
  status: 'CONNECTED' | 'PENDING';
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'CUSTOM';
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
  dispatchType: 'MULTI_NUMBER_POOL' | 'DEDICATED_NUMBER';
  senderNumber: string;
  senderPoolCount?: number;
  customMessageText: string;
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

export interface WarmupLogEntry {
  id: string;
  fromNumber: string;
  toNumber: string;
  snippet: string;
  timestamp: string;
}

