import React from 'react';
import {
  Users,
  Megaphone,
  BarChart3,
  PhoneCall,
  Wallet,
  Headphones,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';

export type AppTabId = 'crm' | 'campaigns' | 'reports' | 'numbers' | 'wallet' | 'support';

interface SidebarProps {
  currentTab: AppTabId;
  onSelectTab: (tab: AppTabId) => void;
  contactsCount?: number;
  activeCampaignsCount?: number;
  walletBalanceINR?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  contactsCount,
  activeCampaignsCount,
  walletBalanceINR,
}) => {
  const navItems = [
    {
      id: 'crm' as AppTabId,
      label: 'Contacts',
      icon: Users,
    },
    {
      id: 'campaigns' as AppTabId,
      label: 'Campaigns',
      icon: Megaphone,
    },
    {
      id: 'reports' as AppTabId,
      label: 'Delivery Reports',
      icon: BarChart3,
    },
    {
      id: 'numbers' as AppTabId,
      label: 'Virtual Numbers',
      icon: PhoneCall,
    },
    {
      id: 'wallet' as AppTabId,
      label: 'Wallet',
      icon: Wallet,
    },
    {
      id: 'support' as AppTabId,
      label: 'Support',
      icon: Headphones,
    },
  ];

  return (
    <aside className="w-56 bg-[#0b1727] text-white flex flex-col shrink-0 h-screen sticky top-0 border-r border-[#152336] select-none z-30">
      {/* Brand Logo Header */}
      <div
        className="h-16 px-5 flex items-center gap-2 cursor-pointer border-b border-[#152336]/60"
        onClick={() => onSelectTab('crm')}
      >
        <img
          src="/logo.png"
          alt="salesbuster.ai"
          className="h-7 w-auto object-contain brightness-0 invert"
        />
      </div>

      {/* Navigation Links: Exactly as in the screenshot */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                isActive
                  ? 'bg-[#1b283b] text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#121f31]'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Area: Support link & User Profile */}
      <div className="p-3 border-t border-[#152336] space-y-2">
        {/* Support Help link */}
        <button
          onClick={() => onSelectTab('support')}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-[#121f31] transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>Support</span>
        </button>

        {/* User Profile Card */}
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#121f31] transition-colors cursor-pointer group">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
              <span className="text-[11px]">AI</span>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">Admin info</div>
              <div className="text-[10px] text-slate-400 truncate">info@sibestce.in</div>
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 shrink-0" />
        </div>
      </div>
    </aside>
  );
};
