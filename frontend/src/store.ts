import { Contact, VirtualNumber, WhatsAppAccount, MessageTemplate, Campaign, MessageLog, WalletData, WarmupLogEntry } from './types';

// Clean initial state (Zero mock data - genuine live system)
export const initialContacts: Contact[] = [];

export const initialNumbers: VirtualNumber[] = [];

export const initialWhatsAppAccounts: WhatsAppAccount[] = [];

export const initialTemplates: MessageTemplate[] = [
  {
    id: 'tmpl-1',
    name: 'Special Promotion Offer',
    category: 'MARKETING',
    language: 'en_US',
    header: '✨ Special Exclusive Offer',
    bodyText: '{Hello|Hi|Greetings} {{1}}! {We are offering an exclusive discount today:|Check out our special promotion:} 25% off across all items. Reply YES to receive details!',
    buttons: ['Claim Offer', 'Opt Out'],
    supportsSpintax: true,
  },
  {
    id: 'tmpl-2',
    name: 'Order Out For Delivery',
    category: 'UTILITY',
    language: 'en_US',
    header: '📦 Delivery Update',
    bodyText: '{Hi|Dear} {{1}}, your order is out for delivery today. {Our delivery courier will arrive shortly.|Please keep your phone reachable.}',
    buttons: ['Track Order', 'Contact Support'],
    supportsSpintax: true,
  },
  {
    id: 'tmpl-3',
    name: 'Invoice Due Reminder',
    category: 'UTILITY',
    language: 'en_US',
    header: '📄 Invoice Reminder',
    bodyText: '{Hello|Dear} {{1}}, this is a friendly reminder that invoice #INV-4418 is due today. Tap below to settle easily.',
    buttons: ['Pay via UPI', 'View PDF'],
    supportsSpintax: true,
  },
];

export const initialCampaigns: Campaign[] = [];

export const initialMessages: MessageLog[] = [];

export const initialWarmupLogs: WarmupLogEntry[] = [];

export const initialWallet: WalletData = {
  balanceINR: '1000.00',
  reservedINR: '0.00',
  availableINR: '1000.00',
  transactions: [
    {
      id: 'tx-init',
      transactionType: 'CREDIT',
      amountINR: '+1000.00',
      balanceAfterINR: '1000.00',
      idempotencyKey: 'init_wallet_balance',
      reason: 'Initial Account Wallet Balance',
      createdAt: new Date().toLocaleDateString('en-IN'),
    },
  ],
};
