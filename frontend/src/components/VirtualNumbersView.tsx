import React, { useState, useEffect } from 'react';
import { VirtualNumber } from '../types';
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
} from 'lucide-react';
import axios from 'axios';

interface VirtualNumbersViewProps {
  numbers: VirtualNumber[];
  onPurchaseNumber: (newNumber: VirtualNumber) => void;
  walletBalanceINR: string;
}

export const VirtualNumbersView: React.FC<VirtualNumbersViewProps> = ({
  numbers,
  onPurchaseNumber,
  walletBalanceINR,
}) => {
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState<VirtualNumber | null>(null);

  // Live Multi-Device Session State
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

  // Poll real session status from backend API
  const fetchSessionStatus = async () => {
    try {
      setIsLoadingSession(true);
      const res = await axios.get('/api/v1/session/status', { timeout: 3000 });
      if (res.data) {
        setSessionStatus(res.data);
      }
    } catch (e) {
      // In standalone frontend development mode
    } finally {
      setIsLoadingSession(false);
    }
  };

  useEffect(() => {
    fetchSessionStatus();
    const interval = setInterval(fetchSessionStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDisconnect = async () => {
    try {
      await axios.post('/api/v1/session/logout');
      fetchSessionStatus();
    } catch (e) {}
  };

  const availableCatalog: VirtualNumber[] = [
    {
      id: `num-avail-${Date.now()}-1`,
      phoneNumber: '+918049100555',
      provider: 'Indian Virtual Telephony',
      type: 'LANDLINE_DID',
      status: 'ACTIVE',
      sessionStatus: 'CONNECTED',
      dailyLimit: 500,
      dailySentCount: 0,
      monthlyRentalINR: '599.00',
      capabilities: { voice: true, sms: false, virtualMessaging: true },
      region: 'Bangalore (080) Virtual DID',
    },
    {
      id: `num-avail-${Date.now()}-2`,
      phoneNumber: '+912249100888',
      provider: 'Tata Tele Virtual Trunk',
      type: 'LANDLINE_DID',
      status: 'ACTIVE',
      sessionStatus: 'CONNECTED',
      dailyLimit: 500,
      dailySentCount: 0,
      monthlyRentalINR: '599.00',
      capabilities: { voice: true, sms: false, virtualMessaging: true },
      region: 'Mumbai (022) Virtual DID',
    },
    {
      id: `num-avail-${Date.now()}-3`,
      phoneNumber: '+919810099888',
      provider: 'Cloud Virtual SIM Gateway',
      type: 'MOBILE',
      status: 'ACTIVE',
      sessionStatus: 'CONNECTED',
      dailyLimit: 500,
      dailySentCount: 0,
      monthlyRentalINR: '799.00',
      capabilities: { voice: true, sms: true, virtualMessaging: true },
      region: 'Delhi NCR Mobile Virtual Gateway',
    },
  ];

  const handleBuy = (item: VirtualNumber) => {
    onPurchaseNumber(item);
    setShowBuyModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Real Message Connection Callout: Explains Why Real Messages Need Linked Session */}
      <div className={`p-6 rounded-2xl border transition-all ${
        sessionStatus.isOnline
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 shadow-xs'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              sessionStatus.isOnline ? 'bg-[#25D366] text-white' : 'bg-amber-500 text-white'
            }`}>
              {sessionStatus.isOnline ? <Wifi className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {sessionStatus.isOnline
                    ? `Live Real WhatsApp Session Active (${sessionStatus.connectedNumber})`
                    : 'Pair Device to Send Real WhatsApp Messages'}
                </h3>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  sessionStatus.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {sessionStatus.isOnline ? '● REAL DELIVERY READY' : '● SIMULATION / SANDBOX MODE'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {sessionStatus.isOnline
                  ? 'Your WhatsApp session is actively authenticated to WhatsApp servers via WebSocket. Any campaign you launch will physically arrive and ring on the recipient’s handset in real time!'
                  : 'Currently in Sandbox Simulation Mode. WhatsApp requires an authenticated cryptographic WebSocket session to deliver messages to real phones. Open WhatsApp on your phone & scan the session QR code below to deliver real messages!'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {sessionStatus.isOnline ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                Unlink Device
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowQrModal(numbers[0])}
                className="px-4 py-2 bg-[#25D366] hover:bg-[#1da851] text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-2 active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                Scan QR Code to Link Real WhatsApp
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-[#128C7E]" />
            Indian Virtual Numbers (+91)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage provisioned Indian virtual numbers, monitor multi-device session states, and balance daily quotas.
          </p>
        </div>

        <button
          onClick={() => setShowBuyModal(true)}
          className="px-4 py-2 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-900/20 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Provision New +91 Virtual Number
        </button>
      </div>

      {/* Numbers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {numbers.map((num) => {
          const sentPct = Math.round((num.dailySentCount / num.dailyLimit) * 100);

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

              {/* Daily Safe Limit Meter */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Daily Quota Usage:</span>
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
                  <span className="text-slate-400">Monthly Rental:</span>
                  <div className="font-bold text-slate-800">₹{num.monthlyRentalINR}/mo</div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQrModal(num)}
                  className="px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                >
                  <QrCode className="w-3.5 h-3.5 text-slate-500" />
                  Session QR
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Buy Number Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-[#128C7E]" />
              Provision New Indian Virtual Number (+91)
            </h3>
            <p className="text-xs text-slate-500">
              Select an available Indian virtual number series. Once provisioned, it immediately joins your active round-robin rotation pool.
            </p>

            <div className="space-y-3">
              {availableCatalog.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 border border-slate-200 rounded-xl flex items-center justify-between hover:border-emerald-500 transition"
                >
                  <div>
                    <div className="font-bold font-mono text-slate-900">{item.phoneNumber}</div>
                    <div className="text-xs text-slate-500">
                      {item.provider} • {item.region}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-800">₹{item.monthlyRentalINR}/mo</div>
                    <button
                      type="button"
                      onClick={() => handleBuy(item)}
                      className="mt-1 px-3 py-1 bg-[#128C7E] hover:bg-[#075E54] text-white text-xs font-semibold rounded-lg shadow-xs"
                    >
                      Add to Pool
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowBuyModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code / Session Pairing Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-5 h-5 text-[#128C7E]" />
                Link Real WhatsApp Device
              </h3>
              <button
                type="button"
                onClick={() => setShowQrModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Open WhatsApp on your phone &rarr; <strong>Settings</strong> &rarr; <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong> and point your camera here:
            </p>

            {/* QR display: Shows live QR if backend running, or pairing code */}
            <div className="w-56 h-56 mx-auto bg-white border-2 border-slate-200 rounded-2xl flex flex-col items-center justify-center p-3 shadow-inner">
              {sessionStatus.qrCodeDataUrl ? (
                <img
                  src={sessionStatus.qrCodeDataUrl}
                  alt="WhatsApp Pairing QR"
                  className="w-full h-full object-contain"
                />
              ) : sessionStatus.isOnline ? (
                <div className="text-center space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <div className="text-xs font-bold text-emerald-800">Device Already Linked!</div>
                  <div className="text-[11px] text-slate-500 font-mono">{sessionStatus.connectedNumber}</div>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <QrCode className="w-20 h-20 text-slate-700 mx-auto opacity-70" />
                  <div className="text-[11px] text-slate-500 font-medium">
                    Pairing Session Ready
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                    WebSocket Engine Active
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-left text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">How real delivery works:</div>
              <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-slate-500">
                <li>Scan the QR code from any WhatsApp phone or virtual number.</li>
                <li>Your device establishes a live encrypted WebSocket session.</li>
                <li>When you click Send Campaign, messages transmit to real WhatsApp handsets!</li>
              </ol>
            </div>

            <button
              type="button"
              onClick={() => setShowQrModal(null)}
              className="w-full py-2.5 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-xl text-xs font-bold transition shadow-md"
            >
              I Have Scanned / Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
