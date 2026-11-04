import React, { useState } from 'react';
import { VirtualNumber } from '../types';
import {
  PhoneCall,
  ShieldCheck,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  Building2,
  AlertCircle,
  QrCode,
  Radio,
  Wifi,
} from 'lucide-react';

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

      {/* Info Callout */}
      <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-xl flex items-start space-x-3 text-xs text-emerald-950">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Virtual Multi-Session Gateway Architecture</div>
          <div className="text-emerald-800 mt-0.5 leading-relaxed">
            All virtual numbers operate through high-availability multi-device sessions. Messages are dispatched directly with anti-ban delay throttling and Spintax variation &mdash; no Meta developer accounts or template approvals required.
          </div>
        </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center space-y-4">
            <h3 className="text-base font-bold text-slate-900">Virtual Session Sync</h3>
            <p className="text-xs text-slate-500">
              Virtual Number: <strong className="font-mono text-slate-800">{showQrModal.phoneNumber}</strong>
            </p>

            {/* Mock QR display */}
            <div className="w-48 h-48 mx-auto bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-4">
              <QrCode className="w-24 h-24 text-slate-800" />
              <span className="text-[11px] text-emerald-700 font-bold mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Session Synchronized
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Multi-Device session is active and authenticated through your cloud virtual gateway.
            </p>

            <button
              type="button"
              onClick={() => setShowQrModal(null)}
              className="w-full py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
