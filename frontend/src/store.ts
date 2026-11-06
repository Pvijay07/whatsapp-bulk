import { Contact, VirtualNumber, WhatsAppAccount, MessageTemplate, Campaign, MessageLog, WalletData, WarmupLogEntry } from './types';

// Realistic leads matching salesbuster.ai pipeline format
export const initialContacts: Contact[] = [
  {
    id: 'c-lead-1',
    name: '///',
    phoneNumber: '+919898133221',
    tag: 'General Enquiry',
    service: 'General Enquiry',
    source: 'WhatsApp',
    status: 'New',
    assignedRep: 'ABHI',
    enquiredTime: '5:11 PM',
    createdAt: 'Nov 4, 2026',
    optInConsent: true,
    isSuppressed: false,
  },
  {
    id: 'c-lead-2',
    name: 'Malaya Ranjan Pattanaik',
    phoneNumber: '+917008651883',
    tag: 'Training',
    service: 'Training',
    source: 'WhatsApp',
    status: 'New',
    assignedRep: 'saiteja',
    enquiredTime: '5:10 PM',
    createdAt: 'Nov 4, 2026',
    optInConsent: true,
    isSuppressed: false,
  },
  {
    id: 'c-lead-3',
    name: 'himanshuyadavshiahilr123',
    phoneNumber: '+918077552017',
    tag: 'General Enquiry',
    service: 'General Enquiry',
    source: 'WhatsApp',
    status: 'New',
    assignedRep: 'sahil',
    enquiredTime: '5:09 PM',
    createdAt: 'Nov 4, 2026',
    optInConsent: true,
    isSuppressed: false,
  },
  {
    id: 'c-lead-4',
    name: 'Ruhii 🤍',
    phoneNumber: '+918431590424',
    tag: 'Training',
    service: 'Training',
    source: 'WhatsApp',
    status: 'New',
    assignedRep: 'ABHI',
    enquiredTime: '4:55 PM',
    createdAt: 'Nov 4, 2026',
    optInConsent: true,
    isSuppressed: false,
  },
  {
    id: 'c-lead-5',
    name: 'Lakhan',
    phoneNumber: '+918837427930',
    tag: 'General Enquiry',
    service: 'General Enquiry',
    source: 'WhatsApp',
    status: 'New',
    assignedRep: 'saiteja',
    enquiredTime: '4:53 PM',
    createdAt: 'Nov 4, 2026',
    optInConsent: true,
    isSuppressed: false,
  },
  {
    id: 'c-lead-6',
    name: 'Ray R Dharma',
    phoneNumber: '+919845094358',
    tag: 'General Enquiry',
    service: 'General Enquiry',
    source: 'WhatsApp',
    status: 'New',
    assignedRep: 'sahil',
    enquiredTime: '4:48 PM',
    createdAt: 'Nov 4, 2026',
    optInConsent: true,
    isSuppressed: false,
  },
  {
    id: 'c-lead-7',
    name: 'Nikhil Gaur',
    phoneNumber: '+917982856812',
    tag: 'Job Inquiry',
    service: 'Job Inquiry',
    source: 'WhatsApp',
    status: 'New',
    assignedRep: 'sahil',
    enquiredTime: '2:13 PM',
    createdAt: 'Nov 4, 2026',
    optInConsent: true,
    isSuppressed: false,
  },
];

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
