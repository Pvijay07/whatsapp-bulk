import React, { useState } from 'react';
import { AutoResponderRule } from '../types';
import {
  Bot,
  Plus,
  Power,
  Trash2,
  Sparkles,
  MessageSquare,
  Zap,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

interface AutoResponderViewProps {
  rules: AutoResponderRule[];
  onToggleRule: (id: string) => void;
  onAddRule: (rule: Omit<AutoResponderRule, 'id' | 'triggerCount'>) => void;
  onDeleteRule: (id: string) => void;
}

export const AutoResponderView: React.FC<AutoResponderViewProps> = ({
  rules,
  onToggleRule,
  onAddRule,
  onDeleteRule,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [replyText, setReplyText] = useState('');
  const [matchType, setMatchType] = useState<'EXACT' | 'CONTAINS'>('CONTAINS');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword || !replyText) return;

    onAddRule({
      keyword: keyword.toUpperCase().trim(),
      matchType,
      replyText,
      isActive: true,
    });

    setKeyword('');
    setReplyText('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#128C7E]" />
            Auto-Responder & Keyword Bots
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Automate 24/7 instant replies when recipients reply to your virtual WhatsApp numbers.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-900/20 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Auto-Reply Rule
        </button>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`p-5 rounded-2xl border transition-all ${
              rule.isActive
                ? 'bg-white border-slate-200/80 shadow-xs'
                : 'bg-slate-50 border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-emerald-50 text-[#075E54] border border-emerald-200">
                <Zap className="w-3.5 h-3.5 text-[#25D366]" />
                {rule.keyword}
              </span>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => onToggleRule(rule.id)}
                  className={`p-1.5 rounded-lg text-xs font-bold transition ${
                    rule.isActive ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-200'
                  }`}
                  title={rule.isActive ? 'Active (Click to pause)' : 'Paused (Click to activate)'}
                >
                  <Power className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRule(rule.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  title="Delete rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 min-h-[70px] leading-relaxed">
              &ldquo;{rule.replyText}&rdquo;
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Match: <strong>{rule.matchType}</strong></span>
              <span>Triggered: <strong>{rule.triggerCount} times</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#128C7E]" />
              New Auto-Responder Rule
            </h3>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trigger Keyword (e.g. PRICE, DEMO, MENU, ADDRESS)
                </label>
                <input
                  type="text"
                  required
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. DISCOUNT"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Match Type
                </label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="CONTAINS">Contains keyword in message</option>
                  <option value="EXACT">Exact keyword match only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Automated WhatsApp Reply Text
                </label>
                <textarea
                  required
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type the message that will be automatically sent back to the customer..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-lg text-sm font-semibold"
                >
                  Activate Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
