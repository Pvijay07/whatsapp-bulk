import React, { useState } from 'react';
import {
  Users,
  Megaphone,
  BarChart3,
  PhoneCall,
  Wallet,
  Headphones,
  HelpCircle,
  ChevronDown,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

export type AppTabId = 'crm' | 'campaigns' | 'reports' | 'numbers' | 'wallet' | 'support';

interface SidebarProps {
  currentTab: AppTabId;
  onSelectTab: (tab: AppTabId) => void;
  contactsCount?: number;
  activeCampaignsCount?: number;
  walletBalanceINR?: string;
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  contactsCount,
  activeCampaignsCount,
  walletBalanceINR,
  userName = 'Admin info',
  userEmail = 'info@sibestce.in',
  onLogout,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

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

      {/* Bottom Area: Support link & User Profile with Logout */}
      <div className="p-3 border-t border-[#152336] space-y-2 relative">
        {/* Support Help link */}
        <button
          onClick={() => onSelectTab('support')}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-[#121f31] transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>Support</span>
        </button>

        {/* User Profile Card */}
        <div
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center justify-between p-2 rounded-xl hover:bg-[#121f31] transition-colors cursor-pointer group relative"
          title="Click to view profile & logout"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
              <span className="text-[11px]">AI</span>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{userName}</div>
              <div className="text-[10px] text-slate-400 truncate">{userEmail}</div>
            </div>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 shrink-0 transition-transform ${
              showUserMenu ? 'rotate-180' : ''
            }`}
          />
        </div>

        {/* Logout Popover Menu */}
        {showUserMenu && (
          <div className="absolute bottom-16 left-3 right-3 bg-[#111e30] border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150 z-40">
            <div className="px-2 py-1">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Super Administrator</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{userEmail}</div>
            </div>

            <div className="border-t border-slate-800 pt-1">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  onLogout?.();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-500/20 transition-all text-left"
              >
                <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

