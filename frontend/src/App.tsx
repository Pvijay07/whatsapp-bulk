import React, { useState } from 'react';
import {
  initialContacts,
  initialNumbers,
  initialWhatsAppAccounts,
  initialTemplates,
  initialCampaigns,
  initialMessages,
  initialWallet,
} from './store';
import { Contact, VirtualNumber, Campaign, MessageLog, WalletData, MessageTemplate } from './types';
import { Navbar } from './components/Navbar';
import { ContactsView } from './components/ContactsView';
import { WhatsAppModal } from './components/WhatsAppModal';
import { DeliveryReportsView } from './components/DeliveryReportsView';
import { VirtualNumbersView } from './components/VirtualNumbersView';
import { WalletView } from './components/WalletView';
import { MessageSquare, CheckCircle2, ShieldCheck, Send } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'crm' | 'campaigns' | 'reports' | 'numbers' | 'wallet'>('crm');

  // Application state
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [virtualNumbers, setVirtualNumbers] = useState<VirtualNumber[]>(initialNumbers);
  const [whatsAppAccounts, setWhatsAppAccounts] = useState(initialWhatsAppAccounts);
  const [templates, setTemplates] = useState<MessageTemplate[]>(initialTemplates);
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [messages, setMessages] = useState<MessageLog[]>(initialMessages);
  const [wallet, setWallet] = useState<WalletData>(initialWallet);

  // WhatsApp Campaign Modal State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [targetContactForModal, setTargetContactForModal] = useState<Contact | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Triggered when client clicks on WhatsApp in CRM
  const handleOpenWhatsApp = (contact?: Contact | null) => {
    setTargetContactForModal(contact || null);
    setIsWhatsAppModalOpen(true);
  };

  // 2. Triggered when client confirms "Send with Virtual Number"
  const handleSendCampaign = (data: {
    campaignName: string;
    senderNumber: string;
    template: MessageTemplate;
    recipients: Contact[];
    totalCostINR: number;
  }) => {
    const newCampId = `camp-${Date.now()}`;
    const newCampaign: Campaign = {
      id: newCampId,
      name: data.campaignName,
      senderNumber: data.senderNumber,
      templateName: data.template.name,
      status: 'SENDING',
      totalContacts: data.recipients.length,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      reservedINR: data.totalCostINR.toFixed(2),
      actualCostINR: data.totalCostINR.toFixed(2),
      createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };

    // Create queued message records
    const newMsgLogs: MessageLog[] = data.recipients.map((rec, idx) => ({
      id: `msg-${Date.now()}-${idx}`,
      campaignId: newCampId,
      contactName: rec.name,
      phoneNumber: rec.phoneNumber,
      status: 'QUEUED',
      providerMessageId: `wamid.HBgL${rec.phoneNumber.replace('+', '')}FQIAEhgU${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      costINR: '1.00',
    }));

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

    showToast(`Campaign launched! Dispatched ${data.recipients.length} messages via ${data.senderNumber}`);

    // Switch view to delivery reports so client immediately sees live reports!
    setCurrentTab('reports');

    // Simulate realistic asynchronous delivery webhook events
    // Phase 1: Dispatched to Meta (Sent) in 500ms
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.campaignId === newCampId ? { ...m, status: 'SENT', sentAt: 'Just now' } : m,
        ),
      );
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === newCampId ? { ...c, sentCount: data.recipients.length } : c,
        ),
      );
    }, 500);

    // Phase 2: Delivered in 1.4s
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.campaignId === newCampId ? { ...m, status: 'DELIVERED', deliveredAt: 'Just now' } : m,
        ),
      );
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === newCampId ? { ...c, deliveredCount: data.recipients.length } : c,
        ),
      );
    }, 1400);

    // Phase 3: Read receipts in 2.8s
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m, i) =>
          m.campaignId === newCampId && i % 4 !== 0
            ? { ...m, status: 'READ', readAt: 'Just now' }
            : m,
        ),
      );
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === newCampId
            ? {
                ...c,
                status: 'COMPLETED',
                readCount: Math.ceil(data.recipients.length * 0.75),
              }
            : c,
        ),
      );
    }, 2800);
  };

  // Add Contact
  const handleAddContact = (contactData: Omit<Contact, 'id' | 'createdAt'>) => {
    const newContact: Contact = {
      id: `c-${Date.now()}`,
      ...contactData,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setContacts((prev) => [newContact, ...prev]);
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
    setVirtualNumbers((prev) => [num, ...prev]);
    showToast(`Number ${num.phoneNumber} provisioned via ${num.provider}!`);
  };

  // Recharge wallet
  const handleTopUp = (amountINR: number) => {
    const newBalance = (parseFloat(wallet.balanceINR) + amountINR).toFixed(2);
    setWallet((prev) => ({
      ...prev,
      balanceINR: newBalance,
      availableINR: newBalance,
      transactions: [
        {
          id: `tx-${Date.now()}`,
          transactionType: 'CREDIT',
          amountINR: `+${amountINR.toFixed(2)}`,
          balanceAfterINR: newBalance,
          idempotencyKey: `topup_pg_${Date.now()}`,
          reason: `Wallet Recharge via Cashfree UPI (₹${amountINR})`,
          createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.transactions,
      ],
    }));
    showToast(`Wallet credited with ₹${amountINR.toLocaleString('en-IN')}!`);
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
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'crm' && (
          <ContactsView
            contacts={contacts}
            onOpenWhatsApp={handleOpenWhatsApp}
            onAddContact={handleAddContact}
            onImportCsv={handleImportCsv}
          />
        )}

        {currentTab === 'campaigns' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-6 h-6 text-[#128C7E]" />
                  Campaign History & Senders
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Manage your active WhatsApp templates and campaign runs.
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
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
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
                      View Report →
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

        {currentTab === 'wallet' && (
          <WalletView
            wallet={wallet}
            onTopUp={handleTopUp}
          />
        )}
      </main>

      {/* The Central WhatsApp Campaign Creation & Dispatch Modal */}
      <WhatsAppModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        selectedContact={targetContactForModal}
        allContacts={contacts}
        virtualNumbers={virtualNumbers}
        whatsAppAccounts={whatsAppAccounts}
        templates={templates}
        walletAvailableINR={wallet.availableINR}
        onSendCampaign={handleSendCampaign}
      />
    </div>
  );
};
export default App;
