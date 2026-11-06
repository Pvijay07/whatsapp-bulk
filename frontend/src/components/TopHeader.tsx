import React from 'react';
import {
  Zap,
  AlertCircle,
  Sun,
  Moon,
  Wallet,
  PhoneCall,
  CheckCircle2,
} from 'lucide-react';
import { NavTabId } from './Sidebar';

interface TopHeaderProps {
  currentTab: NavTabId;
  walletBalanceINR: string;
  isOnline?: boolean;
  connectedNumber?: string | null;
  onOpenQuickCampaign: () => void;
  onOpenWallet: () => void;
  onOpenVirtualNumbers: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTab,
  walletBalanceINR,
  isOnline = false,
  connectedNumber = null,
  onOpenQuickCampaign,
  onOpenWallet,
  onOpenVirtualNumbers,
}) => {
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  // Tab titles
  const getTabTitle = (tab: NavTabId): string => {
    switch (tab) {
      case 'crm':
        return 'Leads Repository';
      case 'dashboard':
        return 'Sales & Pipeline Overview';
      case 'campaigns':
        return 'WhatsApp Bulk Campaigns';
      case 'reports':
        return 'Live Delivery Reports';
      case 'numbers':
        return 'Virtual Numbers & WhatsApp Channels';
      case 'wallet':
        return 'Financial Wallet & Ledger';
      case 'chat':
        return 'WhatsApp Inbox & Live Chat';
      case 'followups':
        return 'AI Pipeline Followups';
      case 'events':
        return 'Events & Networking Outreach';
      case 'target-intel':
        return 'Target Lead Intelligence';
      case 'team-perf':
        return 'Team Sales Performance';
      case 'bi-analyst':
        return 'Business Intelligence Analyst';
      case 'test-ai':
        return 'Interactive AI Assistant Tester';
      case 'notifications':
        return 'System Alerts & Logs';
      case 'support':
        return 'Help Center & Documentation';
      default:
        return 'Leads Repository';
    }
  };

  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shadow-xs">
      {/* Breadcrumb / Page Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold text-slate-800 tracking-tight">
          {getTabTitle(currentTab)}
        </h1>
        {isOnline && connectedNumber && (
          <span
            onClick={onOpenVirtualNumbers}
            className="cursor-pointer hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            +91 Handset Linked
          </span>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Wallet Pill */}
        <button
          onClick={onOpenWallet}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200 transition-colors"
          title="View wallet & billing ledger"
        >
          <Wallet className="w-3.5 h-3.5 text-[#00897b]" />
          <span>₹{walletBalanceINR}</span>
        </button>

        {/* Instant Support Pill Button */}
        <a
          href="https://wa.me/918897727709?text=Hi%20SalesBuster%20Team%2C%20I%20need%20assistance"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#00897b] bg-[#e6fffa]/80 hover:bg-[#e6fffa] border border-[#99f6e4] transition-all shadow-2xs"
        >
          <Zap className="w-3.5 h-3.5 fill-[#00b493] text-[#00b493]" />
          <span>Instant Support</span>
        </a>

        {/* Report an Issue Pill Button */}
        <button
          onClick={() => {
            alert('Issue report submitted to salesbuster technical operations. We will look into it immediately.');
          }}
          className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-amber-700 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/80 transition-all shadow-2xs"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          <span>Report an Issue</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* User Avatar Circle */}
        <div
          className="w-8 h-8 rounded-full bg-[#0f172a] text-white flex items-center justify-center text-xs font-bold shadow-xs cursor-pointer select-none ring-2 ring-slate-100 hover:ring-[#00b493] transition-all"
          title="Demo Administrator (IN)"
        >
          IN
        </div>
      </div>
    </header>
  );
};
