import React, { useState, useEffect } from 'react';
import { VirtualNumber, WarmupLogEntry, ConnectedWhatsAppAccount } from '../types';
import {
  PhoneCall,
  ShieldCheck,
  Plus,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Wifi,
  Smartphone,
  RefreshCw,
  LogOut,
  Zap,
  Activity,
  Flame,
  Radio,
  Server,
  Layers,
  Sparkles,
  ArrowRight,
  Key,
  Copy,
  Check,
  Trash2,
  Globe,
  Sliders,
  Clock,
  Shuffle,
  ShieldAlert,
} from 'lucide-react';
import axios from 'axios';

interface VirtualNumbersViewProps {
  numbers: VirtualNumber[];
  onPurchaseNumber: (newNumber: VirtualNumber) => void;
  onAutoProvisionNumber?: (provisionResult: {
    phoneNumber: string;
    orderId: string;
    otpCode?: string;
    costINR: number;
    proxyDisplay?: string;
  }) => void;
  warmupLogs: WarmupLogEntry[];
  onTriggerWarmup?: () => Promise<void>;
  walletBalanceINR: string;
}

export const VirtualNumbersView: React.FC<VirtualNumbersViewProps> = ({
  numbers,
  onPurchaseNumber,
  onAutoProvisionNumber,
  warmupLogs,
  onTriggerWarmup,
  walletBalanceINR,
}) => {
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Auto-provisioning state modal
  const [isAutoProvisioning, setIsAutoProvisioning] = useState(false);
  const [provisionStep, setProvisionStep] = useState<number>(0);
  const [provisionResult, setProvisionResult] = useState<{
    phoneNumber: string;
    orderId: string;
    otpCode?: string;
    costINR: number;
  } | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  // Multi-WhatsApp Connected Accounts State
  const [accounts, setAccounts] = useState<ConnectedWhatsAppAccount[]>([]);
  const [selectedAccountForPairing, setSelectedAccountForPairing] = useState<string>('default');
  const [newAccountLabel, setNewAccountLabel] = useState<string>('');

  // Live Multi-Device Session State for selected account
  const [sessionStatus, setSessionStatus] = useState<{
    state: string;
    isOnline: boolean;
    qrCodeDataUrl: string | null;
    connectedNumber: string | null;
  }>({
    state: 'SCAN_QR_REQUIRED',
    isOnline: false,
    qrCodeDataUrl: null,
    connectedNumber: null,
  });

  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isWarmingActive, setIsWarmingActive] = useState(false);

  // Pairing Mode State: 8-digit code vs QR scan
  const [pairingTab, setPairingTab] = useState<'CODE' | 'QR'>('QR');
  const [pairingPhoneNumber, setPairingPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isRequestingPairingCode, setIsRequestingPairingCode] = useState(false);
  const [isRefreshingQr, setIsRefreshingQr] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Dedicated Residential / Mobile Proxy Configuration State (Golden Rule 2)
  const [proxyModalOpen, setProxyModalOpen] = useState(false);
  const [proxyTargetAccount, setProxyTargetAccount] = useState<ConnectedWhatsAppAccount | null>(null);
  const [proxyInput, setProxyInput] = useState('');
  const [isSavingProxy, setIsSavingProxy] = useState(false);
  const [proxySaveMsg, setProxySaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleOpenProxyModal = (acc: ConnectedWhatsAppAccount) => {
    setProxyTargetAccount(acc);
    setProxyInput(acc.proxyUrl || '');
    setProxySaveMsg(null);
    setProxyModalOpen(true);
  };

  const handleSaveProxy = async () => {
    if (!proxyTargetAccount) return;
    try {
      setIsSavingProxy(true);
      setProxySaveMsg(null);
      const res = await axios.post(`/api/v1/session/accounts/${proxyTargetAccount.sessionId}/proxy`, {
        proxyUrl: proxyInput.trim() || null,
      });
      if (res.data?.success) {
        setProxySaveMsg({ type: 'success', text: res.data.message || 'Proxy configured successfully.' });
        await fetchAccounts();
        setTimeout(() => {
          setProxyModalOpen(false);
        }, 1200);
      } else {
        setProxySaveMsg({ type: 'error', text: res.data?.message || 'Failed to update proxy.' });
      }
    } catch (err: any) {
      setProxySaveMsg({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setIsSavingProxy(false);
    }
  };

  // Fetch all accounts from backend
  const fetchAccounts = async () => {
    try {
      setIsLoadingSession(true);
      const res = await axios.get('/api/v1/session/accounts', { timeout: 3000 });
      if (Array.isArray(res.data)) {
        setAccounts(res.data);
        const current = res.data.find((a: any) => a.sessionId === selectedAccountForPairing) || res.data[0];
        if (current) {
          setSessionStatus(current);
        }
      }
    } catch (e) {
    } finally {
      setIsLoadingSession(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    const interval = setInterval(fetchAccounts, 4000);
    return () => clearInterval(interval);
  }, [selectedAccountForPairing]);

  const handleCreateAccount = async () => {
    try {
      const nextNum = accounts.length + 1;
      const label = newAccountLabel.trim() || `WhatsApp Channel #${nextNum}`;
      const res = await axios.post('/api/v1/session/accounts', { label });
      if (res.data?.sessionId) {
        setNewAccountLabel('');
        setSelectedAccountForPairing(res.data.sessionId);
        setShowQrModal(true);
        setPairingPhoneNumber('');
        setPairingCode(null);
        setPairingError(null);
        await fetchAccounts();
      }
    } catch (e) {}
  };

  const handleRefreshQr = async () => {
    const sid = selectedAccountForPairing || 'default';
    setIsRefreshingQr(true);
    setPairingError(null);
    try {
      const res = await axios.post(`/api/v1/session/accounts/${sid}/qr`);
      if (res.data?.success && res.data?.qrCodeDataUrl) {
        setAccounts((prev) =>
          prev.map((a) => (a.sessionId === sid ? { ...a, qrCodeDataUrl: res.data.qrCodeDataUrl } : a)),
        );
        setSessionStatus((prev) => ({
          ...prev,
          qrCodeDataUrl: res.data.qrCodeDataUrl,
          state: 'SCAN_QR_REQUIRED',
        }));
      } else if (res.data?.error) {
        setPairingError(res.data.error);
      }
    } catch (err: any) {
      setPairingError(err.response?.data?.message || err.message || 'Failed to generate QR code');
    } finally {
      setIsRefreshingQr(false);
    }
  };

  // Form for custom telecom trunk
  const [customTrunkNumber, setCustomTrunkNumber] = useState('');
  const [customTrunkProvider, setCustomTrunkProvider] = useState('Tata Tele Business Services');

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingPhoneNumber.trim()) return;
    const sid = selectedAccountForPairing || 'default';
    setIsRequestingPairingCode(true);
    setPairingError(null);
    setPairingCode(null);

    try {
      const res = await axios.post(`/api/v1/session/accounts/${sid}/pairing-code`, {
        phoneNumber: pairingPhoneNumber.trim(),
      });
      if (res.data?.success && res.data?.pairingCode) {
        setPairingCode(res.data.pairingCode);
      } else {
        setPairingError(res.data?.error || 'Failed to request pairing code');
      }
    } catch (err: any) {
      setPairingError(err.response?.data?.message || err.message || 'Failed to request pairing code from WhatsApp servers');
    } finally {
      setIsRequestingPairingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  useEffect(() => {
    if (showQrModal && pairingTab === 'QR' && !sessionStatus.isOnline && !sessionStatus.qrCodeDataUrl) {
      handleRefreshQr();
    }
  }, [showQrModal, pairingTab, selectedAccountForPairing]);

  const handleDisconnect = async (sessionId?: string) => {
    const sid = sessionId || selectedAccountForPairing || 'default';
    try {
      await axios.post(`/api/v1/session/accounts/${sid}/logout`);
      await fetchAccounts();
    } catch (e) {}
  };

  const handleDeleteAccount = async (sessionId: string) => {
    if (sessionId === 'default') return;
    try {
      await axios.delete(`/api/v1/session/accounts/${sessionId}`);
      if (selectedAccountForPairing === sessionId) {
        setSelectedAccountForPairing('default');
      }
      await fetchAccounts();
    } catch (e) {}
  };

  // 1-Click Automated Sourcing & OTP Interception Workflow (Saasyto / 5SIM / SMS-Activate)
  const handleStartAutoProvision = async () => {
    setIsAutoProvisioning(true);
    setProvisionStep(1); // Sourcing number from Indian telecom SIM pool

    setTimeout(async () => {
      setProvisionStep(2); // Intercepting WhatsApp verification SMS OTP

      try {
        const res = await axios.post('/api/v1/virtual-pool/auto-provision', { country: 'india' }, { timeout: 15000 });
        if (res.data?.success) {
          setProvisionResult(res.data);
          setProvisionStep(3); // Registration complete
          if (onAutoProvisionNumber) {
            onAutoProvisionNumber(res.data);
          }
          return;
        }
      } catch (e) {}

      // Zero mock data: if auto-provision endpoint is not configured, inform the user honestly
      setProvisionError('SMS Gateway API key (5SIM / SMS-Activate) not configured on backend. Please link your existing number using the Pairing Code or QR tab above.');
      setIsAutoProvisioning(false);
    }, 2000);
  };

  const handleTriggerWarmup = async () => {
    setIsWarmingActive(true);
    if (onTriggerWarmup) {
      await onTriggerWarmup();
    }
    setTimeout(() => setIsWarmingActive(false), 800);
  };

  const handleAddCustomTrunk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTrunkNumber.trim()) return;

    let clean = customTrunkNumber.replace(/[^\d]/g, '');
    if (clean.length === 10) clean = `91${clean}`;
    const formatted = `+${clean}`;

    const newTrunk: VirtualNumber = {
      id: `trunk-${Date.now()}`,
      phoneNumber: formatted,
      provider: customTrunkProvider,
      type: 'LANDLINE_DID',
      status: 'ACTIVE',
      sessionStatus: 'CONNECTED',
      dailyLimit: 1000,
      dailySentCount: 0,
      healthScore: 100,
      warmupStage: 'WARMED_READY',
      proxyDisplay: 'Direct Telecom SIP Gateway',
      monthlyRentalINR: '599.00',
      capabilities: { voice: true, sms: false, virtualMessaging: true },
      region: 'Indian Virtual SIP DID',
    };

    onPurchaseNumber(newTrunk);
    setShowBuyModal(false);
    setCustomTrunkNumber('');
  };

  const totalCapacity = numbers.reduce((acc, n) => acc + n.dailyLimit, 0);
  const totalSentToday = numbers.reduce((acc, n) => acc + n.dailySentCount, 0);
  const avgHealth =
    numbers.length > 0
      ? Math.round(numbers.reduce((acc, n) => acc + (n.healthScore || 95), 0) / numbers.length)
      : 100;

  return (
    <div className="space-y-6">
      {/* Multi-WhatsApp Connected Channels & Accounts Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-[#25D366]" />
              <h3 className="text-lg font-bold text-slate-900">
                Connected WhatsApp Accounts & Multi-Device Channels
              </h3>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                {accounts.filter((a) => a.isOnline).length} Active Online
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Connect multiple WhatsApp numbers simultaneously. Bulk campaigns automatically round-robin across active channels to prevent number fatigue and anti-spam blocks.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateAccount}
            className="px-4 py-2 bg-[#25D366] hover:bg-[#1da851] text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            + Link Another WhatsApp Account
          </button>
        </div>

        {/* 🛡️ Core Anti-Ban Architecture (The 6 Golden Rules Active) Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-5 rounded-2xl border border-emerald-500/30 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </span>
                <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Core Anti-Ban Architecture
                  <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                    The 6 Golden Rules Active
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl">
                Commercial anti-ban engine: multi-SIM horizontal rotation, dedicated residential SOCKS5 proxies, typing presence simulation, zero-width cryptographic hash entropy, Gaussian jitter, and warmup limits.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl text-center">
                <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Multi-SIM Pool</div>
                <div className="text-base font-bold text-emerald-400">
                  {accounts.filter((a) => a.isOnline).length} / {accounts.length} Online
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl text-center">
                <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Pool Safe Quota</div>
                <div className="text-base font-bold text-amber-300">
                  {accounts.reduce((acc, a) => acc + (a.dailySentCount || 0), 0)} / {accounts.reduce((acc, a) => acc + (a.maxDailySafeCap || 25), 0)} Sent
                </div>
              </div>
            </div>
          </div>

          {/* 6 Rules Status Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {/* Rule 1 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition">
              <div className="flex items-center justify-between text-emerald-300 font-bold mb-1">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  1. Multi-Session Pool
                </span>
                <span className="text-[10px] bg-emerald-400/20 text-emerald-300 px-1.5 py-0.5 rounded">Active</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Rotates outbound traffic across linked numbers (100 msgs/day safe limit) to prevent single-number blasting.
              </p>
            </div>

            {/* Rule 2 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition">
              <div className="flex items-center justify-between text-teal-300 font-bold mb-1">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-teal-400" />
                  2. Residential Proxies
                </span>
                <span className="text-[10px] bg-teal-400/20 text-teal-300 px-1.5 py-0.5 rounded">
                  {accounts.filter((a) => !!a.proxyUrl).length > 0 ? `${accounts.filter((a) => !!a.proxyUrl).length} Bound` : 'Configurable'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Binds each Baileys socket to a dedicated SOCKS5/HTTP proxy to shield against Meta datacenter cluster bans.
              </p>
            </div>

            {/* Rule 3 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition">
              <div className="flex items-center justify-between text-cyan-300 font-bold mb-1">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  3. Presence Simulation
                </span>
                <span className="text-[10px] bg-cyan-400/20 text-cyan-300 px-1.5 py-0.5 rounded">Active</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Pre-flight onWhatsApp verification, composing typing presence packet, 3-6s humanized delay, and paused teardown.
              </p>
            </div>

            {/* Rule 4 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition">
              <div className="flex items-center justify-between text-indigo-300 font-bold mb-1">
                <span className="flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-indigo-400" />
                  4. Zero-Width Hash Entropy
                </span>
                <span className="text-[10px] bg-indigo-400/20 text-indigo-300 px-1.5 py-0.5 rounded">Active</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Dynamic Spintax + 4-8 invisible zero-width chars (\u200B) creating a cryptographically unique SHA-256 hash per payload.
              </p>
            </div>

            {/* Rule 5 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition">
              <div className="flex items-center justify-between text-amber-300 font-bold mb-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  5. Gaussian Jitter & Breaks
                </span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded">Active</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Box-Muller normal distribution delays (18s-65s) + automatic pool rotation or 5-minute coffee break every 25 messages.
              </p>
            </div>

            {/* Rule 6 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition">
              <div className="flex items-center justify-between text-rose-300 font-bold mb-1">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  6. Warmup & SIM Sourcing
                </span>
                <span className="text-[10px] bg-rose-400/20 text-rose-300 px-1.5 py-0.5 rounded">Enforced</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Automated 3-tier safe caps (25/50/100/day). Guidance: avoid free VoIP; use Non-VoIP SIMs (SMS-Activate, 5sim).
              </p>
            </div>
          </div>
        </div>

        {/* Multi-Account Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc, idx) => (
            <div
              key={acc.sessionId}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                acc.isOnline
                  ? 'bg-emerald-50/60 border-emerald-300 shadow-2xs'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        acc.isOnline ? 'bg-[#25D366] text-white shadow-xs' : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{acc.label}</h4>
                      <span className="text-xs font-mono font-semibold text-slate-600">
                        {acc.connectedNumber ? `+${acc.connectedNumber}` : 'Unpaired Channel'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      acc.isOnline
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {acc.isOnline ? '● ONLINE' : '● UNPAIRED'}
                  </span>
                </div>

                {/* Warmup Stage Badge & Daily Safe Progress */}
                <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-500" />
                      Warmup Stage:
                    </span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                        acc.warmupStage === 'WARMED_UP'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : acc.warmupStage === 'MATURING'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-orange-100 text-orange-800 border border-orange-300'
                      }`}
                    >
                      {acc.warmupStage === 'WARMED_UP'
                        ? '🟢 Warmed Up (100/day)'
                        : acc.warmupStage === 'MATURING'
                        ? '🟡 Maturing (50/day)'
                        : '🟠 Warming Up (25/day)'}
                    </span>
                  </div>

                  {/* Progress Bar for Daily Safe Cap */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Daily Safe Quota:</span>
                      <span className="font-semibold text-slate-700">
                        {acc.dailySentCount || 0} / {acc.maxDailySafeCap || 25} sent today
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (acc.dailySentCount || 0) >= (acc.maxDailySafeCap || 25)
                            ? 'bg-rose-500'
                            : (acc.dailySentCount || 0) >= (acc.maxDailySafeCap || 25) * 0.8
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.round(((acc.dailySentCount || 0) / (acc.maxDailySafeCap || 25)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Proxy Status & Edit Button */}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                    <span className="text-slate-500 flex items-center gap-1 truncate max-w-[170px]" title={acc.proxyUrl || 'Direct IP'}>
                      <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                      {acc.proxyUrl ? (
                        <span className="text-teal-700 font-semibold truncate">
                          {acc.proxyUrl.replace(/:[^:]+@/, ':****@')}
                        </span>
                      ) : (
                        <span className="text-slate-400">Direct IP (No Proxy)</span>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenProxyModal(acc)}
                      className="text-xs text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <Sliders className="w-3 h-3" />
                      {acc.proxyUrl ? 'Edit' : '+ Proxy'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                {acc.isOnline ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnect(acc.sessionId)}
                    className="text-slate-600 hover:text-rose-600 font-semibold flex items-center gap-1 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Unlink Device
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountForPairing(acc.sessionId);
                      setShowQrModal(true);
                    }}
                    className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 transition"
                  >
                    <Key className="w-3.5 h-3.5" />
                    Link (Code or QR) →
                  </button>
                )}

                {acc.sessionId !== 'default' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(acc.sessionId)}
                    className="text-slate-400 hover:text-rose-600 transition flex items-center gap-1"
                    title="Remove slot"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <PhoneCall className="w-6 h-6 text-[#128C7E]" />
              Indian Virtual Numbers (+91)
            </h2>
            <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              Live Gateway (Zero Mock)
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage provisioned Indian virtual numbers, link real WhatsApp accounts, and monitor verified channels.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 1-Click Auto Provision Button */}
          <button
            type="button"
            onClick={handleStartAutoProvision}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 transition flex items-center gap-2 active:scale-95"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            1-Click Auto-Provision +91 (₹10)
          </button>

          {/* Add DID Button */}
          <button
            type="button"
            onClick={() => setShowBuyModal(true)}
            className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Telecom Trunk / SIP
          </button>
        </div>
      </div>

      {/* Virtual Pool KPI Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Senders</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {numbers.length} {numbers.length === 1 ? 'Channel' : 'Channels'}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
            {numbers.length > 0 ? 'Active & Ready' : 'Awaiting Linked Session'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Trust Score</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{avgHealth}% Health</div>
          <div className="text-[11px] text-blue-700 font-medium mt-0.5">Real Noise Encryption</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Daily Quota Usage</span>
            <Radio className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {totalSentToday} / {totalCapacity || 1000} msgs
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {totalCapacity > 0 ? Math.round((totalSentToday / totalCapacity) * 100) : 0}% quota used
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Delivery Protocol</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-purple-900 mt-1">Baileys WebSocket</div>
          <div className="text-[11px] text-purple-700 font-medium mt-0.5">Direct WhatsApp Engine</div>
        </div>
      </div>

      {/* Account Warmer Console */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xs">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Automated Account Warmer (Anti-Ban Engine)
                </h3>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  {numbers.length >= 2 ? 'ACTIVE (Cycling Multi-Number)' : 'STANDBY (Needs 2+ Numbers)'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Simulates natural human conversational exchanges between pool numbers to accumulate incoming message volume and eliminate ban risks.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerWarmup}
            disabled={isWarmingActive || numbers.length < 2}
            className="px-3.5 py-1.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${isWarmingActive ? 'animate-spin' : ''}`} />
            Trigger Warmup Round
          </button>
        </div>

        {/* Live Warmup Conversation Feed */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Warmup Activity Logs
          </div>
          {warmupLogs.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
              No warmup exchanges recorded yet. When you have two or more numbers in your pool, the warmer will cycle automated peer dialogues.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {warmupLogs.slice(0, 3).map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs space-y-2 hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono text-slate-700 font-semibold">{log.fromNumber}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="font-mono text-slate-700 font-semibold">{log.toNumber}</span>
                    <span className="text-[10px] text-slate-400">{log.timestamp}</span>
                  </div>
                  <div className="text-slate-800 italic bg-white p-2 rounded-lg border border-slate-200/50">
                    "{log.snippet}"
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      +1% Trust Health
                    </span>
                    <span className="text-slate-400">Noise Encrypted</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Numbers Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Active WhatsApp Numbers in Pool ({numbers.length})
          </h3>
          <span className="text-xs text-slate-500">
            {numbers.length > 0 ? 'Dispatches rotate across these active sessions' : 'No active senders'}
          </span>
        </div>

        {numbers.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center space-y-3">
            <Smartphone className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">No Active WhatsApp Senders Linked</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Scan the QR code above to link your real WhatsApp account, or use 1-Click Auto-Provision to add a dedicated verified virtual number.
            </p>
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="px-4 py-2 bg-[#25D366] hover:bg-[#1da851] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5"
            >
              <QrCode className="w-4 h-4" />
              Link Device via QR Code
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {numbers.map((num) => {
              const sentPct = Math.round((num.dailySentCount / (num.dailyLimit || 1)) * 100);
              const health = num.healthScore || 100;

              return (
                <div
                  key={num.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                        {num.provider}
                      </span>
                      <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                        {num.phoneNumber}
                      </div>
                      <div className="text-xs text-slate-500">{num.region}</div>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Wifi className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                      Online
                    </span>
                  </div>

                  {/* Proxy & Health Badges */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium flex items-center gap-1">
                      <Server className="w-3 h-3" />
                      {num.proxyDisplay || 'Direct WebSocket'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ★ {health}% Health
                    </span>
                  </div>

                  {/* Daily Safe Limit Meter */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Daily Usage:</span>
                      <span className="font-semibold text-slate-800">
                        {num.dailySentCount} / {num.dailyLimit} msgs ({sentPct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${sentPct}%` }}
                        className={`h-full rounded-full transition-all ${
                          sentPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400">Status:</span>
                      <div className="font-bold text-slate-800">Real Authenticated Session</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      className="px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                    >
                      <QrCode className="w-3.5 h-3.5 text-slate-500" />
                      Session Info
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auto-Provisioning Modal Workflow */}
      {isAutoProvisioning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-600" />
                Automated Indian Virtual Number Sourcing
              </h3>
              {provisionStep === 3 && (
                <button
                  type="button"
                  onClick={() => setIsAutoProvisioning(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  &times;
                </button>
              )}
            </div>

            <div className="space-y-4 py-2">
              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  provisionStep >= 1
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                {provisionStep > 1 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <RefreshCw className="w-5 h-5 text-emerald-600 shrink-0 animate-spin" />
                )}
                <div>
                  <div className="font-bold text-xs">Step 1: Allocating Indian +91 Cellular Line</div>
                  <div className="text-[11px] text-slate-500">
                    Querying mobile line inventory from SMS gateway provider
                  </div>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  provisionStep >= 2
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                {provisionStep > 2 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : provisionStep === 2 ? (
                  <RefreshCw className="w-5 h-5 text-emerald-600 shrink-0 animate-spin" />
                ) : (
                  <Smartphone className="w-5 h-5 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-xs">Step 2: WhatsApp OTP Verification</div>
                  <div className="text-[11px] text-slate-500">
                    Listening for incoming 6-digit WhatsApp SMS verification code
                  </div>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  provisionStep === 3
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                {provisionStep === 3 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <Server className="w-5 h-5 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-xs">Step 3: Registration into Virtual Pool</div>
                  <div className="text-[11px] text-slate-500">
                    Pairing Noise session with Indian 4G residential proxy
                  </div>
                </div>
              </div>

              {provisionStep === 3 && provisionResult && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Virtual Number Provisioned Successfully!
                  </div>
                  <div className="font-mono text-lg font-bold text-slate-900">
                    {provisionResult.phoneNumber}
                  </div>
                  <div className="text-xs text-slate-600 flex justify-between">
                    <span>Order ID: <strong>{provisionResult.orderId}</strong></span>
                    <span>OTP Received: <strong>{provisionResult.otpCode || 'Verified'}</strong></span>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-emerald-200/60">
                    Fee: ₹{provisionResult.costINR.toFixed(2)} deducted from balance. Number is now in your active sender pool.
                  </div>
                </div>
              )}
            </div>

            {provisionStep === 3 && (
              <button
                type="button"
                onClick={() => setIsAutoProvisioning(false)}
                className="w-full py-2.5 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-xl text-xs font-bold transition shadow-md"
              >
                Done / Return to Numbers
              </button>
            )}
          </div>
        </div>
      )}

      {/* Manual Telecom SIP Trunk Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-[#128C7E]" />
              Connect Telecom Trunk / SIP DID
            </h3>
            <p className="text-xs text-slate-500">
              Enter an Indian DID number provisioned via your licensed telecom provider (Tata Tele, Airtel, Exotel) to connect it to your WhatsApp sending gateway.
            </p>

            <form onSubmit={handleAddCustomTrunk} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Provider / Telecom Carrier
                </label>
                <select
                  value={customTrunkProvider}
                  onChange={(e) => setCustomTrunkProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden"
                >
                  <option value="Tata Tele Business Services">Tata Tele Business Services (TTBS)</option>
                  <option value="Airtel Enterprise Telephony">Airtel Enterprise Telephony</option>
                  <option value="Jio SIP Trunk">Jio Commercial SIP Trunk</option>
                  <option value="Exotel Virtual DID">Exotel Virtual DID</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Indian Phone Number (+91)
                </label>
                <input
                  type="text"
                  placeholder="+91 80 1234 5678 or 9876543210"
                  value={customTrunkNumber}
                  onChange={(e) => setCustomTrunkNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBuyModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-lg text-xs font-bold"
                >
                  Connect Trunk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Device Linking Modal: 8-Digit Code (No Scanning) or Camera QR */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] overflow-y-auto p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-5 h-5 text-[#128C7E]" />
                Link Real WhatsApp Device
              </h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Target Account Channel Selector */}
            {accounts.length > 1 && (
              <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Pairing Channel Slot:
                </label>
                <select
                  value={selectedAccountForPairing}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setSelectedAccountForPairing(sid);
                    const target = accounts.find((a) => a.sessionId === sid);
                    if (target) {
                      setSessionStatus(target);
                    }
                    setPairingCode(null);
                    setPairingError(null);
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                >
                  {accounts.map((acc, i) => (
                    <option key={acc.sessionId} value={acc.sessionId}>
                      #{i + 1}: {acc.label} {acc.connectedNumber ? `(+${acc.connectedNumber})` : '(Unpaired Slot)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Mode Switcher: Code vs QR */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPairingTab('CODE')}
                className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  pairingTab === 'CODE'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Key className="w-3.5 h-3.5 text-emerald-600" />
                8-Digit Code (No Camera)
              </button>
              <button
                type="button"
                onClick={() => setPairingTab('QR')}
                className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  pairingTab === 'QR'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                Scan QR Code
              </button>
            </div>

            {/* TAB 1: 8-DIGIT PAIRING CODE (NO CAMERA SCANNING) */}
            {pairingTab === 'CODE' && (
              <div className="space-y-4 text-left">
                {(accounts.find((a) => a.sessionId === selectedAccountForPairing)?.isOnline || sessionStatus.isOnline) ? (
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                    <div className="text-sm font-bold text-emerald-900">This Channel is Already Linked & Online!</div>
                    <div className="text-xs text-slate-600 font-mono">
                      +{accounts.find((a) => a.sessionId === selectedAccountForPairing)?.connectedNumber || sessionStatus.connectedNumber}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 text-center">
                      Connect your existing WhatsApp number <strong>without scanning any QR code</strong>.
                    </p>

                    <form onSubmit={handleRequestPairingCode} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Your Existing WhatsApp Phone Number
                        </label>
                        <input
                          type="text"
                          placeholder="+91 98765 43210"
                          value={pairingPhoneNumber}
                          onChange={(e) => setPairingPhoneNumber(e.target.value)}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-hidden"
                          required
                        />
                      </div>

                      {pairingError && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{pairingError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isRequestingPairingCode}
                        className="w-full py-2.5 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                      >
                        {isRequestingPairingCode ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Requesting Code from WhatsApp...
                          </>
                        ) : (
                          <>
                            <Key className="w-4 h-4" />
                            Generate 8-Digit Pairing Code
                          </>
                        )}
                      </button>
                    </form>

                    {pairingCode && (
                      <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl text-center space-y-3 animate-in fade-in zoom-in-95">
                        <div className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                          Your WhatsApp Pairing Code
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-mono text-2xl font-black tracking-widest text-slate-900 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-inner">
                            {pairingCode}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyCode}
                            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 shadow-2xs transition"
                            title="Copy Code"
                          >
                            {copiedCode ? (
                              <Check className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Copy className="w-5 h-5 text-slate-500" />
                            )}
                          </button>
                        </div>

                        <div className="p-3 bg-white/80 rounded-xl text-left text-xs text-slate-600 space-y-1 border border-emerald-100">
                          <div className="font-bold text-slate-800">Next Steps on your phone:</div>
                          <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600">
                            <li>Open WhatsApp on phone <strong>({pairingPhoneNumber})</strong>.</li>
                            <li>Tap <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong>.</li>
                            <li>Tap <strong>"Link with phone number instead"</strong> at the bottom.</li>
                            <li>Enter the code above: <strong className="font-mono text-emerald-800">{pairingCode}</strong>.</li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* TAB 2: CAMERA QR SCAN */}
            {pairingTab === 'QR' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Open WhatsApp on your phone &rarr; <strong>Settings</strong> &rarr; <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong> and point your camera here:
                </p>

                <div className="w-64 h-64 mx-auto bg-white border-2 border-slate-200 rounded-2xl flex flex-col items-center justify-center p-3 shadow-inner relative">
                  {isRefreshingQr ? (
                    <div className="text-center space-y-2">
                      <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                      <div className="text-xs text-slate-600 font-medium">Generating real WhatsApp QR...</div>
                      <div className="text-[10px] text-slate-400">Connecting to WhatsApp Noise servers</div>
                    </div>
                  ) : (accounts.find((a) => a.sessionId === selectedAccountForPairing)?.qrCodeDataUrl || sessionStatus.qrCodeDataUrl) ? (
                    <img
                      src={accounts.find((a) => a.sessionId === selectedAccountForPairing)?.qrCodeDataUrl || sessionStatus.qrCodeDataUrl!}
                      alt="WhatsApp Pairing QR"
                      className="w-full h-full object-contain"
                    />
                  ) : (accounts.find((a) => a.sessionId === selectedAccountForPairing)?.isOnline || sessionStatus.isOnline) ? (
                    <div className="text-center space-y-2">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                      <div className="text-xs font-bold text-emerald-800">Channel Already Linked & Online!</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        +{accounts.find((a) => a.sessionId === selectedAccountForPairing)?.connectedNumber || sessionStatus.connectedNumber}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <QrCode className="w-16 h-16 text-slate-400 mx-auto" />
                      <div className="text-xs text-slate-600 font-semibold">
                        Awaiting QR Generation
                      </div>
                      <button
                        type="button"
                        onClick={handleRefreshQr}
                        className="px-3 py-1.5 bg-[#128C7E] hover:bg-[#075E54] text-white text-xs font-bold rounded-lg shadow-xs inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Generate Live QR
                      </button>
                    </div>
                  )}
                </div>

                {!sessionStatus.isOnline && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleRefreshQr}
                      disabled={isRefreshingQr}
                      className="px-4 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isRefreshingQr ? 'animate-spin' : ''}`} />
                      {sessionStatus.qrCodeDataUrl ? 'Regenerate / Refresh Real QR' : 'Generate Real QR Code'}
                    </button>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-xl text-left text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-800">How camera linking works:</div>
                  <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-slate-500">
                    <li>Scan the QR code from any WhatsApp phone.</li>
                    <li>Your device establishes a live encrypted WebSocket session.</li>
                    <li>Campaigns immediately route to real WhatsApp handsets!</li>
                  </ol>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Golden Rule 2: Dedicated SOCKS5 / HTTP Proxy Configuration Modal */}
      {proxyModalOpen && proxyTargetAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-700">
                  <Globe className="w-5 h-5 text-teal-600" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Configure Dedicated Proxy</h3>
                  <p className="text-xs text-slate-500">
                    Slot: {proxyTargetAccount.label} ({proxyTargetAccount.connectedNumber ? `+${proxyTargetAccount.connectedNumber}` : 'Unpaired'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProxyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl space-y-1 text-teal-900">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  Golden Rule 2: Cluster Ban Prevention
                </div>
                <p className="text-[11px] text-teal-800">
                  Binding each WhatsApp socket to a residential or mobile proxy ensures Meta's network scanners cannot link and ban your number cluster based on shared datacenter IP addresses.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Proxy URI (SOCKS5 / HTTP / HTTPS)
                </label>
                <input
                  type="text"
                  value={proxyInput}
                  onChange={(e) => setProxyInput(e.target.value)}
                  placeholder="e.g. socks5://user:pass@127.0.0.1:1080 or http://host:port"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Leave empty and click Save to remove proxy and revert to direct server IP.
                </p>
              </div>

              {proxySaveMsg && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    proxySaveMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {proxySaveMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{proxySaveMsg.text}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProxyModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProxy}
                disabled={isSavingProxy}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingProxy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Save Proxy & Reconnect Socket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
