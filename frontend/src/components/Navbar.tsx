import React from 'react';
import {
  Users,
  Send,
  BarChart3,
  PhoneCall,
  Wallet,
  Plus,
  Zap,
  AlertCircle,
  Sun,
} from 'lucide-react';

export type BeforeTabId = 'crm' | 'campaigns' | 'reports' | 'numbers' | 'wallet';

interface NavItem {
  id: BeforeTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isWalletBadge?: boolean;
}

interface NavbarProps {
  currentTab: BeforeTabId;
  onSelectTab: (tab: BeforeTabId) => void;
  walletBalanceINR: string;
  activeCampaignsCount: number;
  contactsCount?: number;
  onOpenQuickCampaign: () => void;
  isOnline?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  walletBalanceINR,
  activeCampaignsCount,
  contactsCount,
  onOpenQuickCampaign,
  isOnline = false,
}) => {
  // ONLY the 5 tabs from before
  const navItems: NavItem[] = [
    {
      id: 'crm',
      label: 'Contacts',
      icon: Users,
      badge: contactsCount !== undefined ? `${contactsCount}` : undefined,
    },
    {
      id: 'campaigns',
      label: 'Campaigns',
      icon: Send,
      badge: activeCampaignsCount > 0 ? `${activeCampaignsCount}` : undefined,
    },
    {
      id: 'reports',
      label: 'Delivery Reports',
      icon: BarChart3,
    },
    {
      id: 'numbers',
      label: 'Virtual Numbers',
      icon: PhoneCall,
    },
    {
      id: 'wallet',
      label: 'Wallet',
      icon: Wallet,
      badge: `₹${walletBalanceINR}`,
      isWalletBadge: true,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Official salesbuster.ai Brand Logo */}
          <div
            className="flex items-center cursor-pointer shrink-0 select-none py-1"
            onClick={() => onSelectTab('crm')}
          >
            <img
              src="/logo.png"
              alt="salesbuster.ai"
              className="h-8 md:h-9 w-auto object-contain hover:opacity-90 transition-opacity"
            />
          </div>

          {/* Navigation Links: ONLY the 5 before tabs */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5 shrink-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#e8f7fa] text-[#00897b] font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? 'text-[#00897b]' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span className="whitespace-nowrap select-none">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold whitespace-nowrap shrink-0 ${
                        item.isWalletBadge
                          ? 'bg-[#e6fffa] text-[#00a79d] border border-[#99f6e4]'
                          : isActive
                          ? 'bg-[#00897b] text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Section Actions */}
          <div className="flex items-center space-x-2.5 shrink-0">
            {/* Live Handset Status */}
            {isOnline && (
              <div
                onClick={() => onSelectTab('numbers')}
                className="hidden lg:flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition"
                title="WhatsApp Handset Connected"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>+91 Handset Linked</span>
              </div>
            )}

            {/* Instant Support */}
            <a
              href="https://wa.me/918897727709?text=Hi%20SalesBuster%20Team%2C%20I%20need%20assistance"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#00897b] bg-[#e6fffa]/80 hover:bg-[#e6fffa] border border-[#99f6e4] transition shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5 fill-[#00b493] text-[#00b493]" />
              <span>Instant Support</span>
            </a>

            {/* Primary Action: New Campaign Button */}
            <button
              onClick={onOpenQuickCampaign}
              className="px-3.5 py-1.5 bg-[#00b493] hover:bg-[#009e81] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ New Campaign</span>
            </button>

            {/* User Avatar Circle */}
            <div
              className="w-8 h-8 rounded-full bg-[#0f172a] text-white flex items-center justify-center text-xs font-bold shadow-xs select-none ring-2 ring-slate-100"
              title="Admin User (IN)"
            >
              IN
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar (visible on mobile screens) */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-100 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-[#e8f7fa] text-[#00897b] font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
