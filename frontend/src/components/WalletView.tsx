import React, { useState } from 'react';
import { WalletData, WalletTransaction } from '../types';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  PlusCircle,
  CreditCard,
  History,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface WalletViewProps {
  wallet: WalletData;
  onTopUp: (amountINR: number) => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ wallet, onTopUp }) => {
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [customAmount, setCustomAmount] = useState('1000');

  const presets = [500, 1000, 2500, 5000];

  const handleRecharge = (amount: number) => {
    onTopUp(amount);
    setShowTopUpModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-[#128C7E]" />
            Prepaid Wallet & Financial Ledger
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            All balances are computed in exact integer paise to eliminate rounding errors. Real-time campaign escrow holds and settlements.
          </p>
        </div>

        <button
          onClick={() => setShowTopUpModal(true)}
          className="px-4 py-2 bg-[#25D366] hover:bg-[#1da851] text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2 active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          Recharge Wallet (UPI / Cards)
        </button>
      </div>

      {/* Financial Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Wallet Balance */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Total Balance</span>
            <Wallet className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            ₹{wallet.balanceINR}
          </div>
          <div className="text-xs text-slate-400 mt-1">Stored in paise (no floating errors)</div>
        </div>

        {/* Reserved in Escrow */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 text-xs font-semibold uppercase">
            <span>Reserved in Escrow</span>
            <Lock className="w-5 h-5" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            ₹{wallet.reservedINR}
          </div>
          <div className="text-xs text-amber-600 font-medium mt-1">Held during active bulk dispatches</div>
        </div>

        {/* Available to Spend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold uppercase">
            <span>Available to Spend</span>
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-700 mt-2">
            ₹{wallet.availableINR}
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1">
            Ready for new campaigns
          </div>
        </div>
      </div>

      {/* Immutable Transaction Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            Double-Entry Transaction Ledger ({wallet.transactions.length})
          </h3>
          <span className="text-xs text-slate-500">Immutable ledger records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5">Description</th>
                <th className="px-6 py-3.5">Idempotency Key</th>
                <th className="px-6 py-3.5">Amount (INR)</th>
                <th className="px-6 py-3.5 text-right">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wallet.transactions.map((tx) => {
                const isCredit = tx.transactionType === 'CREDIT';
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 text-xs text-slate-500">{tx.createdAt}</td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          isCredit
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-800">{tx.reason}</td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-slate-400">
                      {tx.idempotencyKey}
                    </td>
                    <td
                      className={`px-6 py-3.5 font-bold ${
                        isCredit ? 'text-emerald-600' : 'text-slate-800'
                      }`}
                    >
                      {tx.amountINR}
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-slate-900">
                      ₹{tx.balanceAfterINR}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top-up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Recharge Prepaid Wallet
            </h3>
            <p className="text-xs text-slate-500">
              Select an instant recharge amount via Cashfree / UPI Gateway. Wallet will be credited immediately upon confirmation.
            </p>

            {/* Presets */}
            <div className="grid grid-cols-2 gap-2.5">
              {presets.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setCustomAmount(amt.toString())}
                  className={`py-2.5 px-3 rounded-xl border text-sm font-bold transition ${
                    customAmount === amt.toString()
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  ₹{amt.toLocaleString('en-IN')}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custom Recharge Amount (₹)
              </label>
              <input
                type="number"
                min="100"
                step="50"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTopUpModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRecharge(parseFloat(customAmount) || 1000)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold"
              >
                Confirm & Pay ₹{customAmount}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
