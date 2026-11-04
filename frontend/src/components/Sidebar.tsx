import React from 'react';
import {
  Users,
  Send,
  BarChart3,
  PhoneCall,
  Wallet,
  ShieldCheck,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  currentTab: 'crm' | 'campaigns' | 'reports' | 'numbers' | 'wallet';
  onSelectTab: (tab: 'crm' | 'campaigns' | 'reports' | 'numbers' | 'wallet') => void;
  walletBalanceINR: string;
  activeCampaignsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  walletBalanceINR,
  activeCampaignsCount,
}) => {
  const menuItems = [
    {
      id: 'crm',
      label: 'CRM & Contacts',
      icon: Users,
      badge: '5 Contacts',
    },
    {
      id: 'campaigns',
      label: 'WhatsApp Campaigns',
      icon: Send,
      badge: activeCampaignsCount > 0 ? `${activeCampaignsCount} Active` : undefined,
    },
    {
      id: 'reports',
      label: 'Delivery Reports',
      icon: BarChart3,
    },
    {
      id: 'numbers',
      label: 'Indian Virtual Numbers',
      icon: PhoneCall,
      badge: '+91 Live',
    },
    {
      id: 'wallet',
      label: 'Wallets & Payments',
      icon: Wallet,
      badge: `₹${walletBalanceINR}`,
      badgeHighlight: true,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 h-screen sticky top-0 border-r border-slate-800">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              WhatsApp SaaS
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-1.5 py-0.2 rounded border border-emerald-500/30">
                +91
              </span>
            </h1>
            <p className="text-xs text-slate-400">Enterprise Cloud Platform</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Main Workspace
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id as any)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#128C7E] text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                      item.badgeHighlight
                        ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                        : isActive
                        ? 'bg-black/20 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tenant Organization Footer Card */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Tenant:</span>
            <span className="text-xs font-semibold text-white">Demo Enterprises India</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Prepaid Wallet:</span>
            <span className="text-xs font-bold text-emerald-400">₹{walletBalanceINR}</span>
          </div>
          <div className="pt-1 border-t border-slate-700/50 flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Meta Cloud API & TRAI Compliant
          </div>
        </div>
      </div>
    </aside>
  );
};
