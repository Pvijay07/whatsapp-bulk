import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Contact, VirtualNumber, MessageTemplate, WhatsAppAccount, ConnectedWhatsAppAccount } from '../types';
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
  Paperclip,
  Image as ImageIcon,
  UploadCloud,
  Download,
  Video,
  Music,
} from 'lucide-react';

export interface CampaignActionButton {
  id: string;
  type: 'QUICK_REPLY' | 'URL' | 'PHONE';
  text: string;
  value?: string;
}

export interface MediaAttachment {
  file?: File;
  base64?: string;
  url?: string;
  mimeType: string;
  fileName: string;
  fileSize?: number;
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
    media?: MediaAttachment | null;
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

  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedWhatsAppAccount[]>([]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await axios.get('/api/v1/session/accounts');
        if (Array.isArray(res.data)) {
          setConnectedAccounts(res.data);
          const onlineAcc = res.data.find((a: any) => a.isOnline) || res.data[0];
          if (onlineAcc) {
            setSessionStatus(onlineAcc);
          }
        }
      } catch (e) {}
    };
    fetchAccounts();
    const interval = setInterval(fetchAccounts, 3000);
    return () => clearInterval(interval);
  }, []);

  const [targetType, setTargetType] = useState<'SINGLE' | 'ALL'>(selectedContact ? 'SINGLE' : 'ALL');
  const [selectedNumberId, setSelectedNumberId] = useState('MULTI_NUMBER_POOL');

  useEffect(() => {
    if (connectedAccounts.length > 0 && selectedNumberId === 'MULTI_NUMBER_POOL') {
      const firstOnline = connectedAccounts.find((a) => a.isOnline);
      if (firstOnline && dispatchType === 'DEDICATED_NUMBER') {
        setSelectedNumberId(firstOnline.sessionId);
      }
    }
  }, [connectedAccounts, dispatchType]);

  const [campaignName, setCampaignName] = useState(
    selectedContact
      ? `Direct to ${selectedContact.name}`
      : `Virtual Broadcaster ${new Date().toLocaleDateString('en-IN')}`,
  );

  // Direct Message Composer (No Meta template approvals required!)
  const [messageText, setMessageText] = useState(
    templates[0]?.bodyText || '{Hello|Hi|Greetings} {{1}}! We have an exclusive festive offer for you today. Reply with YES to receive your coupon code!',
  );

  // Interactive Single Quick Reply Action Button (directing to 917997887788)
  const [buttonsEnabled, setButtonsEnabled] = useState(true);
  const [campaignButtons, setCampaignButtons] = useState<CampaignActionButton[]>([
    { id: 'btn-interactive', type: 'QUICK_REPLY', text: 'WhatsApp Now', value: '917997887788' },
  ]);

  // Media Attachment (Images, Documents / PDFs, Videos, Audio)
  const [attachment, setAttachment] = useState<MediaAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        file,
        base64: reader.result as string,
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name,
        fileSize: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 1-Click preset demo graphic generator for quick testing
  const handleSetSampleImage = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 340;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // WhatsApp emerald gradient background
        const grad = ctx.createLinearGradient(0, 0, 600, 340);
        grad.addColorStop(0, '#075E54');
        grad.addColorStop(0.5, '#128C7E');
        grad.addColorStop(1, '#25D366');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 600, 340);

        // Card container
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.roundRect ? ctx.roundRect(30, 30, 540, 280, 20) : ctx.fillRect(30, 30, 540, 280);
        ctx.fill();

        // Texts
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SPECIAL 25% DISCOUNT', 300, 140);

        ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#FFE600';
        ctx.fillText('🎁 FESTIVE MEGA SALE • LIMITED PERIOD', 300, 185);

        ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#E8F5E9';
        ctx.fillText('Instant Delivery • Verified Virtual Broadcast', 300, 235);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAttachment({
          base64: dataUrl,
          mimeType: 'image/jpeg',
          fileName: 'Festive-Offer-Banner.jpg',
          fileSize: 42000,
        });
      }
    } catch (e) {
      console.warn('Canvas generator fallback', e);
    }
  };

  const handleUpdateInteractiveButton = (updates: { text?: string; value?: string }) => {
    setCampaignButtons((prev) => [
      {
        id: prev[0]?.id || 'btn-interactive',
        type: 'QUICK_REPLY',
        text: updates.text !== undefined ? updates.text : (prev[0]?.text || '🎁 Claim 25% Off'),
        value: updates.value !== undefined ? updates.value : (prev[0]?.value || '917997887788'),
      },
    ]);
  };

  // Anti-Ban & Humanized Controls (6 Golden Rules)
  const [delayIntervalSec, setDelayIntervalSec] = useState(25);
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
      const selectedAcc = connectedAccounts.find((a) => a.sessionId === selectedNumberId);
      const onlineCount = connectedAccounts.filter((a) => a.isOnline).length || 1;

      onSendCampaign({
        campaignName,
        dispatchType,
        senderNumber:
          dispatchType === 'MULTI_NUMBER_POOL'
            ? 'MULTI_NUMBER_POOL'
            : selectedAcc?.connectedNumber || selectedAcc?.sessionId || 'default',
        senderPoolCount: dispatchType === 'MULTI_NUMBER_POOL' ? onlineCount : 1,
        customMessageText: messageText,
        buttons: buttonsEnabled ? campaignButtons : [],
        media: attachment,
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

  // Format 1-Click Interactive WhatsApp Action (wa.me) matching user reference screenshot
  if (buttonsEnabled && campaignButtons.length > 0) {
    const b = campaignButtons[0];
    const label = b.text || 'WhatsApp Now';
    const targetClean = (b.value || '917997887788').replace(/[^\d]/g, '') || '917997887788';
    renderedBody = `${renderedBody}\n\n${label}: https://wa.me/${targetClean}`;
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
            {/*  Companion Status Banner */}
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
                      : 'To send  messages, link your phone in the "Indian Virtual Numbers (+91)" tab.'}
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
                    Multi-Number Pool (Recommended)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Rotates messages evenly across all {connectedAccounts.filter((a) => a.isOnline).length || 1} online WhatsApp numbers.
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
                  Choose WhatsApp Sender Channel (+91)
                </label>
                <select
                  value={selectedNumberId}
                  onChange={(e) => setSelectedNumberId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
                >
                  {connectedAccounts.map((acc, idx) => (
                    <option key={acc.sessionId} value={acc.sessionId}>
                      {acc.isOnline ? '🟢' : '🟡'} #{idx + 1}: {acc.label} {acc.connectedNumber ? `(+${acc.connectedNumber})` : '(Unpaired Slot)'}
                    </option>
                  ))}
                  {connectedAccounts.length === 0 && (
                    <option value="" disabled>
                      ⚠️ No active WhatsApp accounts configured yet
                    </option>
                  )}
                </select>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <Repeat className="w-3.5 h-3.5" />
                    Multi-Number Pool: {connectedAccounts.filter((a) => a.isOnline).length || 1} Online Channels
                  </span>
                  <span className="text-slate-500 font-normal">Auto Round-Robin Active</span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  {connectedAccounts.filter((a) => a.isOnline).map((n) => `+${n.connectedNumber}`).join(' • ') || 'All online accounts will rotate evenly.'}
                </div>
              </div>
            )}

            {/* Media & Document Attachment */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                    Media & Document Attachment (Optional)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Attach images, PDF brochures, product catalogs, videos, or audio.
                  </div>
                </div>
                {attachment && (
                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,video/*,audio/*"
                className="hidden"
              />

              {!attachment ? (
                <div className="space-y-2">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-3.5 text-center cursor-pointer transition bg-white hover:bg-emerald-50/30 group"
                  >
                    <UploadCloud className="w-7 h-7 text-slate-400 group-hover:text-[#128C7E] mx-auto mb-1 transition" />
                    <div className="text-xs font-semibold text-slate-700 group-hover:text-[#128C7E]">
                      Click to attach Image, PDF Catalog, Video or Audio
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Supports JPG, PNG, PDF, MP4, MP3, DOCX up to 25 MB
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">Quick Preset:</span>
                    <button
                      type="button"
                      onClick={handleSetSampleImage}
                      className="text-[10px] bg-slate-200/80 hover:bg-emerald-100 hover:text-emerald-900 text-slate-700 px-2 py-0.5 rounded font-medium transition flex items-center gap-1"
                    >
                      <ImageIcon className="w-3 h-3 text-emerald-600" />
                      + Sample Promo Banner (JPG)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-white border border-emerald-300 rounded-xl flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {attachment.mimeType.startsWith('image/') ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                        <img
                          src={attachment.base64 || attachment.url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : attachment.mimeType.includes('pdf') ? (
                      <div className="w-12 h-12 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex flex-col items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                        <span className="text-[8px] font-bold uppercase">PDF</span>
                      </div>
                    ) : attachment.mimeType.startsWith('video/') ? (
                      <div className="w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex flex-col items-center justify-center shrink-0">
                        <Video className="w-5 h-5" />
                        <span className="text-[8px] font-bold uppercase">VID</span>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex flex-col items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                        <span className="text-[8px] font-bold uppercase">FILE</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate max-w-[240px]" title={attachment.fileName}>
                        {attachment.fileName}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold text-[9px] uppercase">
                          {attachment.mimeType.split('/')[1] || 'MEDIA'}
                        </span>
                        {attachment.fileSize && (
                          <span>{(attachment.fileSize / 1024).toFixed(1)} KB</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-[#128C7E] hover:underline font-semibold"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt for a Reply First (Cold Outreach Conversational Hook) */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/90 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  Prompt for a Reply First (Cold Outreach Hook)
                </span>
                <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold border border-emerald-300">
                  Risk Reduction: Near Zero
                </span>
              </div>
              <p className="text-[11px] text-emerald-900 leading-snug">
                When a recipient replies even 1 word to your virtual number, WhatsApp marks the thread as a <b>mutual conversation</b>, dropping the spam-ban probability for future messages to near zero.
              </p>
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setMessageText('Hi {{1}}, is this still your active WhatsApp number for order updates? Reply YES to confirm.');
                    setDelayIntervalSec(45);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-medium transition active:scale-95 shadow-2xs"
                >
                  💬 Order Verification Hook
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessageText('Hello {{1}}! We prepared an exclusive catalog for you. Should I send the PDF brochure here? Reply 1 for Yes.');
                    setDelayIntervalSec(45);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-medium transition active:scale-95 shadow-2xs"
                >
                  📦 Catalog Request Hook
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessageText('Hey {{1}}! Your 25% discount voucher is waiting. Reply CLAIM to activate your coupon code.');
                    setDelayIntervalSec(45);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-medium transition active:scale-95 shadow-2xs"
                >
                  🎁 Offer Activation Hook
                </button>
              </div>
            </div>

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

            {/* Interactive Action Button (1-Click wa.me directed to 917997887788) */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Interactive Click-to-Chat Button (wa.me)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Sends an authentic interactive button attached to your message.
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
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Interactive Button Text
                    </label>
                    <input
                      type="text"
                      value={campaignButtons[0]?.text || ''}
                      onChange={(e) => handleUpdateInteractiveButton({ text: e.target.value })}
                      placeholder="e.g. WhatsApp Now"
                      className="w-full px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 bg-white"
                      maxLength={35}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700">
                        Target Reply WhatsApp Number
                      </label>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Target: 917997887788
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs font-mono text-slate-400 font-bold">+</span>
                      <input
                        type="text"
                        value={campaignButtons[0]?.value || '917997887788'}
                        onChange={(e) => handleUpdateInteractiveButton({ value: e.target.value })}
                        placeholder="917997887788"
                        className="w-full pl-6 pr-3 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      When clicked, replies from the recipient are sent directly to this WhatsApp number.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Anti-Ban Safeguards: 6 Golden Rules Throttling & Gaussian Jitter */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/90 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Anti-Ban Engine (6 Golden Rules Active)
                </span>
                <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold border border-emerald-300">
                  Gaussian Jitter Active
                </span>
              </div>

              {/* Spintax Toggle */}
              <div className="flex items-center justify-between text-xs text-slate-700">
                <div className="flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-slate-500" />
                  <span>Randomize Spintax variations + Zero-Width SHA-256 entropy</span>
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
                    Gaussian Sleep Interval:
                  </span>
                  <span className="font-bold text-[#075E54]">
                    ~{delayIntervalSec}s (± 6s Gaussian Jitter, safe bounded)
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="60"
                  step="5"
                  value={delayIntervalSec}
                  onChange={(e) => setDelayIntervalSec(parseInt(e.target.value, 10))}
                  className="w-full accent-[#128C7E]"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>15s (Aggressive)</span>
                  <span className="text-emerald-700 font-medium">25s - 35s (Recommended Safe)</span>
                  <span>60s (Ultra-Safe)</span>
                </div>
              </div>

              {/* Golden Rules Pills */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                <div className="bg-white/80 border border-slate-200 rounded px-2 py-1 text-slate-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Presence: 3-6s typing simulation</span>
                </div>
                <div className="bg-white/80 border border-slate-200 rounded px-2 py-1 text-slate-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Cooldown: 5m break / 25 msgs</span>
                </div>
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
                      {sessionStatus.isOnline ? '🟢  Companion Online' : 'Virtual Number Gateway'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Bubble Area */}
              <div className="space-y-2 my-auto">
                <div className="bg-white rounded-lg rounded-tl-none shadow-sm border border-slate-200/60 max-w-[95%] overflow-hidden">
                  {/* Media Attachment inside Chat Bubble */}
                  {attachment && (
                    <div className="bg-slate-100 border-b border-slate-200/80 overflow-hidden">
                      {attachment.mimeType.startsWith('image/') ? (
                        <div className="w-full max-h-48 overflow-hidden bg-slate-900 flex items-center justify-center">
                          <img
                            src={attachment.base64 || attachment.url}
                            alt="Broadcast attachment"
                            className="w-full h-auto max-h-48 object-cover"
                          />
                        </div>
                      ) : attachment.mimeType.includes('pdf') ? (
                        <div className="p-3 bg-slate-50 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-rose-500 text-white flex flex-col items-center justify-center shrink-0 shadow-xs">
                            <FileText className="w-5 h-5" />
                            <span className="text-[8px] font-bold">PDF</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-800 truncate">
                              {attachment.fileName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {attachment.fileSize ? `${(attachment.fileSize / 1024).toFixed(1)} KB` : 'PDF Document'} &bull; 1 page
                            </div>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                            <Download className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ) : attachment.mimeType.startsWith('video/') ? (
                        <div className="w-full h-36 bg-slate-900 relative flex items-center justify-center text-white">
                          <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-xs flex items-center justify-center">
                            <div className="w-0 h-0 border-y-6 border-y-transparent border-l-10 border-l-white ml-0.5" />
                          </div>
                          <div className="absolute bottom-2 left-2 text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white font-mono">
                            0:15 &bull; {attachment.fileName}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-800 truncate">
                              {attachment.fileName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {attachment.fileSize ? `${(attachment.fileSize / 1024).toFixed(1)} KB` : 'Document'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Caption & Message Body */}
                  <div className="p-3 space-y-1.5">
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {renderedBody}
                    </p>
                    <div className="text-[10px] text-right text-slate-400">
                      Just now &bull; {spintaxEnabled ? 'Spintax Dynamic' : 'Direct'}
                    </div>
                  </div>

                  {/* Single Native Action Button Mockup (Pill below message bubble, matching user reference) */}
                  {buttonsEnabled && campaignButtons.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50/80">
                      <div className="py-2.5 px-3 text-center text-xs font-bold text-[#128C7E] flex items-center justify-center gap-1.5 hover:bg-emerald-50/60 transition cursor-pointer select-none">
                        <span className="truncate">{campaignButtons[0]?.text || 'WhatsApp Now'}</span>
                      </div>
                    </div>
                  )}
                </div>
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
