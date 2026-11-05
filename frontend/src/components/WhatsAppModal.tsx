import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Contact, VirtualNumber, MessageTemplate, WhatsAppAccount } from '../types';
import {
  Send,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  AlertCircle,
  X,
  PhoneCall,
  Repeat,
  Sliders,
  Clock,
  Shuffle,
  FileText,
  Smartphone,
  ExternalLink,
  CornerDownLeft,
  Plus,
  Trash2,
  Key,
} from 'lucide-react';

export interface CampaignActionButton {
  id: string;
  type: 'QUICK_REPLY' | 'URL' | 'PHONE';
  text: string;
  value?: string;
}

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContact?: Contact | null;
  allContacts: Contact[];
  virtualNumbers: VirtualNumber[];
  whatsAppAccounts: WhatsAppAccount[];
  templates: MessageTemplate[];
  walletAvailableINR: string;
  onOpenLinkDevice?: () => void;
  onSendCampaign: (data: {
    campaignName: string;
    dispatchType: 'MULTI_NUMBER_POOL' | 'DEDICATED_NUMBER';
    senderNumber: string;
    senderPoolCount?: number;
    customMessageText: string;
    buttons?: CampaignActionButton[];
    recipients: Contact[];
    delayIntervalSec: number;
    spintaxEnabled: boolean;
    totalCostINR: number;
  }) => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  selectedContact,
  allContacts,
  virtualNumbers,
  templates,
  walletAvailableINR,
  onOpenLinkDevice,
  onSendCampaign,
}) => {
  if (!isOpen) return null;

  const [dispatchType, setDispatchType] = useState<'MULTI_NUMBER_POOL' | 'DEDICATED_NUMBER'>(
    'DEDICATED_NUMBER',
  );

  const [sessionStatus, setSessionStatus] = useState<{
    isOnline: boolean;
    connectedNumber: string | null;
  }>({
    isOnline: false,
    connectedNumber: null,
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get('/api/v1/session/status');
        if (res.data) {
          setSessionStatus(res.data);
          if (res.data.isOnline && res.data.connectedNumber) {
            setSelectedNumberId('real-linked-session');
          }
        }
      } catch (e) {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const [targetType, setTargetType] = useState<'SINGLE' | 'ALL'>(selectedContact ? 'SINGLE' : 'ALL');
  const [selectedNumberId, setSelectedNumberId] = useState(
    virtualNumbers.find((n) => n.id === 'real-linked-session')?.id || virtualNumbers[0]?.id || 'real-linked-session',
  );

  useEffect(() => {
    const active = virtualNumbers.find((n) => n.id === 'real-linked-session');
    if (active) {
      setSelectedNumberId(active.id);
    } else if (sessionStatus.isOnline || sessionStatus.connectedNumber) {
      setSelectedNumberId('real-linked-session');
    } else if (virtualNumbers.length > 0 && !selectedNumberId) {
      setSelectedNumberId(virtualNumbers[0].id);
    }
  }, [virtualNumbers, sessionStatus.isOnline, sessionStatus.connectedNumber]);

  const [campaignName, setCampaignName] = useState(
    selectedContact
      ? `Direct to ${selectedContact.name}`
      : `Virtual Broadcaster ${new Date().toLocaleDateString('en-IN')}`,
  );

  // Direct Message Composer (No Meta template approvals required!)
  const [messageText, setMessageText] = useState(
    templates[0]?.bodyText || '{Hello|Hi|Greetings} {{1}}! We have an exclusive festive offer for you today. Reply with YES to receive your coupon code!',
  );

  // Interactive CTA & Quick Reply Buttons (wa.me Click-to-Chat)
  const [buttonsEnabled, setButtonsEnabled] = useState(true);
  const [campaignButtons, setCampaignButtons] = useState<CampaignActionButton[]>([
    { id: 'btn-1', type: 'QUICK_REPLY', text: '🎁 Claim 25% Off' },
    { id: 'btn-2', type: 'URL', text: '🌐 Visit Website', value: 'https://example.com' },
    { id: 'btn-3', type: 'PHONE', text: '📞 Call Support', value: '+919876543210' },
  ]);

  const handleAddButton = () => {
    if (campaignButtons.length >= 3) return;
    const newId = `btn-${Date.now()}`;
    setCampaignButtons((prev) => [
      ...prev,
      { id: newId, type: 'QUICK_REPLY', text: `Button ${prev.length + 1}` },
    ]);
  };

  const handleRemoveButton = (id: string) => {
    setCampaignButtons((prev) => prev.filter((b) => b.id !== id));
  };

  const handleUpdateButton = (id: string, updates: Partial<CampaignActionButton>) => {
    setCampaignButtons((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    );
  };

  // Anti-Ban & Humanized Controls
  const [delayIntervalSec, setDelayIntervalSec] = useState(3);
  const [spintaxEnabled, setSpintaxEnabled] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [spintaxVariantSeed, setSpintaxVariantSeed] = useState(0);

  const selectedNumber = virtualNumbers.find((n) => n.id === selectedNumberId) || virtualNumbers[0];

  // Eligible recipients
  const eligibleRecipients = targetType === 'SINGLE' && selectedContact
    ? [selectedContact]
    : allContacts.filter((c) => !c.isSuppressed && c.optInConsent);

  const perMessageRateINR = 1.00;
  const totalCostINR = eligibleRecipients.length * perMessageRateINR;
  const hasSufficientBalance = parseFloat(walletAvailableINR) >= totalCostINR;

  const handleSend = () => {
    if (!hasSufficientBalance || isSending || eligibleRecipients.length === 0) return;

    setIsSending(true);
    setTimeout(() => {
      onSendCampaign({
        campaignName,
        dispatchType,
        senderNumber:
          dispatchType === 'MULTI_NUMBER_POOL'
            ? `Virtual Pool (${virtualNumbers.length} Numbers)`
            : sessionStatus.isOnline && sessionStatus.connectedNumber
            ? sessionStatus.connectedNumber
            : selectedNumber?.phoneNumber || 'Linked WhatsApp Account',
        senderPoolCount: dispatchType === 'MULTI_NUMBER_POOL' ? virtualNumbers.length : 1,
        customMessageText: messageText,
        buttons: buttonsEnabled ? campaignButtons : [],
        recipients: eligibleRecipients,
        delayIntervalSec,
        spintaxEnabled,
        totalCostINR,
      });
      setIsSending(false);
      onClose();
    }, 600);
  };

  // Helper to parse Spintax: {option1|option2|option3}
  const parseSpintax = (text: string) => {
    return text.replace(/\{([^{}]+)\}/g, (_, choices) => {
      const parts = choices.split('|');
      return parts[spintaxVariantSeed % parts.length];
    });
  };

  const previewName = eligibleRecipients[0]?.name || 'Customer';
  let renderedBody = messageText.replace('{{1}}', previewName);
  if (spintaxEnabled) {
    renderedBody = parseSpintax(renderedBody);
  } else {
    renderedBody = renderedBody.replace(/\{([^{}]+)\}/g, (_, choices) => choices.split('|')[0]);
  }

  const senderPreviewNum = (sessionStatus.connectedNumber || '918897727709').replace(/[^\d]/g, '');

  if (buttonsEnabled && campaignButtons.length > 0) {
    const actionLines = campaignButtons.map((b) => {
      if (b.type === 'URL') {
        return `🌐 *${b.text}*\n   🔗 ${b.value || 'https://example.com'}`;
      } else if (b.type === 'PHONE') {
        return `📞 *${b.text}*\n   📲 ${b.value || '+919876543210'}`;
      } else {
        const replyText = b.text.replace(/^[^\w\s]+/g, '').trim() || b.text;
        const encoded = encodeURIComponent(replyText);
        return `💬 *${b.text}* (Tap to Instant Reply):\n   👉 https://wa.me/${senderPreviewNum}?text=${encoded}`;
      }
    });
    renderedBody = `${renderedBody}\n\n━━━━━━━━━━━━━━━━━━━━\n${actionLines.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="shrink-0 bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white shadow-inner">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Virtual Bulk WhatsApp Campaign
                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                  Virtual Gateway
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Direct Virtual Number Dispatch • Multi-Number Rotation • No Meta Approval Needed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body: Scrollable 2 Columns */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Column: Configuration Controls (7 cols) */}
            <div className="md:col-span-7 space-y-4">
            {/* Real WhatsApp Companion Status Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                sessionStatus.isOnline
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : sessionStatus.connectedNumber
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    sessionStatus.isOnline
                      ? 'bg-emerald-500 animate-pulse'
                      : sessionStatus.connectedNumber
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-slate-400'
                  }`}
                />
                <div>
                  <div className="font-bold flex items-center gap-1.5 text-sm">
                    <Smartphone className="w-4 h-4 text-emerald-700" />
                    {sessionStatus.isOnline
                      ? `Connected WhatsApp Sender: ${sessionStatus.connectedNumber}`
                      : sessionStatus.connectedNumber
                      ? `Connected WhatsApp: ${sessionStatus.connectedNumber} (Ready)`
                      : 'No Active WhatsApp Phone Connected'}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    {sessionStatus.isOnline
                      ? 'Real Multi-Device WebSocket active. Messages transmit physically to recipient handsets!'
                      : sessionStatus.connectedNumber
                      ? 'Physical WhatsApp handset authenticated and ready to broadcast real messages.'
                      : 'To send real WhatsApp messages, link your phone in the "Indian Virtual Numbers (+91)" tab.'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!sessionStatus.isOnline && !sessionStatus.connectedNumber && onOpenLinkDevice && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenLinkDevice();
                    }}
                    className="px-3 py-1.5 bg-[#128C7E] hover:bg-[#075E54] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 active:scale-95"
                  >
                    <Key className="w-3.5 h-3.5" />
                    Link Phone Now
                  </button>
                )}
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    sessionStatus.isOnline
                      ? 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                      : sessionStatus.connectedNumber
                      ? 'bg-amber-200 text-amber-900 border border-amber-300'
                      : 'bg-slate-200 text-slate-700 border border-slate-300'
                  }`}
                >
                  {sessionStatus.isOnline ? 'ONLINE' : sessionStatus.connectedNumber ? 'CONNECTED' : 'NOT LINKED'}
                </span>
              </div>
            </div>

            {/* Sender Mode: Pool or Dedicated */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Virtual Sender Configuration
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDispatchType('MULTI_NUMBER_POOL')}
                  className={`p-3 rounded-xl border text-left transition ${
                    dispatchType === 'MULTI_NUMBER_POOL'
                      ? 'border-[#128C7E] bg-emerald-50/70 ring-1 ring-[#128C7E]'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Repeat className="w-4 h-4 text-[#128C7E]" />
                    Multi-Number Pool
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Rotates messages evenly across all {virtualNumbers.length} virtual numbers.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDispatchType('DEDICATED_NUMBER')}
                  className={`p-3 rounded-xl border text-left transition ${
                    dispatchType === 'DEDICATED_NUMBER'
                      ? 'border-[#128C7E] bg-emerald-50/70 ring-1 ring-[#128C7E]'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <PhoneCall className="w-4 h-4 text-emerald-600" />
                    Single Dedicated Number
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Send exclusively through one selected virtual number.
                  </div>
                </button>
              </div>
            </div>

            {/* Campaign Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Campaign Title
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
              />
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Target Audience ({eligibleRecipients.length} Eligible)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetType('SINGLE')}
                  disabled={!selectedContact}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold transition text-left ${
                    targetType === 'SINGLE'
                      ? 'border-[#128C7E] bg-emerald-50 text-[#075E54] ring-1 ring-[#128C7E]'
                      : 'border-slate-200 text-slate-600'
                  } ${!selectedContact ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div>{selectedContact ? selectedContact.name : 'Single Contact'}</div>
                  <div className="text-[11px] text-slate-400 font-normal">
                    {selectedContact ? selectedContact.phoneNumber : 'Pick in CRM'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('ALL')}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold transition text-left ${
                    targetType === 'ALL'
                      ? 'border-[#128C7E] bg-emerald-50 text-[#075E54] ring-1 ring-[#128C7E]'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <div>All Eligible Contacts</div>
                  <div className="text-[11px] text-slate-400 font-normal">
                    {allContacts.filter((c) => !c.isSuppressed && c.optInConsent).length} ready
                  </div>
                </button>
              </div>
            </div>

            {/* Sender Selection if Dedicated Number */}
            {dispatchType === 'DEDICATED_NUMBER' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Choose Virtual Sender Number (+91)
                </label>
                <select
                  value={selectedNumberId}
                  onChange={(e) => setSelectedNumberId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
                >
                  {(sessionStatus.connectedNumber || virtualNumbers.some((n) => n.id === 'real-linked-session')) && (
                    <option value="real-linked-session">
                      🟢 {sessionStatus.connectedNumber || virtualNumbers.find((n) => n.id === 'real-linked-session')?.phoneNumber} • Connected Real WhatsApp (Physical Handset)
                    </option>
                  )}
                  {virtualNumbers
                    .filter((n) => n.id !== 'real-linked-session')
                    .map((num) => (
                      <option key={num.id} value={num.id}>
                        {num.phoneNumber} • {num.provider} ({num.region})
                      </option>
                    ))}
                  {!sessionStatus.connectedNumber && !virtualNumbers.some((n) => n.id === 'real-linked-session') && virtualNumbers.length === 0 && (
                    <option value="" disabled>
                      ⚠️ No active WhatsApp sender linked yet
                    </option>
                  )}
                </select>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <Repeat className="w-3.5 h-3.5" />
                    Active Pool: {virtualNumbers.length} Virtual Numbers
                  </span>
                  <span className="text-slate-500 font-normal">Round-Robin Active</span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  {virtualNumbers.map((n) => n.phoneNumber).join(' • ')}
                </div>
              </div>
            )}

            {/* Direct Message Composer (Free text + Spintax) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Message Content (Direct Send)
                </label>
                <span className="text-[11px] text-slate-400">
                  Use <code>{'{{1}}'}</code> for name, <code>{'{A|B}'}</code> for Spintax
                </span>
              </div>
              <textarea
                rows={4}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your WhatsApp broadcast message here..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-sans focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
              />
            </div>

            {/* Interactive Action Buttons (wa.me & CTA Links) */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Interactive Click-to-Chat Buttons (wa.me & CTA Links)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Generates 1-tap wa.me Quick Replies, website links, and click-to-call phone numbers.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={buttonsEnabled}
                    onChange={(e) => setButtonsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#128C7E]"></div>
                </label>
              </div>

              {buttonsEnabled && (
                <div className="space-y-2 pt-1 border-t border-slate-200/80">
                  {campaignButtons.map((btn, index) => (
                    <div
                      key={btn.id}
                      className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>

                        <select
                          value={btn.type}
                          onChange={(e) =>
                            handleUpdateButton(btn.id, {
                              type: e.target.value as any,
                              value:
                                e.target.value === 'URL'
                                  ? 'https://example.com'
                                  : e.target.value === 'PHONE'
                                  ? '+919876543210'
                                  : '',
                            })
                          }
                          className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white shrink-0 focus:ring-1 focus:ring-emerald-500 font-medium"
                        >
                          <option value="QUICK_REPLY">👉 Quick Reply</option>
                          <option value="URL">🔗 Visit Website (URL)</option>
                          <option value="PHONE">📞 Call Phone</option>
                        </select>

                        <input
                          type="text"
                          value={btn.text}
                          onChange={(e) => handleUpdateButton(btn.id, { text: e.target.value })}
                          placeholder="Button Label (e.g. Claim Offer)"
                          className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 font-medium"
                          maxLength={30}
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveButton(btn.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Remove Button"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {btn.type !== 'QUICK_REPLY' && (
                        <div className="pl-7">
                          <input
                            type="text"
                            value={btn.value || ''}
                            onChange={(e) => handleUpdateButton(btn.id, { value: e.target.value })}
                            placeholder={btn.type === 'URL' ? 'https://yourwebsite.com' : '+91 98765 43210'}
                            className="w-full px-2.5 py-1 text-[11px] font-mono border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {campaignButtons.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddButton}
                      className="w-full py-1.5 border border-dashed border-emerald-400 text-[#128C7E] hover:bg-emerald-50 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Action Button ({campaignButtons.length}/3)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Anti-Ban Safeguards: Spintax & Sleep Delay Slider */}
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Anti-Ban Delivery Throttling
                </span>
                <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-semibold">
                  Multi-Session Protection
                </span>
              </div>

              {/* Spintax Toggle */}
              <div className="flex items-center justify-between text-xs text-slate-700">
                <div className="flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-slate-500" />
                  <span>Randomize Spintax variations</span>
                </div>
                <input
                  type="checkbox"
                  checked={spintaxEnabled}
                  onChange={(e) => setSpintaxEnabled(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              {/* Delay Slider */}
              <div>
                <div className="flex justify-between text-xs text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Humanized Sleep Interval:
                  </span>
                  <span className="font-bold text-[#075E54]">{delayIntervalSec} - {delayIntervalSec + 3} seconds</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={delayIntervalSec}
                  onChange={(e) => setDelayIntervalSec(parseInt(e.target.value, 10))}
                  className="w-full accent-[#128C7E]"
                />
              </div>
            </div>

            {/* Wallet Cost Breakdown */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Available Balance:</span>
                <span className="font-semibold text-slate-900">₹{walletAvailableINR}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Campaign Cost ({eligibleRecipients.length} msgs @ ₹1.00):</span>
                <span className="font-bold text-[#075E54]">₹{totalCostINR.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Right Column: WhatsApp Live Message Preview (5 cols, sticky) */}
          <div className="md:col-span-5 sticky top-2 flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Live Chat Mockup
              </label>
              {spintaxEnabled && (
                <button
                  type="button"
                  onClick={() => setSpintaxVariantSeed((s) => s + 1)}
                  className="text-[11px] text-[#128C7E] font-bold hover:underline flex items-center gap-1"
                >
                  <Shuffle className="w-3 h-3" />
                  Randomize Spintax
                </button>
              )}
            </div>

            {/* Mock Phone Container */}
            <div className="flex-1 rounded-2xl bg-[#ECE5DD] border-4 border-slate-800 p-3 shadow-inner flex flex-col justify-between relative overflow-hidden min-h-[380px]">
              {/* WhatsApp Chat Header */}
              <div className="bg-[#075E54] text-white -m-3 mb-3 p-2.5 px-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                    WA
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight flex items-center gap-1">
                      {dispatchType === 'MULTI_NUMBER_POOL'
                        ? 'Virtual Number Pool'
                        : sessionStatus.isOnline && sessionStatus.connectedNumber
                        ? sessionStatus.connectedNumber
                        : selectedNumber?.phoneNumber || 'Linked WhatsApp Account'}
                      <CheckCircle2 className="w-3 h-3 text-[#25D366] fill-[#25D366]" />
                    </div>
                    <div className="text-[10px] text-emerald-100">
                      {sessionStatus.isOnline ? '🟢 Real WhatsApp Companion Online' : 'Virtual Number Gateway'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Bubble Area */}
              <div className="space-y-2 my-auto">
                <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm border border-slate-200/60 max-w-[95%] space-y-1.5 overflow-hidden">
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {renderedBody}
                  </p>
                  <div className="text-[10px] text-right text-slate-400">
                    Just now &bull; {spintaxEnabled ? 'Spintax Dynamic' : 'Direct'}
                  </div>
                </div>

                {/* Action Links Preview if enabled */}
                {buttonsEnabled && campaignButtons.length > 0 && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100 -mx-3 -mb-3 mt-2 bg-slate-50/70">
                    {campaignButtons.map((btn) => (
                      <div
                        key={btn.id}
                        className="py-1.5 px-3 text-center text-xs font-semibold text-[#128C7E] flex items-center justify-center gap-1.5 hover:bg-emerald-50/80 transition"
                      >
                        {btn.type === 'URL' && <ExternalLink className="w-3.5 h-3.5 text-[#128C7E]" />}
                        {btn.type === 'PHONE' && <PhoneCall className="w-3.5 h-3.5 text-[#128C7E]" />}
                        {btn.type === 'QUICK_REPLY' && <CornerDownLeft className="w-3.5 h-3.5 text-[#128C7E]" />}
                        <span className="truncate">{btn.text || 'Action'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer notice */}
              <div className="text-[9px] text-slate-500 text-center pt-2">
                Dispatched via Indian Virtual Number Gateway
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Modal Footer (Always Pinned at bottom) */}
        <div className="shrink-0 bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5 text-emerald-600" />
            Mode: <strong>{dispatchType === 'MULTI_NUMBER_POOL' ? 'Virtual Number Pool' : 'Dedicated Virtual Number'}</strong>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!hasSufficientBalance || isSending || eligibleRecipients.length === 0}
              className={`px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-md flex items-center gap-2 transition ${
                hasSufficientBalance && eligibleRecipients.length > 0 && !isSending
                  ? 'bg-[#25D366] hover:bg-[#1da851] active:scale-95'
                  : 'bg-slate-400 cursor-not-allowed'
              }`}
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Dispatching...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Campaign ({eligibleRecipients.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
