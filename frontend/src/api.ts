import axios from 'axios';
import { Contact, VirtualNumber, WhatsAppAccount, MessageTemplate, Campaign, MessageLog, WalletData } from './types';
import {
  initialContacts,
  initialNumbers,
  initialWhatsAppAccounts,
  initialTemplates,
  initialCampaigns,
  initialMessages,
  initialWallet,
} from './store';

const API_BASE_URL = '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
});

// Attach JWT token from localStorage if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('wa_saas_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Keys for local persistence
const STORAGE_KEYS = {
  CONTACTS: 'wa_saas_contacts_v1',
  NUMBERS: 'wa_saas_numbers_v1',
  TEMPLATES: 'wa_saas_templates_v1',
  CAMPAIGNS: 'wa_saas_campaigns_v1',
  MESSAGES: 'wa_saas_messages_v1',
  WALLET: 'wa_saas_wallet_v1',
  TOKEN: 'wa_saas_token',
};

// Local storage helper
export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

/**
 * Dynamic Data Manager: seamlessly coordinates between live NestJS backend and reactive local persistence
 */
export class DynamicStoreManager {
  private isOnline = false;

  async checkBackendConnection(): Promise<boolean> {
    try {
      const res = await apiClient.get('/wallet', { timeout: 2000 });
      this.isOnline = res.status === 200;
      return true;
    } catch (e) {
      this.isOnline = false;
      return false;
    }
  }

  // Load Contacts
  async getContacts(): Promise<Contact[]> {
    if (this.isOnline) {
      try {
        const res = await apiClient.get('/contacts?limit=100');
        if (res.data?.items) {
          const formatted = res.data.items.map((c: any) => ({
            id: c.id,
            name: c.name || 'Unnamed',
            phoneNumber: c.phoneNumber,
            isSuppressed: c.isSuppressed,
            optInConsent: true,
            tag: c.metadata?.tag || 'General',
            createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : 'Recent',
          }));
          saveToStorage(STORAGE_KEYS.CONTACTS, formatted);
          return formatted;
        }
      } catch (e) {
        console.warn('Backend contacts fetch failed; falling back to persistent storage', e);
      }
    }
    return loadFromStorage<Contact[]>(STORAGE_KEYS.CONTACTS, initialContacts);
  }

  // Save new contact
  async createContact(contact: Omit<Contact, 'id' | 'createdAt'>): Promise<Contact> {
    const newContact: Contact = {
      id: `c-${Date.now()}`,
      ...contact,
      createdAt: new Date().toLocaleDateString('en-IN'),
    };

    if (this.isOnline) {
      try {
        await apiClient.post('/contacts', {
          phoneNumber: contact.phoneNumber,
          name: contact.name,
          optInConsent: contact.optInConsent,
          metadata: { tag: contact.tag },
        });
      } catch (e) {
        console.warn('Backend contact creation failed; saving locally', e);
      }
    }

    const current = loadFromStorage<Contact[]>(STORAGE_KEYS.CONTACTS, initialContacts);
    const updated = [newContact, ...current];
    saveToStorage(STORAGE_KEYS.CONTACTS, updated);
    return newContact;
  }

  // Load Campaigns
  async getCampaigns(): Promise<Campaign[]> {
    if (this.isOnline) {
      try {
        const res = await apiClient.get('/campaigns');
        if (Array.isArray(res.data)) {
          const formatted = res.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            senderNumber: c.senderAccount?.displayNumber || '+918045678901',
            templateName: c.template?.name || 'diwali_special_offer',
            status: c.status,
            totalContacts: c.totalContacts,
            sentCount: c.sentCount,
            deliveredCount: c.deliveredCount,
            readCount: c.readCount,
            failedCount: c.failedCount,
            reservedINR: c.reservedINR || '0.00',
            actualCostINR: c.actualCostINR || '0.00',
            createdAt: new Date(c.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          }));
          saveToStorage(STORAGE_KEYS.CAMPAIGNS, formatted);
          return formatted;
        }
      } catch (e) {
        console.warn('Backend campaigns fetch failed; falling back to local storage', e);
      }
    }
    return loadFromStorage<Campaign[]>(STORAGE_KEYS.CAMPAIGNS, initialCampaigns);
  }

  // Load Messages for campaign
  async getMessages(campaignId?: string): Promise<MessageLog[]> {
    if (this.isOnline && campaignId) {
      try {
        const res = await apiClient.get(`/campaigns/${campaignId}/messages?limit=100`);
        if (res.data?.items) {
          return res.data.items.map((m: any) => ({
            id: m.id,
            campaignId,
            contactName: m.contactName,
            phoneNumber: m.phoneNumber,
            status: m.status,
            providerMessageId: m.providerMessageId || 'Processing...',
            costINR: m.costINR || '1.00',
            sentAt: m.sentAt ? new Date(m.sentAt).toLocaleTimeString('en-IN') : undefined,
            deliveredAt: m.deliveredAt ? new Date(m.deliveredAt).toLocaleTimeString('en-IN') : undefined,
            readAt: m.readAt ? new Date(m.readAt).toLocaleTimeString('en-IN') : undefined,
            errorCode: m.errorCode,
          }));
        }
      } catch (e) {
        console.warn('Backend messages fetch failed', e);
      }
    }
    return loadFromStorage<MessageLog[]>(STORAGE_KEYS.MESSAGES, initialMessages);
  }

  // Load Wallet
  async getWallet(): Promise<WalletData> {
    if (this.isOnline) {
      try {
        const [wRes, txRes] = await Promise.all([
          apiClient.get('/wallet'),
          apiClient.get('/wallet/transactions'),
        ]);

        if (wRes.data) {
          const transactions = (txRes.data || []).map((t: any) => ({
            id: t.id,
            transactionType: t.transactionType,
            amountINR: `${t.transactionType === 'DEBIT' ? '-' : '+'}${t.amountINR}`,
            balanceAfterINR: (Number(t.balanceAfter) / 100).toFixed(2),
            idempotencyKey: t.idempotencyKey,
            reason: t.metadata?.reason || t.metadata?.source || 'Wallet Transaction',
            createdAt: new Date(t.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          }));

          const walletData: WalletData = {
            balanceINR: wRes.data.balanceINR,
            reservedINR: (Number(wRes.data.reservedPaise) / 100).toFixed(2),
            availableINR: wRes.data.availableINR,
            transactions,
          };
          saveToStorage(STORAGE_KEYS.WALLET, walletData);
          return walletData;
        }
      } catch (e) {
        console.warn('Backend wallet fetch failed; falling back to local storage', e);
      }
    }
    return loadFromStorage<WalletData>(STORAGE_KEYS.WALLET, initialWallet);
  }

  // Top up wallet
  async topUpWallet(amountINR: number): Promise<WalletData> {
    if (this.isOnline) {
      try {
        await apiClient.post('/wallet/topup', {
          amountPaise: Math.round(amountINR * 100),
          idempotencyKey: `topup_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        });
        return this.getWallet();
      } catch (e) {
        console.warn('Backend top-up failed; applying local update', e);
      }
    }

    const current = loadFromStorage<WalletData>(STORAGE_KEYS.WALLET, initialWallet);
    const newBal = (parseFloat(current.balanceINR) + amountINR).toFixed(2);
    const updated: WalletData = {
      balanceINR: newBal,
      reservedINR: current.reservedINR,
      availableINR: newBal,
      transactions: [
        {
          id: `tx-${Date.now()}`,
          transactionType: 'CREDIT',
          amountINR: `+${amountINR.toFixed(2)}`,
          balanceAfterINR: newBal,
          idempotencyKey: `topup_local_${Date.now()}`,
          reason: `Instant Recharge (UPI / Cashfree) - ₹${amountINR}`,
          createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        },
        ...current.transactions,
      ],
    };
    saveToStorage(STORAGE_KEYS.WALLET, updated);
    return updated;
  }
}

export const dynamicStore = new DynamicStoreManager();
