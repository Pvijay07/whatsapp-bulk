import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api';
import {
  Bot,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sliders,
  Save,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';

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

type FollowupStageKey =
  | 'new_lead'
  | 'not_attended'
  | 'followup'
  | 'not_responding'
  | 'marketing_drip';

interface FollowupConfig {
  mode: 'TEMPLATE' | 'AI_PLUS_TEMPLATE';
  dispatchType: 'MULTI_NUMBER_POOL' | 'DEDICATED_NUMBER';
  senderNumber: string;
  delayIntervalSec: number;
  batchCooldownAfter: number;
  batchCooldownSec: number;
  spintaxEnabled: boolean;
  buttonEnabled: boolean;
  buttonText: string;
  buttonValue: string;
  stageTemplates: Record<FollowupStageKey, string>;
}

const STAGE_LABELS: Record<string, string> = {
  new_lead: 'New Lead Auto Msg',
  not_attended: 'Not Attended (>24h)',
  followup: 'Scheduled Follow-up',
  not_responding: 'Not Responding (5x)',
  marketing_drip: '15-Day Marketing',
};

const PETSFOLIO_MASTER_SPINTAX =
  "{Hi|Hello|Dear} Pet Parent! {🐾|🐶|❤️|🐕}\n{Looking for Walking, Grooming, Training or Pet Sitting services? Book your pet's favourite service with Petsfolio today!|Give your furry friend the care they deserve with Petsfolio. 📲 Explore our services now!|Busy with your daily schedule? Petsfolio is here to take care of your furry friend. 🐾 Book your service today!|From daily walks to grooming, training and sitting, Petsfolio makes pet care easier. 📲 Book Now!|Happy pets begin with quality care. Discover convenient pet care services with Petsfolio. 📲 Open the Petsfolio App & Book Today!}";

export const FollowupReportsView: React.FC = () => {
  const [reports, setReports] = useState<DispatchReport[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [mongoConfigured, setMongoConfigured] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(false);
  const [running, setRunning] = useState<boolean>(false);
  const [runStatus, setRunStatus] = useState<string>('');

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [config, setConfig] = useState<FollowupConfig | null>(null);
  const [editingStage, setEditingStage] = useState<FollowupStageKey>('new_lead');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [configMsg, setConfigMsg] = useState<string>('');

  const [scanning, setScanning] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [dueLeads, setDueLeads] = useState<
    Array<{
      key: string;
      orgName: string;
      leadName: string;
      phone: string;
      service: string;
      stage: string;
      nextAttempt: number;
    }>
  >([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [previewMeta, setPreviewMeta] = useState<{
    totalEvaluated: number;
    onlineSimsCount: number;
    maxPerSimCap: number;
  }>({ totalEvaluated: 0, onlineSimsCount: 0, maxPerSimCap: 30 });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/salesbuster-followups/reports', {
        params: { stage: stageFilter, limit: 150 },
      });
      setReports(res.data?.reports || []);
      setSummary(res.data?.summary || []);
      setMongoConfigured(Boolean(res.data?.mongoConfigured));
      setIsRunning(Boolean(res.data?.isRunning));
    } catch (err: any) {
      console.error('Failed to load SalesBuster follow-up reports', err);
    } finally {
      setLoading(false);
    }
  }, [stageFilter]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await apiClient.get('/salesbuster-followups/config');
      if (res.data) setConfig(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchReports();
    fetchConfig();
  }, [fetchReports, fetchConfig]);

  // Auto-poll every 4s while background follow-up dispatch is running
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      fetchReports();
    }, 4000);
    return () => clearInterval(timer);
  }, [isRunning, fetchReports]);

  const handleScanDueLeads = async () => {
    setScanning(true);
    setRunStatus('');
    try {
      const res = await apiClient.get('/salesbuster-followups/preview', { timeout: 60000 });
      if (res.data?.success) {
        const list = res.data.dueLeads || [];
        setDueLeads(list);
        const cap = Math.max(1, res.data.onlineSimsCount || 1) * (res.data.maxPerSimCap || 30);
        setSelectedKeys(new Set(list.slice(0, cap).map((l: any) => l.key)));
        setPreviewMeta({
          totalEvaluated: res.data.totalEvaluated || 0,
          onlineSimsCount: res.data.onlineSimsCount || 0,
          maxPerSimCap: res.data.maxPerSimCap || 30,
        });
        setShowPreview(true);
        setRunStatus(
          list.length > 0
            ? `Found ${list.length} due contact(s) out of ${res.data.totalEvaluated} evaluated. Review & click "Process Selected" to send.`
            : `Scanned ${res.data.totalEvaluated || 0} leads — no contacts are due for follow-up right now.`,
        );
      } else {
        setRunStatus(res.data?.message || 'Unable to scan due leads.');
      }
    } catch (err: any) {
      setRunStatus(err.response?.data?.message || err.message || 'Preview scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const handleProcessSelected = async () => {
    if (selectedKeys.size === 0) return;
    setRunning(true);
    setRunStatus('');
    try {
      const res = await apiClient.post(
        '/salesbuster-followups/run-now',
        { selectedKeys: Array.from(selectedKeys) },
        { timeout: 30000 },
      );
      if (res.data?.success) {
        setIsRunning(Boolean(res.data.isRunning ?? true));
        setShowPreview(false);
        setRunStatus(
          res.data.message ||
            `Follow-up dispatch started for ${selectedKeys.size} selected contact(s).`,
        );
        await fetchReports();
      } else {
        setRunStatus(res.data?.message || 'Unable to start follow-up dispatch.');
      }
    } catch (err: any) {
      setRunStatus(err.response?.data?.message || err.message || 'Sync failed.');
    } finally {
      setRunning(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    setConfigMsg('');
    try {
      const res = await apiClient.post('/salesbuster-followups/config', config);
      if (res.data?.success) {
        setConfig(res.data.config);
        setConfigMsg('✅ Campaign template & pacing settings saved.');
      }
    } catch (err: any) {
      setConfigMsg(`❌ ${err.response?.data?.message || err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleStopNow = async () => {
    try {
      const res = await apiClient.post('/salesbuster-followups/stop');
      setIsRunning(false);
      setRunStatus(res.data?.message || '🛑 Follow-up dispatch stopped.');
      await fetchReports();
    } catch (err: any) {
      setRunStatus(err.response?.data?.message || err.message || 'Failed to stop.');
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Clear all SalesBuster follow-up reports and lead states from PostgreSQL?')) return;
    try {
      const res = await apiClient.post('/salesbuster-followups/clear');
      if (res.data?.success) {
        setRunStatus(
          `🧹 Cleared ${res.data.deletedReports} reports and ${res.data.deletedStates} lead states.`,
        );
        await fetchReports();
      }
    } catch (err: any) {
      setRunStatus(err.response?.data?.message || err.message || 'Failed to clear.');
    }
  };

  const totalSent = summary
    .filter((s) => ['SENT', 'DELIVERED', 'READ'].includes(s.deliveryStatus))
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
            SalesBuster Follow-ups & 15-Day Marketing
            {isRunning && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 animate-pulse">
                ● Dispatching in Background
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Sends using Campaign Spintax Templates, Multi-SIM Pool rotation, 25–30s Gaussian pacing, Coffee Break & WhatsApp Now CTA.
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

        <div className="flex items-center gap-2 flex-wrap">
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
            onClick={() => setShowSettings((s) => !s)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-[#128C7E]" />
            Templates & Pacing
          </button>

          <button
            onClick={fetchReports}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {isRunning ? (
            <button
              onClick={handleStopNow}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Square className="w-4 h-4" />
              Stop Dispatch
            </button>
          ) : (
            <button
              onClick={handleScanDueLeads}
              disabled={scanning || running}
              className="px-4 py-2 rounded-xl bg-[#128C7E] hover:bg-[#0e7266] text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning Due Leads...' : 'Run Sync Now (Preview)'}
            </button>
          )}

          <button
            onClick={handleClearData}
            title="Clear all follow-up reports & states from PostgreSQL"
            className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Step 1 Preview: Due Follow-up Contacts Waiting for Confirmation */}
      {showPreview && (
        <div className="bg-white rounded-2xl border-2 border-[#128C7E]/40 shadow-sm overflow-hidden">
          <div className="p-4 bg-emerald-50/70 border-b border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                Contacts Requiring Follow-up ({dueLeads.length} Due • {selectedKeys.size} Selected)
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Online SIMs: <b>{previewMeta.onlineSimsCount}</b> • Safe Cap: <b>{previewMeta.maxPerSimCap} contacts/SIM</b> • No messages sent yet until you click Process.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  setSelectedKeys(
                    selectedKeys.size === dueLeads.length
                      ? new Set()
                      : new Set(dueLeads.map((l) => l.key)),
                  )
                }
                className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-900 text-xs font-semibold cursor-pointer"
              >
                {selectedKeys.size === dueLeads.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessSelected}
                disabled={selectedKeys.size === 0 || running}
                className="px-4 py-1.5 rounded-lg bg-[#075E54] hover:bg-[#128C7E] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {running ? 'Starting...' : `Process Selected (${selectedKeys.size})`}
              </button>
            </div>
          </div>

          {dueLeads.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No contacts currently require follow-up.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4 w-10"></th>
                    <th className="py-2.5 px-3 w-12 text-center">S.No</th>
                    <th className="py-2.5 px-4">Lead Name</th>
                    <th className="py-2.5 px-4">Phone</th>
                    <th className="py-2.5 px-4">Service</th>
                    <th className="py-2.5 px-4">Stage</th>
                    <th className="py-2.5 px-4">Attempt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dueLeads.map((lead, idx) => {
                    const checked = selectedKeys.has(lead.key);
                    return (
                      <tr
                        key={lead.key}
                        onClick={() => {
                          const next = new Set(selectedKeys);
                          if (checked) next.delete(lead.key);
                          else next.add(lead.key);
                          setSelectedKeys(next);
                        }}
                        className={`cursor-pointer hover:bg-emerald-50/40 ${checked ? 'bg-emerald-50/20' : ''}`}
                      >
                        <td className="py-2.5 px-4">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            className="w-4 h-4 accent-[#128C7E]"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-xs text-slate-400">
                          #{idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{lead.leadName}</td>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{lead.phone}</td>
                        <td className="py-2.5 px-4 text-xs text-slate-700">{lead.service}</td>
                        <td className="py-2.5 px-4">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {STAGE_LABELS[lead.stage] || lead.stage}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-xs font-semibold text-slate-700">
                          #{lead.nextAttempt}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Campaign-style Template & Anti-Ban Settings Panel */}
      {showSettings && config && (
        <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#128C7E]" />
                Campaign-Style Follow-up Templates & Anti-Ban Configuration
              </h3>
              <p className="text-xs text-slate-500">
                Use <code>{'{{1}}'}</code> for Lead Name, <code>{'{{service}}'}</code> for Service, and <code>{'{A|B}'}</code> for Spintax.
              </p>
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="px-4 py-2 rounded-xl bg-[#075E54] hover:bg-[#128C7E] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {savingConfig ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {configMsg && (
            <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
              {configMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Dispatch Mode</label>
              <select
                value={config.mode}
                onChange={(e) =>
                  setConfig({ ...config, mode: e.target.value as 'TEMPLATE' | 'AI_PLUS_TEMPLATE' })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="TEMPLATE">Campaign Templates + Spintax (Recommended)</option>
                <option value="AI_PLUS_TEMPLATE">Gemini AI + Template Fallback</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Sender Pool</label>
              <select
                value={config.dispatchType}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    dispatchType: e.target.value as 'MULTI_NUMBER_POOL' | 'DEDICATED_NUMBER',
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="MULTI_NUMBER_POOL">Multi-Number Pool (Round-Robin)</option>
                <option value="DEDICATED_NUMBER">Primary Number Only</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Gap Between Messages (~{config.delayIntervalSec}s)
              </label>
              <input
                type="number"
                min={18}
                max={90}
                value={config.delayIntervalSec}
                onChange={(e) =>
                  setConfig({ ...config, delayIntervalSec: Number(e.target.value) || 28 })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Coffee Break After (Msgs)
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={config.batchCooldownAfter}
                onChange={(e) =>
                  setConfig({ ...config, batchCooldownAfter: Number(e.target.value) || 15 })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              />
            </div>
          </div>

          {/* WhatsApp Now CTA Link */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.buttonEnabled}
                onChange={(e) => setConfig({ ...config, buttonEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#128C7E]"
              />
              <span className="font-bold text-slate-800">Attach "WhatsApp Now" Link</span>
            </div>
            <input
              type="text"
              value={config.buttonText}
              onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
              placeholder="Button Label (e.g. WhatsApp Now)"
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
            />
            <input
              type="text"
              value={config.buttonValue}
              onChange={(e) => setConfig({ ...config, buttonValue: e.target.value })}
              placeholder="Target Number (e.g. 917997887788)"
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
            />
          </div>

          {/* Stage Template Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(Object.keys(STAGE_LABELS) as FollowupStageKey[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setEditingStage(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      editingStage === st
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {STAGE_LABELS[st]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    stageTemplates: {
                      ...config.stageTemplates,
                      [editingStage]: PETSFOLIO_MASTER_SPINTAX,
                    },
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold cursor-pointer"
              >
                🐾 Load Petsfolio Master Spintax
              </button>
            </div>

            <textarea
              rows={4}
              value={config.stageTemplates[editingStage] || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  stageTemplates: {
                    ...config.stageTemplates,
                    [editingStage]: e.target.value,
                  },
                })
              }
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
            />
          </div>
        </div>
      )}

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
            Campaign Templates + 25–30s Pacing + Coffee Break
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3 px-4 text-center w-12">S.No</th>
                <th className="py-3 px-4">Lead</th>
                <th className="py-3 px-4">Dispatched Through</th>
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
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    {loading ? 'Loading PostgreSQL reports...' : 'No follow-up dispatch reports recorded yet.'}
                  </td>
                </tr>
              ) : (
                reports.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-slate-400">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{r.leadName || 'Lead'}</div>
                      <div className="text-xs text-slate-500 font-mono">{r.phone}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-950 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                        {r.senderNumber ? `+${r.senderNumber.replace(/^\+/, '')}` : 'Pool'}
                      </span>
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
                          r.deliveryStatus === 'READ'
                            ? 'bg-teal-50 text-teal-700 border border-teal-200'
                            : r.deliveryStatus === 'DELIVERED' || r.deliveryStatus === 'SENT'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
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
