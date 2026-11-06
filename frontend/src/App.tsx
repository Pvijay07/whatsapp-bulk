import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  dynamicStore,
  loadFromStorage,
  saveToStorage,
} from './api';
import {
  initialNumbers,
  initialWhatsAppAccounts,
  initialTemplates,
  initialCampaigns,
  initialMessages,
  initialWallet,
  initialContacts,
  initialWarmupLogs,
} from './store';
import { Contact, VirtualNumber, Campaign, MessageLog, WalletData, MessageTemplate, WarmupLogEntry } from './types';
import { Navbar, BeforeTabId } from './components/Navbar';
import { ContactsView } from './components/ContactsView';
import { WhatsAppModal } from './components/WhatsAppModal';
import { DeliveryReportsView } from './components/DeliveryReportsView';
import { VirtualNumbersView } from './components/VirtualNumbersView';
import { WalletView } from './components/WalletView';
import {
  MessageSquare,
  CheckCircle2,
  Send,
  Plus,
} from 'lucide-react';

export const getCleanPhoneKey = (phone: string): string => {
  let clean = phone.replace(/[^\d]/g, '');
  if (clean.length === 10) clean = `91${clean}`;
  return clean;
};

export const deduplicateContacts = (list: Contact[]): Contact[] => {
  const seen = new Set<string>();
  const unique: Contact[] = [];
  for (const c of list) {
    const key = getCleanPhoneKey(c.phoneNumber);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  return unique;
};

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<BeforeTabId>('crm');

  // Dynamic application state (v2 - Clean live storage, zero mock data, auto de-duplicated)
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const loaded = loadFromStorage('wa_saas_contacts_v2', initialContacts);
    const deduped = deduplicateContacts(loaded);
    if (deduped.length !== loaded.length) {
      saveToStorage('wa_saas_contacts_v2', deduped);
    }
    return deduped;
  });
  const [virtualNumbers, setVirtualNumbers] = useState<VirtualNumber[]>(() =>
    loadFromStorage('wa_saas_numbers_v3', []),
  );
  const [templates, setTemplates] = useState<MessageTemplate[]>(() =>
    loadFromStorage('wa_saas_templates_v2', initialTemplates),
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>(() =>
    loadFromStorage('wa_saas_campaigns_v2', initialCampaigns),
  );
  const [messages, setMessages] = useState<MessageLog[]>(() =>
    loadFromStorage('wa_saas_messages_v2', initialMessages),
  );
  const [wallet, setWallet] = useState<WalletData>(() =>
    loadFromStorage('wa_saas_wallet_v2', initialWallet),
  );
  const [warmupLogs, setWarmupLogs] = useState<WarmupLogEntry[]>(() =>
    loadFromStorage('wa_saas_warmup_logs_v2', initialWarmupLogs),
  );

  const [isLiveSyncing, setIsLiveSyncing] = useState(false);

  // WhatsApp Campaign Modal State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [targetContactForModal, setTargetContactForModal] = useState<Contact | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync state to local storage whenever it changes
  useEffect(() => {
    saveToStorage('wa_saas_contacts_v2', contacts);
  }, [contacts]);

  useEffect(() => {
    saveToStorage('wa_saas_numbers_v3', virtualNumbers);
  }, [virtualNumbers]);

  useEffect(() => {
    saveToStorage('wa_saas_campaigns_v2', campaigns);
  }, [campaigns]);

  useEffect(() => {
    saveToStorage('wa_saas_messages_v2', messages);
  }, [messages]);

  useEffect(() => {
    saveToStorage('wa_saas_wallet_v2', wallet);
  }, [wallet]);

  useEffect(() => {
    saveToStorage('wa_saas_warmup_logs_v2', warmupLogs);
  }, [warmupLogs]);

  // Live WhatsApp Session continuous synchronization (polls every 3s)
  useEffect(() => {
    const syncSession = async () => {
      try {
        const res = await axios.get('/api/v1/session/status', { timeout: 3000 });
        if (res.data?.connectedNumber) {
          const rawNum = res.data.connectedNumber;
          let clean = rawNum.replace(/[^\d]/g, '');
          if (clean.length === 10) clean = `91${clean}`;
          const formatted = `+${clean}`;

          setVirtualNumbers((prev) => {
            const isOnline = !!res.data?.isOnline;
            const existing = prev.find((n) => n.id === 'real-linked-session');
            const targetStatus = isOnline ? 'ACTIVE' : 'RECONNECTING';
            const targetSessionStatus = isOnline ? 'CONNECTED' : 'CONNECTING';
            const targetProvider = isOnline ? '🟢 Connected WhatsApp Phone' : '🟡 WhatsApp (Connecting...)';

            if (
              existing &&
              existing.phoneNumber === formatted &&
              existing.status === targetStatus &&
              existing.provider === targetProvider
            ) {
              return prev;
            }

            const filtered = prev.filter(
              (n) => n.id !== 'real-linked-session' && n.phoneNumber.replace(/[^\d]/g, '') !== clean,
            );
            return [
              {
                id: 'real-linked-session',
                phoneNumber: formatted,
                provider: targetProvider,
                type: 'MOBILE',
                status: targetStatus as any,
                sessionStatus: targetSessionStatus as any,
                dailyLimit: 2000,
                dailySentCount: 0,
                healthScore: isOnline ? 100 : 85,
                warmupStage: 'WARMED_READY',
                proxyDisplay: 'Direct Handset WebSocket Gateway',
                monthlyRentalINR: '0.00',
                capabilities: { voice: true, sms: true, virtualMessaging: true },
                region: 'Active Verified Session',
              },
              ...filtered,
            ];
          });
        } else if (res.data?.state === 'DISCONNECTED' && !res.data?.isRegistered) {
          // If explicitly unlinked, remove the real-linked-session
          setVirtualNumbers((prev) => prev.filter((n) => n.id !== 'real-linked-session'));
        }

        // Live delivery receipts sync (SENT -> DELIVERED -> READ -> FAILED)
        const receipts = await dynamicStore.getMessageReceipts();
        if (receipts && receipts.length > 0) {
          const rMap = new Map(receipts.map((r) => [r.messageId, r]));
          setMessages((prev) => {
            let changed = false;
            const updated = prev.map((m) => {
              const r = rMap.get(m.providerMessageId);
              if (r && r.status && m.status !== r.status && m.status !== 'FAILED') {
                changed = true;
                const timeStr = new Date(r.timestamp).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                return {
                  ...m,
                  status: r.status,
                  deliveredAt:
                    r.status === 'DELIVERED' || r.status === 'READ'
                      ? m.deliveredAt || timeStr
                      : m.deliveredAt,
                  readAt: r.status === 'READ' ? m.readAt || timeStr : m.readAt,
                };
              }
              return m;
            });
            return changed ? updated : prev;
          });
        }

        // Sync server-side queued campaigns & live background worker progress
        const serverCampaigns = await dynamicStore.getQueuedCampaigns();
        if (serverCampaigns && serverCampaigns.length > 0) {
          setCampaigns((prev) => {
            const serverMap = new Map(serverCampaigns.map((sc: any) => [sc.id, sc]));
            const merged = prev.map((localCamp) => {
              if (serverMap.has(localCamp.id)) {
                const sc = serverMap.get(localCamp.id)!;
                return {
                  ...localCamp,
                  status: sc.status,
                  sentCount: sc.sentCount,
                  deliveredCount: sc.deliveredCount,
                  readCount: sc.readCount,
                  failedCount: sc.failedCount,
                  totalContacts: sc.totalContacts,
                  actualCostINR: sc.actualCostINR,
                };
              }
              return localCamp;
            });

            for (const sc of serverCampaigns) {
              if (!prev.some((p) => p.id === sc.id)) {
                merged.unshift({
                  id: sc.id,
                  name: sc.name,
                  dispatchType: sc.dispatchType,
                  senderNumber: sc.senderNumber,
                  senderPoolCount: sc.senderPoolCount || 1,
                  customMessageText: sc.customMessageText,
                  status: sc.status,
                  totalContacts: sc.totalContacts,
                  sentCount: sc.sentCount,
                  deliveredCount: sc.deliveredCount,
                  readCount: sc.readCount,
                  failedCount: sc.failedCount,
                  delayIntervalSec: sc.delayIntervalSec,
                  spintaxEnabled: sc.spintaxEnabled,
                  reservedINR: sc.reservedINR,
                  actualCostINR: sc.actualCostINR,
                  createdAt: sc.createdAt,
                });
              }
            }
            return merged;
          });

          // Sync messages from active server campaign
          const activeCamp =
            serverCampaigns.find((c: any) => c.status === 'SENDING' || c.status === 'PAUSED') ||
            serverCampaigns[0];
          if (activeCamp && activeCamp.messages && activeCamp.messages.length > 0) {
            const sMsgs: MessageLog[] = activeCamp.messages.map((m: any) => ({
              id: m.id,
              campaignId: activeCamp.id,
              contactName: m.recipientName,
              phoneNumber: m.recipientPhoneNumber,
              status: m.status,
              providerMessageId:
                m.providerMessageId || (m.status === 'QUEUED' ? 'Queued on Server Worker' : ''),
              sentAt: m.sentAt,
              errorCode: m.errorCode,
              costINR: m.costINR || '1.00',
            }));

            setMessages((prev) => {
              const existingIds = new Set(sMsgs.map((sm) => sm.id));
              const filtered = prev.filter((p) => !existingIds.has(p.id));
              return [...sMsgs, ...filtered];
            });
          }
        }
      } catch (e) {}
    };

    syncSession();
    const interval = setInterval(syncSession, 3000);
    return () => clearInterval(interval);
  }, []);

  // 1. Triggered when client clicks on WhatsApp in CRM
  const handleOpenWhatsApp = (contact?: Contact | null) => {
    setTargetContactForModal(contact || null);
    setIsWhatsAppModalOpen(true);
  };

  // 2. Triggered when client confirms "Send with Virtual Number"
  // ENQUEUES BULK CAMPAIGN TO SERVER-SIDE BACKGROUND WORKER (HANDLES N MESSAGES SAFELY)
  const handleSendCampaign = async (data: {
    campaignName: string;
    dispatchType: 'MULTI_NUMBER_POOL' | 'DEDICATED_NUMBER';
    senderNumber: string;
    senderPoolCount?: number;
    customMessageText: string;
    buttons?: any[];
    media?: {
      base64?: string;
      url?: string;
      mimeType: string;
      fileName: string;
      fileSize?: number;
    } | null;
    recipients: Contact[];
    delayIntervalSec: number;
    spintaxEnabled: boolean;
    totalCostINR: number;
  }) => {
    showToast(`Enqueuing ${data.recipients.length} messages to Server Background Queue...`);

    const res = await dynamicStore.enqueueCampaign({
      campaignName: data.campaignName,
      dispatchType: data.dispatchType,
      senderNumber: data.senderNumber,
      senderPoolCount: data.senderPoolCount,
      customMessageText: data.customMessageText,
      buttons: data.buttons,
      media: data.media,
      recipients: data.recipients.map((r) => ({ phoneNumber: r.phoneNumber, name: r.name })),
      delayIntervalSec: data.delayIntervalSec,
      spintaxEnabled: data.spintaxEnabled,
      totalCostINR: data.totalCostINR,
    });

    if (!res.success) {
      showToast(`❌ Error: ${res.error || 'Failed to enqueue campaign'}`);
      return;
    }

    showToast(`🚀 Campaign enqueued on server! Safely running in background (safe to close browser).`);
    setCurrentTab('reports');

    // Deduct estimated cost from wallet
    const estimatedCost = data.recipients.length * 1.0;
    const newBal = Math.max(0, parseFloat(wallet.balanceINR) - estimatedCost).toFixed(2);
    setWallet((prev) => ({
      ...prev,
      balanceINR: newBal,
      availableINR: newBal,
      transactions: [
        {
          id: `tx-${Date.now()}`,
          transactionType: 'DEBIT',
          amountINR: `-${estimatedCost.toFixed(2)}`,
          balanceAfterINR: newBal,
          referenceId: res.campaignId,
          idempotencyKey: `enqueue_${res.campaignId}_${Date.now()}`,
          reason: `Campaign: ${data.campaignName} (${data.recipients.length} msgs queued @ ₹1.00)`,
          createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.transactions,
      ],
    }));

    // Trigger immediate sync from server
    const serverCampaigns = await dynamicStore.getQueuedCampaigns();
    if (serverCampaigns && serverCampaigns.length > 0) {
      setCampaigns(serverCampaigns);
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    const ok = await dynamicStore.pauseQueuedCampaign(campaignId);
    if (ok) {
      showToast('Campaign queue paused on server.');
      setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: 'PAUSED' } : c)));
    } else {
      showToast('Failed to pause campaign.');
    }
  };

  const handleResumeCampaign = async (campaignId: string) => {
    const ok = await dynamicStore.resumeQueuedCampaign(campaignId);
    if (ok) {
      showToast('Campaign queue resumed on server!');
      setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: 'SENDING' } : c)));
    } else {
      showToast('Failed to resume campaign.');
    }
  };

  const handleCancelCampaign = async (campaignId: string) => {
    const ok = await dynamicStore.cancelQueuedCampaign(campaignId);
    if (ok) {
      showToast('Campaign queue cancelled on server.');
      setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: 'CANCELLED' } : c)));
    } else {
      showToast('Failed to cancel campaign.');
    }
  };

  // Add Contact with de-duplication
  const handleAddContact = async (
    contactData: Omit<Contact, 'id' | 'createdAt'> & {
      service?: string;
      source?: string;
      status?: string;
      assignedRep?: string;
      enquiredTime?: string;
    },
  ) => {
    const newKey = getCleanPhoneKey(contactData.phoneNumber);
    const existing = contacts.find((c) => getCleanPhoneKey(c.phoneNumber) === newKey);
    if (existing) {
      showToast(`Contact with phone ${contactData.phoneNumber} already exists in CRM (${existing.name})!`);
      return;
    }
    const created = await dynamicStore.createContact(contactData);
    const enriched: Contact = {
      ...created,
      service: contactData.service || contactData.tag || 'General Enquiry',
      source: contactData.source || 'WhatsApp',
      status: contactData.status || 'New',
      assignedRep: contactData.assignedRep || 'ABHI',
      enquiredTime: contactData.enquiredTime || '5:10 PM',
    };
    const updated = deduplicateContacts([enriched, ...contacts]);
    setContacts(updated);
    saveToStorage('wa_saas_contacts_v2', updated);
    showToast(`Lead "${contactData.name}" added to directory!`);
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveToStorage('wa_saas_contacts_v2', updated);
      return updated;
    });
    showToast('Lead deleted from directory');
  };

  const handleUpdateContact = (updatedContact: Contact) => {
    setContacts((prev) => {
      const updated = prev.map((c) => (c.id === updatedContact.id ? updatedContact : c));
      saveToStorage('wa_saas_contacts_v2', updated);
      return updated;
    });
    showToast(`Lead "${updatedContact.name}" updated successfully!`);
  };

  // CSV Import with header auto-detection, phone normalization, strict de-duplication, and persistent saving
  const handleImportCsv = (csvContent: string) => {
    const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      showToast('No valid rows found in CSV.');
      return;
    }

    const headerParts = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
    let nameIdx = headerParts.findIndex((h) => h.includes('name'));
    let phoneIdx = headerParts.findIndex(
      (h) => h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('num'),
    );
    let tagIdx = headerParts.findIndex(
      (h) => h.includes('tag') || h.includes('group') || h.includes('category') || h.includes('label'),
    );

    let startIndex = 1;
    if (nameIdx === -1 && phoneIdx === -1) {
      nameIdx = 0;
      phoneIdx = 1;
      tagIdx = 2;
      startIndex = 0;
    } else {
      if (nameIdx === -1) nameIdx = 0;
      if (phoneIdx === -1) phoneIdx = 1;
      if (tagIdx === -1) tagIdx = 2;
    }

    const existingKeys = new Set(contacts.map((c) => getCleanPhoneKey(c.phoneNumber)));
    const newEntries: Contact[] = [];
    let duplicateCount = 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) continue;

      const rawName = parts[nameIdx] || parts[0] || 'Customer';
      const rawPhone = parts[phoneIdx] || parts[1] || '';
      const rawTag = parts[tagIdx] || parts[2] || 'CSV Import';

      const digits = rawPhone.replace(/[^\d+]/g, '');
      if (digits.replace(/[^\d]/g, '').length < 7) continue;

      let normalizedPhone = digits;
      if (!digits.startsWith('+')) {
        const clean = digits.replace(/[^\d]/g, '');
        if (clean.length === 10) normalizedPhone = `+91${clean}`;
        else if (clean.length === 12 && clean.startsWith('91')) normalizedPhone = `+${clean}`;
        else normalizedPhone = `+${clean}`;
      }

      const phoneKey = getCleanPhoneKey(normalizedPhone);
      if (existingKeys.has(phoneKey)) {
        duplicateCount++;
        continue; // Skip duplicate
      }

      existingKeys.add(phoneKey);
      newEntries.push({
        id: `c-${Date.now()}-${i}`,
        name: rawName,
        phoneNumber: normalizedPhone,
        tag: rawTag,
        optInConsent: true,
        isSuppressed: false,
        createdAt: new Date().toLocaleDateString('en-IN'),
      });
    }

    if (newEntries.length === 0) {
      if (duplicateCount > 0) {
        showToast(`All ${duplicateCount} contacts in CSV already exist in CRM (duplicates skipped).`);
      } else {
        showToast('No valid contacts with phone numbers found.');
      }
      return;
    }

    const updated = deduplicateContacts([...newEntries, ...contacts]);
    setContacts(updated);
    saveToStorage('wa_saas_contacts_v2', updated);

    if (duplicateCount > 0) {
      showToast(`Imported ${newEntries.length} new contacts (${duplicateCount} existing duplicates skipped).`);
    } else {
      showToast(`Successfully imported & saved ${newEntries.length} contacts!`);
    }
  };

  // Provision virtual number
  const handlePurchaseNumber = (num: VirtualNumber) => {
    const rentalCost = parseFloat(num.monthlyRentalINR) || 599.00;
    const newBal = (parseFloat(wallet.balanceINR) - rentalCost).toFixed(2);

    setVirtualNumbers((prev) => [num, ...prev]);
    setWallet((prev) => ({
      ...prev,
      balanceINR: newBal,
      availableINR: newBal,
      transactions: [
        {
          id: `tx-num-${Date.now()}`,
          transactionType: 'DEBIT',
          amountINR: `-${rentalCost.toFixed(2)}`,
          balanceAfterINR: newBal,
          idempotencyKey: `num_rent_${num.id}_${Date.now()}`,
          reason: `Virtual Number Monthly Rental: ${num.phoneNumber} (${num.provider})`,
          createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.transactions,
      ],
    }));

    showToast(`Number ${num.phoneNumber} provisioned via ${num.provider}!`);
  };

  // 1-Click Automated Virtual Number Provisioning Handler
  const handleAutoProvisionNumber = (res: {
    phoneNumber: string;
    orderId: string;
    otpCode?: string;
    costINR: number;
    proxyDisplay?: string;
  }) => {
    const newNum: VirtualNumber = {
      id: `num-${Date.now()}`,
      phoneNumber: res.phoneNumber,
      provider: 'SMS OTP Verified Channel',
      type: 'MOBILE',
      status: 'ACTIVE',
      sessionStatus: 'CONNECTED',
      dailyLimit: 500,
      dailySentCount: 0,
      healthScore: 100,
      warmupStage: 'WARMING',
      proxyDisplay: res.proxyDisplay || 'Airtel 4G Mobile Gateway (India)',
      monthlyRentalINR: '0.00',
      capabilities: { voice: false, sms: true, virtualMessaging: true },
      region: 'India Cellular Pool',
    };

    setVirtualNumbers((prev) => [newNum, ...prev]);

    // Deduct acquisition fee from prepaid wallet
    const newBal = (parseFloat(wallet.balanceINR) - res.costINR).toFixed(2);
    setWallet((prev) => ({
      ...prev,
      balanceINR: newBal,
      availableINR: newBal,
      transactions: [
        {
          id: `tx-prov-${Date.now()}`,
          transactionType: 'DEBIT',
          amountINR: `-${res.costINR.toFixed(2)}`,
          balanceAfterINR: newBal,
          idempotencyKey: `auto_prov_${res.orderId}_${Date.now()}`,
          reason: `Virtual Number Provisioning: ${res.phoneNumber} (Order ${res.orderId})`,
          createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.transactions,
      ],
    }));

    showToast(`Provisioned ${res.phoneNumber}! Joined active pool.`);
  };

  // Automated Account Warmer trigger
  const handleTriggerWarmup = async () => {
    const res = await dynamicStore.triggerWarmupRound();
    if (res.entry) {
      setWarmupLogs((prev) => [res.entry!, ...prev.slice(0, 49)]);
      showToast(`Account Warmer: Executed dialogue exchange between pool numbers!`);
    }
  };

  // Recharge wallet
  const handleTopUp = async (amountINR: number) => {
    const updated = await dynamicStore.topUpWallet(amountINR);
    setWallet(updated);
    showToast(`Wallet credited with ₹${amountINR.toLocaleString('en-IN')}!`);
  };

  // Group Grabber with strict de-duplication
  const handleGroupGrabberExtract = (extracted: Array<{ name: string; phoneNumber: string; tag: string }>) => {
    const existingKeys = new Set(contacts.map((c) => getCleanPhoneKey(c.phoneNumber)));
    const newEntries: Contact[] = [];
    let duplicateCount = 0;

    for (let i = 0; i < extracted.length; i++) {
      const item = extracted[i];
      const phoneKey = getCleanPhoneKey(item.phoneNumber);
      if (existingKeys.has(phoneKey)) {
        duplicateCount++;
        continue;
      }
      existingKeys.add(phoneKey);
      newEntries.push({
        id: `c-grab-${Date.now()}-${i}`,
        name: item.name,
        phoneNumber: item.phoneNumber,
        tag: item.tag,
        optInConsent: true,
        isSuppressed: false,
        createdAt: new Date().toLocaleDateString('en-IN'),
      });
    }

    if (newEntries.length === 0) {
      showToast(`All ${duplicateCount} extracted contacts already exist in CRM.`);
      return;
    }

    const updated = deduplicateContacts([...newEntries, ...contacts]);
    setContacts(updated);
    saveToStorage('wa_saas_contacts_v2', updated);

    if (duplicateCount > 0) {
      showToast(`Extracted ${newEntries.length} new contacts (${duplicateCount} existing duplicates skipped)!`);
    } else {
      showToast(`Group Grabber: Extracted ${newEntries.length} WhatsApp numbers to CRM!`);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans antialiased text-slate-900 selection:bg-teal-100 selection:text-teal-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#0f172a] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar: ONLY the 5 before tabs */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        walletBalanceINR={wallet.availableINR}
        activeCampaignsCount={campaigns.filter((c) => c.status === 'SENDING').length}
        contactsCount={contacts.length}
        onOpenQuickCampaign={() => handleOpenWhatsApp(null)}
        isOnline={virtualNumbers.some((n) => n.id === 'real-linked-session' && n.status === 'ACTIVE')}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'crm' && (
          <ContactsView
            contacts={contacts}
            onOpenWhatsApp={handleOpenWhatsApp}
            onAddContact={handleAddContact}
            onImportCsv={handleImportCsv}
            onGroupGrabberExtract={handleGroupGrabberExtract}
            onDeleteContact={handleDeleteContact}
            onUpdateContact={handleUpdateContact}
          />
        )}

        {currentTab === 'campaigns' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-6 h-6 text-[#00b493]" />
                  Campaign History & Live Senders
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Manage active WhatsApp dispatches across your verified Indian virtual channels.
                </p>
              </div>
              <button
                onClick={() => handleOpenWhatsApp(null)}
                className="px-4 py-2 bg-[#00b493] hover:bg-[#009e81] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                New Campaign
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center space-y-3">
                <Send className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">No Campaigns Dispatched Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click 'New Campaign' or select a contact in Contacts to dispatch your first bulk WhatsApp campaign.
                </p>
                <button
                  onClick={() => handleOpenWhatsApp(null)}
                  className="px-4 py-2 bg-[#00b493] hover:bg-[#009e81] text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Create Campaign
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          camp.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : camp.status === 'SENDING'
                            ? 'bg-blue-100 text-blue-800 animate-pulse'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        ● {camp.status}
                      </span>
                      <span className="text-xs text-slate-400">{camp.createdAt}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{camp.name}</h3>
                    <div className="text-xs text-slate-600">
                      Sender: <span className="font-mono font-semibold">{camp.senderNumber}</span> • Mode:{' '}
                      <span className="font-semibold text-emerald-700">
                        {camp.dispatchType === 'MULTI_NUMBER_POOL' ? 'Virtual Pool' : 'Dedicated'}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Delivered: <strong className="text-emerald-700">{camp.deliveredCount}</strong>/{camp.totalContacts}
                        {camp.failedCount > 0 && <span className="text-rose-600 ml-2">({camp.failedCount} failed)</span>}
                      </span>
                      <button
                        onClick={() => setCurrentTab('reports')}
                        className="text-[#00897b] font-bold hover:underline"
                      >
                        View Live Report →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentTab === 'reports' && (
          <DeliveryReportsView
            campaigns={campaigns}
            messages={messages}
            onPauseCampaign={handlePauseCampaign}
            onResumeCampaign={handleResumeCampaign}
            onCancelCampaign={handleCancelCampaign}
          />
        )}

        {currentTab === 'numbers' && (
          <VirtualNumbersView
            numbers={virtualNumbers}
            onPurchaseNumber={handlePurchaseNumber}
            onAutoProvisionNumber={handleAutoProvisionNumber}
            warmupLogs={warmupLogs}
            onTriggerWarmup={handleTriggerWarmup}
            walletBalanceINR={wallet.availableINR}
          />
        )}

        {currentTab === 'wallet' && (
          <WalletView
            wallet={wallet}
            onTopUp={handleTopUp}
          />
        )}
      </main>

      {/* Central WhatsApp Campaign Creation & Dispatch Modal */}
      <WhatsAppModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        selectedContact={targetContactForModal}
        allContacts={contacts}
        virtualNumbers={virtualNumbers}
        whatsAppAccounts={initialWhatsAppAccounts}
        templates={templates}
        walletAvailableINR={wallet.availableINR}
        onOpenLinkDevice={() => setCurrentTab('numbers')}
        onSendCampaign={handleSendCampaign}
      />
    </div>
  );
};

export default App;
