import React, { useState } from 'react';
import { Campaign, MessageLog } from '../types';
import {
  BarChart3,
  CheckCheck,
  Clock,
  AlertCircle,
  Pause,
  Play,
  RotateCw,
  Send,
  Eye,
  Check,
  ShieldCheck,
  Phone,
  Layers,
} from 'lucide-react';

interface DeliveryReportsViewProps {
  campaigns: Campaign[];
  messages: MessageLog[];
  onPauseCampaign?: (campaignId: string) => void;
  onResumeCampaign?: (campaignId: string) => void;
}

export const DeliveryReportsView: React.FC<DeliveryReportsViewProps> = ({
  campaigns,
  messages,
  onPauseCampaign,
  onResumeCampaign,
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    campaigns[0]?.id || '',
  );
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const activeCampaign = campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0];

  const campaignMessages = activeCampaign
    ? messages.filter((m) => m.campaignId === activeCampaign.id)
    : messages;

  const filteredMessages = statusFilter === 'ALL'
    ? campaignMessages
    : campaignMessages.filter((m) => m.status === statusFilter);

  // Overall aggregates
  const totalSent = activeCampaign ? activeCampaign.sentCount : messages.filter((m) => m.status !== 'QUEUED').length;
  const totalDelivered = activeCampaign ? activeCampaign.deliveredCount : messages.filter((m) => m.status === 'DELIVERED' || m.status === 'READ').length;
  const totalRead = activeCampaign ? activeCampaign.readCount : messages.filter((m) => m.status === 'READ').length;
  const totalFailed = activeCampaign ? activeCampaign.failedCount : messages.filter((m) => m.status === 'FAILED').length;
  const totalTarget = activeCampaign ? activeCampaign.totalContacts : messages.length;

  const deliveryRate = totalTarget > 0 ? Math.round((totalDelivered / totalTarget) * 100) : 0;
  const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* View Header & Campaign Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#128C7E]" />
            Real-Time Campaign Delivery Reports
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Track live dispatch status, delivery confirmation webhooks, and read receipts from Meta WhatsApp.
          </p>
        </div>

        {/* Campaign Selector dropdown */}
        {campaigns.length > 0 && (
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold text-slate-500">Selected Campaign:</span>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-semibold bg-white text-slate-800 focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
            >
              {campaigns.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  {camp.name} ({camp.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Target */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Target Contacts</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{totalTarget}</div>
          <div className="text-xs text-slate-500 mt-1">Escrow: ₹{activeCampaign?.reservedINR || '0.00'}</div>
        </div>

        {/* Sent / Dispatched */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 text-xs font-semibold uppercase">
            <span>Dispatched</span>
            <Send className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-indigo-950 mt-2">{totalSent}</div>
          <div className="text-xs text-indigo-600 font-medium mt-1">Queued via BullMQ</div>
        </div>

        {/* Delivered */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold uppercase">
            <span>Delivered</span>
            <Check className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-950 mt-2">{totalDelivered}</div>
          <div className="text-xs text-emerald-600 font-medium mt-1">{deliveryRate}% delivery rate</div>
        </div>

        {/* Read Receipts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-[#128C7E] text-xs font-semibold uppercase">
            <span>Read / Viewed</span>
            <CheckCheck className="w-4 h-4 text-[#25D366]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{totalRead}</div>
          <div className="text-xs text-teal-700 font-medium mt-1">{readRate}% engagement</div>
        </div>

        {/* Failed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 text-xs font-semibold uppercase">
            <span>Failed / Bounced</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-rose-950 mt-2">{totalFailed}</div>
          <div className="text-xs text-rose-600 font-medium mt-1">
            {totalFailed > 0 ? 'Non-WhatsApp or opted out' : 'Zero failures'}
          </div>
        </div>
      </div>

      {/* Campaign Progress Bar Card */}
      {activeCampaign && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                  activeCampaign.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : activeCampaign.status === 'SENDING'
                    ? 'bg-blue-100 text-blue-800 animate-pulse'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                ● {activeCampaign.status}
              </span>
              <span className="text-sm font-bold text-slate-800">{activeCampaign.name}</span>
              <span className="text-xs text-slate-500 font-mono">
                via {activeCampaign.senderNumber}
              </span>
            </div>

            <div className="text-xs text-slate-500">
              Template: <span className="font-semibold text-slate-700">{activeCampaign.templateName}</span> • Debited: ₹{activeCampaign.actualCostINR}
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${deliveryRate}%` }}
              className="bg-emerald-500 transition-all duration-500"
              title={`Delivered: ${deliveryRate}%`}
            />
            <div
              style={{ width: `${Math.max(0, (totalSent - totalDelivered) / (totalTarget || 1) * 100)}%` }}
              className="bg-indigo-400 transition-all duration-500"
              title="Dispatched / In-Transit"
            />
          </div>
        </div>
      )}

      {/* Message-by-Message Activity Log */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-800">
              Dispatch Logs ({filteredMessages.length})
            </h3>
            <span className="text-xs text-slate-500">• Auto-refreshes with Webhook delivery receipts</span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5 text-xs">
            {['ALL', 'DELIVERED', 'READ', 'SENT', 'QUEUED', 'FAILED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  statusFilter === st
                    ? 'bg-[#128C7E] text-white'
                    : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-400 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Recipient</th>
                <th className="px-6 py-3.5">Phone Number (+91)</th>
                <th className="px-6 py-3.5">Delivery Status</th>
                <th className="px-6 py-3.5">Provider Message ID (WABA)</th>
                <th className="px-6 py-3.5">Cost</th>
                <th className="px-6 py-3.5 text-right">Timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMessages.map((msg) => {
                let badgeClass = 'bg-slate-100 text-slate-700';
                let Icon = Clock;

                if (msg.status === 'READ') {
                  badgeClass = 'bg-teal-50 text-teal-700 border border-teal-200';
                  Icon = CheckCheck;
                } else if (msg.status === 'DELIVERED') {
                  badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                  Icon = Check;
                } else if (msg.status === 'SENT') {
                  badgeClass = 'bg-indigo-50 text-indigo-700 border border-indigo-200';
                  Icon = Send;
                } else if (msg.status === 'FAILED') {
                  badgeClass = 'bg-rose-50 text-rose-700 border border-rose-200';
                  Icon = AlertCircle;
                }

                return (
                  <tr key={msg.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900">{msg.contactName}</td>
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-600">
                      {msg.phoneNumber}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold ${badgeClass}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {msg.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-slate-500 max-w-xs truncate">
                      {msg.providerMessageId || 'Pending Queue...'}
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-700">₹{msg.costINR}</td>
                    <td className="px-6 py-3.5 text-right text-xs text-slate-500">
                      {msg.readAt
                        ? `Read at ${msg.readAt}`
                        : msg.deliveredAt
                        ? `Delivered at ${msg.deliveredAt}`
                        : msg.sentAt
                        ? `Sent at ${msg.sentAt}`
                        : 'Queued'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
