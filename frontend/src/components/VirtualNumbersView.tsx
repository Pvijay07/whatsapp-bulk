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
  const [kycRef, setKycRef] = useState('KYC-CORP-2026-9012');

  const availableCatalog: VirtualNumber[] = [
    {
      id: `num-avail-${Date.now()}-1`,
      phoneNumber: '+918049100555',
      provider: 'Exotel Telephony',
      type: 'LANDLINE_DID',
      status: 'ACTIVE',
      monthlyRentalINR: '599.00',
      capabilities: { voice: true, sms: false, whatsappEligible: true },
      region: 'Bangalore (080) DID',
    },
    {
      id: `num-avail-${Date.now()}-2`,
      phoneNumber: '+912249100888',
      provider: 'Tata Tele Business',
      type: 'LANDLINE_DID',
      status: 'ACTIVE',
      monthlyRentalINR: '599.00',
      capabilities: { voice: true, sms: false, whatsappEligible: true },
      region: 'Mumbai (022) DID',
    },
    {
      id: `num-avail-${Date.now()}-3`,
      phoneNumber: '+919810099888',
      provider: 'Airtel IQ Business',
      type: 'MOBILE',
      status: 'ACTIVE',
      monthlyRentalINR: '799.00',
      capabilities: { voice: true, sms: true, whatsappEligible: true },
      region: 'Delhi NCR Mobile',
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
            Provision licensed Indian DIDs and virtual numbers compliant with TRAI / DoT CAF regulations.
          </p>
        </div>

        <button
          onClick={() => setShowBuyModal(true)}
          className="px-4 py-2 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-900/20 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Provision New +91 Number
        </button>
      </div>

      {/* Regulatory Info Callout */}
      <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-xl flex items-start space-x-3 text-xs text-emerald-950">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Indian Telecom Regulatory Compliance (DoT & TRAI)</div>
          <div className="text-emerald-800 mt-0.5 leading-relaxed">
            All virtual numbers are provisioned through licensed Class-A Telecom / Unified Access providers. Onboarding to Meta WhatsApp Cloud API is authenticated via single-use Voice OTP or SMS delivery to the registered endpoint.
          </div>
        </div>
      </div>

      {/* Numbers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {numbers.map((num) => (
          <div
            key={num.id}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                  {num.provider} • {num.type === 'LANDLINE_DID' ? 'Landline DID' : 'Mobile SIM'}
                </span>
                <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                  {num.phoneNumber}
                </div>
                <div className="text-xs text-slate-500">{num.region}</div>
              </div>

              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Active WABA
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Monthly Rental:</span>
                <div className="font-bold text-slate-800">₹{num.monthlyRentalINR}/month</div>
              </div>
              <div>
                <span className="text-slate-400">Meta OTP Capability:</span>
                <div className="font-bold text-emerald-700">
                  {num.capabilities.voice ? 'Voice Call OTP' : 'SMS OTP'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Buy Number Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-[#128C7E]" />
              Search & Provision Indian Number (+91)
            </h3>
            <p className="text-xs text-slate-500">
              Select an available Indian virtual number from licensed telco inventory. Rental fees are debited from your prepaid wallet.
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
                      Provision Number
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
    </div>
  );
};

