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
  initialAutoResponders,
  initialWarmupLogs,
} from './store';
import { Contact, VirtualNumber, Campaign, MessageLog, WalletData, MessageTemplate, AutoResponderRule, WarmupLogEntry } from './types';
import { Navbar } from './components/Navbar';
import { ContactsView } from './components/ContactsView';
import { WhatsAppModal } from './components/WhatsAppModal';
import { DeliveryReportsView } from './components/DeliveryReportsView';
import { VirtualNumbersView } from './components/VirtualNumbersView';
import { WalletView } from './components/WalletView';
import { AutoResponderView } from './components/AutoResponderView';
import { MessageSquare, CheckCircle2, Send } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'crm' | 'campaigns' | 'reports' | 'numbers' | 'autoresponder' | 'wallet'>('crm');

  // Dynamic application state (v2 - Clean live storage, zero mock data)
  const [contacts, setContacts] = useState<Contact[]>(() =>
    loadFromStorage('wa_saas_contacts_v2', initialContacts),
  );
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
  const [autoResponders, setAutoResponders] = useState<AutoResponderRule[]>(() =>
    loadFromStorage('wa_saas_autoresp_v2', initialAutoResponders),
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
    saveToStorage('wa_saas_autoresp_v2', autoResponders);
  }, [autoResponders]);

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
  // TRANSMITS  MESSAGES OVER LIVE BAILEYS WEBSOCKET (ZERO SIMULATION)
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
    const newCampId = `camp-${Date.now()}`;
    const newCampaign: Campaign = {
      id: newCampId,
      name: data.campaignName,
      dispatchType: data.dispatchType,
      senderNumber: data.senderNumber,
      senderPoolCount: data.senderPoolCount || 1,
      customMessageText: data.customMessageText,
      status: 'SENDING',
      totalContacts: data.recipients.length,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      delayIntervalSec: data.delayIntervalSec,
      spintaxEnabled: data.spintaxEnabled,
      reservedINR: data.totalCostINR.toFixed(2),
      actualCostINR: data.totalCostINR.toFixed(2),
      createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };

    setCampaigns((prev) => [newCampaign, ...prev]);

    // Initial message records in QUEUED state
    const initialLogs: MessageLog[] = data.recipients.map((rec, idx) => ({
      id: `msg-${Date.now()}-${idx}`,
      campaignId: newCampId,
      contactName: rec.name,
      phoneNumber: rec.phoneNumber,
      status: 'QUEUED',
      providerMessageId: 'Pending WebSocket dispatch...',
      costINR: '1.00',
    }));

    setMessages((prev) => [...initialLogs, ...prev]);
    showToast(`Dispatching campaign: ${data.recipients.length} real messages queued.`);
    setCurrentTab('reports');

    let sentCount = 0;
    let failedCount = 0;

    // Send each message individually across real WebSocket with humanized delay
    for (let i = 0; i < data.recipients.length; i++) {
      const rec = data.recipients[i];
      const logId = initialLogs[i].id;

      // Spintax & parameter resolution
      let text = data.customMessageText.replace(/\{\{1\}\}/g, rec.name || 'Customer');
      if (data.spintaxEnabled) {
        text = text.replace(/\{([^{}]+)\}/g, (_, choices) => {
          const arr = choices.split('|');
          return arr[Math.floor(Math.random() * arr.length)];
        });
      }

      // Delay between dispatches (anti-ban spacing)
      if (i > 0 && data.delayIntervalSec > 0) {
        await new Promise((r) => setTimeout(r, data.delayIntervalSec * 1000));
      }

      // REAL TRANSMISSION TO WHATSAPP NOISE PROTOCOL
      const res = await dynamicStore.sendRealMessage(rec.phoneNumber, text, data.buttons, data.media);
      const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (res.success) {
        sentCount++;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === logId
              ? {
                  ...m,
                  status: 'SENT',
                  providerMessageId: res.messageId,
                  sentAt: now,
                }
              : m,
          ),
        );
      } else {
        failedCount++;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === logId
              ? {
                  ...m,
                  status: 'FAILED',
                  errorCode: 'SESSION_OFFLINE',
                  providerMessageId: res.error || 'Device not linked',
                }
              : m,
          ),
        );
      }

      // Live update campaign counters
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === newCampId
            ? {
                ...c,
                sentCount,
                deliveredCount: sentCount,
                failedCount,
                status: i === data.recipients.length - 1 ? 'COMPLETED' : 'SENDING',
              }
            : c,
        ),
      );
    }

    // Deduct actual successful sends from prepaid balance
    const actualCost = sentCount * 1.0;
    if (actualCost > 0) {
      const newBal = (parseFloat(wallet.balanceINR) - actualCost).toFixed(2);
      setWallet((prev) => ({
        ...prev,
        balanceINR: newBal,
        availableINR: newBal,
        transactions: [
          {
            id: `tx-${Date.now()}`,
            transactionType: 'DEBIT',
            amountINR: `-${actualCost.toFixed(2)}`,
            balanceAfterINR: newBal,
            referenceId: newCampId,
            idempotencyKey: `settle_${newCampId}_${Date.now()}`,
            reason: `Campaign: ${data.campaignName} (${sentCount} delivered msgs @ ₹1.00)`,
            createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          },
          ...prev.transactions,
        ],
      }));
    }
  };

  // Add Contact
  const handleAddContact = async (contactData: Omit<Contact, 'id' | 'createdAt'>) => {
    const created = await dynamicStore.createContact(contactData);
    setContacts((prev) => [created, ...prev]);
    showToast(`Contact "${contactData.name}" added to CRM!`);
  };

  // CSV Import
  const handleImportCsv = (csvContent: string) => {
    const lines = csvContent.trim().split('\n');
    let importedCount = 0;
    const newEntries: Contact[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 2) {
        newEntries.push({
          id: `c-${Date.now()}-${i}`,
          name: parts[0].trim(),
          phoneNumber: parts[1].trim(),
          tag: parts[2]?.trim() || 'CSV Import',
          optInConsent: true,
          isSuppressed: false,
          createdAt: new Date().toISOString().split('T')[0],
        });
        importedCount++;
      }
    }

    setContacts((prev) => [...newEntries, ...prev]);
    showToast(`Successfully imported ${importedCount} contacts!`);
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

  // Group Grabber
  const handleGroupGrabberExtract = (extracted: Array<{ name: string; phoneNumber: string; tag: string }>) => {
    const newEntries: Contact[] = extracted.map((item, idx) => ({
      id: `c-grab-${Date.now()}-${idx}`,
      name: item.name,
      phoneNumber: item.phoneNumber,
      tag: item.tag,
      optInConsent: true,
      isSuppressed: false,
      createdAt: new Date().toISOString().split('T')[0],
    }));
    setContacts((prev) => [...newEntries, ...prev]);
    showToast(`Group Grabber: Extracted ${extracted.length} WhatsApp numbers to CRM!`);
  };

  // Auto-responder rules
  const handleToggleRule = (id: string) => {
    setAutoResponders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)),
    );
  };

  const handleAddRule = (rule: Omit<AutoResponderRule, 'id' | 'triggerCount'>) => {
    const newRule: AutoResponderRule = {
      id: `ar-${Date.now()}`,
      ...rule,
      triggerCount: 0,
    };
    setAutoResponders((prev) => [newRule, ...prev]);
    showToast(`Auto-reply rule for keyword "${rule.keyword}" activated!`);
  };

  const handleDeleteRule = (id: string) => {
    setAutoResponders((prev) => prev.filter((r) => r.id !== id));
    showToast('Auto-reply rule removed.');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        walletBalanceINR={wallet.availableINR}
        activeCampaignsCount={campaigns.filter((c) => c.status === 'SENDING').length}
        onOpenQuickCampaign={() => handleOpenWhatsApp(null)}
        isLiveSyncing={isLiveSyncing}
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
          />
        )}

        {currentTab === 'campaigns' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-6 h-6 text-[#128C7E]" />
                  Campaign History & Live Senders
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Manage active WhatsApp dispatches across your verified Indian virtual channels.
                </p>
              </div>
              <button
                onClick={() => handleOpenWhatsApp(null)}
                className="px-4 py-2 bg-[#25D366] hover:bg-[#1da851] text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                New Campaign
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center space-y-3">
                <Send className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">No Campaigns Dispatched Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click 'New Campaign' or select a contact in CRM to dispatch your first bulk WhatsApp campaign.
                </p>
                <button
                  onClick={() => handleOpenWhatsApp(null)}
                  className="px-4 py-2 bg-[#128C7E] hover:bg-[#075E54] text-white text-xs font-bold rounded-xl shadow-xs"
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
                        className="text-[#128C7E] font-bold hover:underline"
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

        {currentTab === 'autoresponder' && (
          <AutoResponderView
            rules={autoResponders}
            onToggleRule={handleToggleRule}
            onAddRule={handleAddRule}
            onDeleteRule={handleDeleteRule}
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
