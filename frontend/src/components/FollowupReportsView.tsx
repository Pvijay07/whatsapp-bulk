import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api';
import { Bot, RefreshCw, Play, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface DispatchReport {
  id: string;
  orgName?: string;
  leadName?: string;
  phone: string;
  stage: string;
  attemptNumber: number;
  messageText: string;
  senderNumber?: string;
  deliveryStatus: string;
  errorMessage?: string;
  sentAt: string;
}

interface SummaryItem {
  stage: string;
  deliveryStatus: string;
  count: number;
}

const STAGE_LABELS: Record<string, string> = {
  new_lead: 'New Lead Auto Msg',
  not_attended: 'Not Attended (>24h)',
  followup: 'Scheduled Follow-up',
  not_responding: 'Not Responding (5x)',
  marketing_drip: '15-Day Marketing',
};

export const FollowupReportsView: React.FC = () => {
  const [reports, setReports] = useState<DispatchReport[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [mongoConfigured, setMongoConfigured] = useState<boolean>(true);
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(false);
  const [running, setRunning] = useState<boolean>(false);
  const [runStatus, setRunStatus] = useState<string>('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/salesbuster-followups/reports', {
        params: { stage: stageFilter, limit: 150 },
      });
      setReports(res.data?.reports || []);
      setSummary(res.data?.summary || []);
      setMongoConfigured(Boolean(res.data?.mongoConfigured));
    } catch (err: any) {
      console.error('Failed to load SalesBuster follow-up reports', err);
    } finally {
      setLoading(false);
    }
  }, [stageFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleRunNow = async () => {
    setRunning(true);
    setRunStatus('');
    try {
      const res = await apiClient.post('/salesbuster-followups/run-now', {}, { timeout: 120000 });
      if (res.data?.success) {
        setRunStatus(
          `Synced ${res.data.evaluatedLeads} leads: ${res.data.sentCount} sent, ${res.data.failedCount} failed, ${res.data.skippedCount} skipped.`,
        );
        await fetchReports();
      } else {
        setRunStatus(res.data?.message || 'Unable to run follow-up sync.');
      }
    } catch (err: any) {
      setRunStatus(err.response?.data?.message || err.message || 'Sync failed.');
    } finally {
      setRunning(false);
    }
  };

  const totalSent = summary
    .filter((s) => s.deliveryStatus === 'SENT')
    .reduce((acc, s) => acc + s.count, 0);
  const totalFailed = summary
    .filter((s) => s.deliveryStatus === 'FAILED')
    .reduce((acc, s) => acc + s.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#128C7E]" />
            SalesBuster AI Follow-ups & 15-Day Marketing
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Reads leads from SalesBuster MongoDB (read-only), sends via Petsfolio WhatsApp, and stores reports in PostgreSQL.
          </p>
          {!mongoConfigured && (
            <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg mt-2 inline-block">
              Set SALESBUSTER_MONGO_URI in backend/.env to enable automatic MongoDB lead polling.
            </p>
          )}
          {runStatus && (
            <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg mt-2 inline-block">
              {runStatus}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium bg-white text-slate-800"
          >
            <option value="ALL">All Stages</option>
            {Object.entries(STAGE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <button
            onClick={fetchReports}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleRunNow}
            disabled={running}
            className="px-4 py-2 rounded-xl bg-[#128C7E] hover:bg-[#0e7266] text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Play className="w-4 h-4" />
            {running ? 'Running...' : 'Run Sync Now'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80">
          <div className="text-xs font-semibold text-slate-500 uppercase">Total Dispatched</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            {totalSent}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80">
          <div className="text-xs font-semibold text-slate-500 uppercase">Failed Attempts</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            {totalFailed}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80">
          <div className="text-xs font-semibold text-slate-500 uppercase">Active Cadence</div>
          <div className="text-sm font-semibold text-slate-700 mt-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#128C7E]" />
            PostgreSQL State + 15-Day Drip Active
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3 px-4">Lead</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Attempt</th>
                <th className="py-3 px-4">Message</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    {loading ? 'Loading PostgreSQL reports...' : 'No follow-up dispatch reports recorded yet.'}
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{r.leadName || 'Lead'}</div>
                      <div className="text-xs text-slate-500">{r.phone}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                        {STAGE_LABELS[r.stage] || r.stage}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">#{r.attemptNumber}</td>
                    <td className="py-3 px-4 max-w-md truncate text-slate-600" title={r.messageText}>
                      {r.messageText}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          r.deliveryStatus === 'SENT'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {r.deliveryStatus}
                      </span>
                      {r.errorMessage && (
                        <div className="text-[11px] text-rose-600 mt-1 max-w-xs truncate" title={r.errorMessage}>
                          {r.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(r.sentAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
