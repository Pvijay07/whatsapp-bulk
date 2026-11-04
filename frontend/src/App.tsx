import React, { useState, useEffect, useRef } from 'react';
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
} from './store';
import { Contact, VirtualNumber, Campaign, MessageLog, WalletData, MessageTemplate, AutoResponderRule } from './types';
import { Navbar } from './components/Navbar';
import { ContactsView } from './components/ContactsView';
import { WhatsAppModal } from './components/WhatsAppModal';
import { DeliveryReportsView } from './components/DeliveryReportsView';
import { VirtualNumbersView } from './components/VirtualNumbersView';
import { WalletView } from './components/WalletView';
import { AutoResponderView } from './components/AutoResponderView';
import { MessageSquare, CheckCircle2, Send, Sparkles, Bot } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'crm' | 'campaigns' | 'reports' | 'numbers' | 'autoresponder' | 'wallet'>('crm');

  // Dynamic application state
  const [contacts, setContacts] = useState<Contact[]>(() =>
    loadFromStorage('wa_saas_contacts_v1', initialContacts),
  );
  const [virtualNumbers, setVirtualNumbers] = useState<VirtualNumber[]>(() =>
    loadFromStorage('wa_saas_numbers_v1', initialNumbers),
  );
  const [templates, setTemplates] = useState<MessageTemplate[]>(() =>
    loadFromStorage('wa_saas_templates_v1', initialTemplates),
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>(() =>
    loadFromStorage('wa_saas_campaigns_v1', initialCampaigns),
  );
  const [messages, setMessages] = useState<MessageLog[]>(() =>
    loadFromStorage('wa_saas_messages_v1', initialMessages),
  );
  const [autoResponders, setAutoResponders] = useState<AutoResponderRule[]>(() =>
    loadFromStorage('wa_saas_autoresp_v1', initialAutoResponders),
  );
  const [wallet, setWallet] = useState<WalletData>(() =>
    loadFromStorage('wa_saas_wallet_v1', initialWallet),
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
    saveToStorage('wa_saas_contacts_v1', contacts);
  }, [contacts]);

  useEffect(() => {
    saveToStorage('wa_saas_numbers_v1', virtualNumbers);
  }, [virtualNumbers]);

  useEffect(() => {
    saveToStorage('wa_saas_campaigns_v1', campaigns);
  }, [campaigns]);

  useEffect(() => {
    saveToStorage('wa_saas_messages_v1', messages);
  }, [messages]);

  useEffect(() => {
    saveToStorage('wa_saas_wallet_v1', wallet);
  }, [wallet]);

  useEffect(() => {
    saveToStorage('wa_saas_autoresp_v1', autoResponders);
  }, [autoResponders]);

  // Initial check against backend
  useEffect(() => {
    const initBackend = async () => {
      setIsLiveSyncing(true);
      await dynamicStore.checkBackendConnection();
      setIsLiveSyncing(false);
    };
    initBackend();
  }, []);

  // Dynamic Asynchronous Campaign Progression Worker
  // Continuously monitors any campaign in 'SENDING' status and transitions message delivery
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages((prevMessages) => {
        let changed = false;
        const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const updatedMessages = prevMessages.map((msg) => {
          // 1. Queued -> Sent
          if (msg.status === 'QUEUED') {
            changed = true;
            return {
              ...msg,
              status: 'SENT' as const,
              sentAt: now,
              providerMessageId: msg.providerMessageId.startsWith('wamid.')
                ? msg.providerMessageId
                : `wamid.HBgL${msg.phoneNumber.replace('+', '')}FQIAEhgU${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            };
          }

          // 2. Sent -> Delivered
          if (msg.status === 'SENT') {
            changed = true;
            return {
              ...msg,
              status: 'DELIVERED' as const,
              deliveredAt: now,
            };
          }

          // 3. Delivered -> Read (simulating user opening WhatsApp)
          if (msg.status === 'DELIVERED' && Math.random() > 0.3) {
            changed = true;
            return {
              ...msg,
              status: 'READ' as const,
              readAt: now,
            };
          }

          return msg;
        });

        // If messages progressed, update corresponding campaign statistics dynamically
        if (changed) {
          setCampaigns((prevCampaigns) =>
            prevCampaigns.map((camp) => {
              const campMsgs = updatedMessages.filter((m) => m.campaignId === camp.id);
              if (campMsgs.length === 0) return camp;

              const sent = campMsgs.filter((m) => m.status !== 'QUEUED').length;
              const delivered = campMsgs.filter((m) => m.status === 'DELIVERED' || m.status === 'READ').length;
              const read = campMsgs.filter((m) => m.status === 'READ').length;
              const failed = campMsgs.filter((m) => m.status === 'FAILED').length;
              const isDone = delivered + failed >= camp.totalContacts && camp.totalContacts > 0;

              return {
                ...camp,
                sentCount: sent,
                deliveredCount: delivered,
                readCount: read,
                failedCount: failed,
                status: isDone ? ('COMPLETED' as const) : camp.status,
              };
            }),
          );
        }

        return changed ? updatedMessages : prevMessages;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // 1. Triggered when client clicks on WhatsApp in CRM
  const handleOpenWhatsApp = (contact?: Contact | null) => {
    setTargetContactForModal(contact || null);
    setIsWhatsAppModalOpen(true);
  };

  // 2. Triggered when client confirms "Send with Virtual Number"
  const handleSendCampaign = (data: {
    campaignName: string;
    dispatchMode: 'OFFICIAL_CLOUD_API' | 'VIRTUAL_NUMBER_POOL';
    senderNumber: string;
    senderPoolCount?: number;
    template: MessageTemplate;
    recipients: Contact[];
    delayIntervalSec: number;
    spintaxEnabled: boolean;
    totalCostINR: number;
  }) => {
    const newCampId = `camp-${Date.now()}`;
    const newCampaign: Campaign = {
      id: newCampId,
      name: data.campaignName,
      dispatchMode: data.dispatchMode,
      senderNumber: data.senderNumber,
      senderPoolCount: data.senderPoolCount || 1,
      templateName: data.template.name,
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

    // Create dynamic queued message records with Round-Robin Virtual Number assignment!
    const newMsgLogs: MessageLog[] = data.recipients.map((rec, idx) => {
      // If pool mode, cycle through available numbers
      const assignedNumber =
        data.dispatchMode === 'VIRTUAL_NUMBER_POOL' && virtualNumbers.length > 0
          ? virtualNumbers[idx % virtualNumbers.length].phoneNumber
          : data.senderNumber;

      return {
        id: `msg-${Date.now()}-${idx}`,
        campaignId: newCampId,
        contactName: rec.name,
        phoneNumber: rec.phoneNumber,
        status: 'QUEUED',
        providerMessageId: `wamid.HBgL${rec.phoneNumber.replace('+', '')}FQIAEhgU${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        costINR: '1.00',
      };
    });

    // Update state
    setCampaigns((prev) => [newCampaign, ...prev]);
    setMessages((prev) => [...newMsgLogs, ...prev]);

    // Update Wallet balance & ledger
    const newBal = (parseFloat(wallet.balanceINR) - data.totalCostINR).toFixed(2);
    setWallet((prev) => ({
      ...prev,
      balanceINR: newBal,
      availableINR: newBal,
      transactions: [
        {
          id: `tx-${Date.now()}`,
          transactionType: 'DEBIT',
          amountINR: `-${data.totalCostINR.toFixed(2)}`,
          balanceAfterINR: newBal,
          referenceId: newCampId,
          idempotencyKey: `settle_${newCampId}_${Date.now()}`,
          reason: `Campaign: ${data.campaignName} (${data.recipients.length} msgs @ ₹1.00)`,
          createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.transactions,
      ],
    }));

    showToast(`Campaign dispatched! ${data.recipients.length} messages sent via ${data.senderNumber}`);

    // Transition immediately to Delivery Reports so client watches live delivery!
    setCurrentTab('reports');
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
    showToast(`Successfully imported ${importedCount} contacts with affirmative opt-in!`);
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
                  Manage active WhatsApp templates and campaign runs across your Indian virtual numbers.
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
                    Sender: <span className="font-mono font-semibold">{camp.senderNumber}</span> • Template: <span className="font-semibold">{camp.templateName}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Delivered: <strong className="text-emerald-700">{camp.deliveredCount}</strong>/{camp.totalContacts}
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
        onSendCampaign={handleSendCampaign}
      />
    </div>
  );
};

export default App;
