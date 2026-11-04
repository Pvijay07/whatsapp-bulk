import { Contact, VirtualNumber, WhatsAppAccount, MessageTemplate, Campaign, MessageLog, WalletData } from './types';

export const initialContacts: Contact[] = [
  {
    id: 'c-1',
    name: 'Ramesh Kumar',
    phoneNumber: '+919876543210',
    isSuppressed: false,
    optInConsent: true,
    tag: 'Bangalore Leads',
    createdAt: '2026-11-01',
  },
  {
    id: 'c-2',
    name: 'Priya Sharma',
    phoneNumber: '+919812345678',
    isSuppressed: false,
    optInConsent: true,
    tag: 'VIP Customers',
    createdAt: '2026-11-02',
  },
  {
    id: 'c-3',
    name: 'Vikram Patel',
    phoneNumber: '+919723456789',
    isSuppressed: false,
    optInConsent: true,
    tag: 'Ahmedabad Retail',
    createdAt: '2026-11-02',
  },
  {
    id: 'c-4',
    name: 'Ananya Iyer',
    phoneNumber: '+919934567890',
    isSuppressed: false,
    optInConsent: true,
    tag: 'Chennai Wholesale',
    createdAt: '2026-11-03',
  },
  {
    id: 'c-5',
    name: 'Rajesh Rao',
    phoneNumber: '+919845012345',
    isSuppressed: true, // Opted out (STOP reply)
    optInConsent: false,
    tag: 'Suppressed / Opted Out',
    createdAt: '2026-10-28',
  },
];

export const initialNumbers: VirtualNumber[] = [
  {
    id: 'num-1',
    phoneNumber: '+918045678901',
    provider: 'Exotel Telephony',
    type: 'LANDLINE_DID',
    status: 'ACTIVE',
    monthlyRentalINR: '599.00',
    capabilities: {
      voice: true, // Used for Meta Voice OTP registration
      sms: false,
      whatsappEligible: true,
    },
    region: 'Bangalore, Karnataka',
  },
  {
    id: 'num-2',
    phoneNumber: '+919876599999',
    provider: 'Airtel IQ Business',
    type: 'MOBILE',
    status: 'ACTIVE',
    monthlyRentalINR: '799.00',
    capabilities: {
      voice: true,
      sms: true,
      whatsappEligible: true,
    },
    region: 'Mumbai, Maharashtra',
  },
];

export const initialWhatsAppAccounts: WhatsAppAccount[] = [
  {
    id: 'waba-1',
    virtualNumberId: 'num-1',
    displayNumber: '+91 80 4567 8901',
    qualityRating: 'GREEN',
    messagingLimitTier: 'TIER_10K (10,000 msgs/day)',
    status: 'CONNECTED',
  },
  {
    id: 'waba-2',
    virtualNumberId: 'num-2',
    displayNumber: '+91 98765 99999',
    qualityRating: 'GREEN',
    messagingLimitTier: 'TIER_1K (1,000 msgs/day)',
    status: 'CONNECTED',
  },
];

export const initialTemplates: MessageTemplate[] = [
  {
    id: 'tmpl-1',
    name: 'diwali_special_offer',
    category: 'MARKETING',
    language: 'en_US',
    header: '✨ Diwali Festive Exclusive',
    bodyText: 'Hello {{1}}! Celebrate this festive season with an exclusive 25% discount across all products. Use coupon code FESTIVE25 at checkout. Valid until midnight tomorrow.',
    buttons: ['Claim Discount', 'Opt Out'],
  },
  {
    id: 'tmpl-2',
    name: 'order_delivery_update',
    category: 'UTILITY',
    language: 'en_US',
    header: '📦 Order Out For Delivery',
    bodyText: 'Hi {{1}}, your order #IND-9021 is out for delivery today via express courier. Please keep cash or UPI ready for receipt.',
    buttons: ['Track Order', 'Contact Support'],
  },
  {
    id: 'tmpl-3',
    name: 'payment_reminder_invoice',
    category: 'UTILITY',
    language: 'en_US',
    header: '📄 Invoice Reminder',
    bodyText: 'Dear {{1}}, this is a friendly reminder that invoice #INV-4418 for ₹4,850 is due today. Please tap below to pay securely.',
    buttons: ['Pay via UPI', 'View PDF'],
  },
];

export const initialCampaigns: Campaign[] = [
  {
    id: 'camp-101',
    name: 'Festive Flash Sale - Wave 1',
    senderNumber: '+91 80 4567 8901',
    templateName: 'diwali_special_offer',
    status: 'COMPLETED',
    totalContacts: 4,
    sentCount: 4,
    deliveredCount: 4,
    readCount: 3,
    failedCount: 0,
    reservedINR: '4.00',
    actualCostINR: '4.00',
    createdAt: '2026-11-04 14:30',
  },
];

export const initialMessages: MessageLog[] = [
  {
    id: 'msg-1',
    campaignId: 'camp-101',
    contactName: 'Ramesh Kumar',
    phoneNumber: '+919876543210',
    status: 'READ',
    providerMessageId: 'wamid.HBgLOTE5ODc2NTQzMjEwFQIAEhgUM0EzRDUwNkQ1NTdB',
    costINR: '1.00',
    sentAt: '14:30:02',
    deliveredAt: '14:30:04',
    readAt: '14:31:12',
  },
  {
    id: 'msg-2',
    campaignId: 'camp-101',
    contactName: 'Priya Sharma',
    phoneNumber: '+919812345678',
    status: 'READ',
    providerMessageId: 'wamid.HBgLOTE5ODEyMzQ1Njc4FQIAEhgUM0EzRDUwNkQ1NTdC',
    costINR: '1.00',
    sentAt: '14:30:03',
    deliveredAt: '14:30:05',
    readAt: '14:32:00',
  },
  {
    id: 'msg-3',
    campaignId: 'camp-101',
    contactName: 'Vikram Patel',
    phoneNumber: '+919723456789',
    status: 'DELIVERED',
    providerMessageId: 'wamid.HBgLOTE5NzIzNDU2Nzg5FQIAEhgUM0EzRDUwNkQ1NTdE',
    costINR: '1.00',
    sentAt: '14:30:04',
    deliveredAt: '14:30:06',
  },
  {
    id: 'msg-4',
    campaignId: 'camp-101',
    contactName: 'Ananya Iyer',
    phoneNumber: '+919934567890',
    status: 'READ',
    providerMessageId: 'wamid.HBgLOTE5OTM0NTY3ODkwFQIAEhgUM0EzRDUwNkQ1NTdG',
    costINR: '1.00',
    sentAt: '14:30:05',
    deliveredAt: '14:30:07',
    readAt: '14:34:10',
  },
];

export const initialWallet: WalletData = {
  balanceINR: '4996.00',
  reservedINR: '0.00',
  availableINR: '4996.00',
  transactions: [
    {
      id: 'tx-1',
      transactionType: 'CREDIT',
      amountINR: '+5000.00',
      balanceAfterINR: '5000.00',
      idempotencyKey: 'recharge_init_pg_90123',
      reason: 'UPI / NetBanking Wallet Top-up (Cashfree)',
      createdAt: '2026-11-04 12:00',
    },
    {
      id: 'tx-2',
      transactionType: 'DEBIT',
      amountINR: '-4.00',
      balanceAfterINR: '4996.00',
      referenceId: 'camp-101',
      idempotencyKey: 'settle_camp-101_1730713800',
      reason: 'Campaign Delivery: Festive Flash Sale (4 msgs @ ₹1.00)',
      createdAt: '2026-11-04 14:31',
    },
  ],
};

