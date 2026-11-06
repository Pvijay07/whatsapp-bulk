import React from "react";
import {
  Users,
  Send,
  BarChart3,
  PhoneCall,
  Wallet,
  ShieldCheck,
  MessageSquare,
  Plus,
} from "lucide-react";

interface NavItem {
  id: "crm" | "campaigns" | "reports" | "numbers" | "wallet";
  label: string;
  icon: any;
  badge?: string;
  badgeHighlight?: boolean;
}

interface NavbarProps {
  currentTab: "crm" | "campaigns" | "reports" | "numbers" | "wallet";
  onSelectTab: (
    tab: "crm" | "campaigns" | "reports" | "numbers" | "wallet",
  ) => void;
  walletBalanceINR: string;
  activeCampaignsCount: number;
  contactsCount?: number;
  onOpenQuickCampaign: () => void;
  isLiveSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  walletBalanceINR,
  activeCampaignsCount,
  contactsCount,
  onOpenQuickCampaign,
  isLiveSyncing,
}) => {
  const navItems: NavItem[] = [
    {
      id: "crm",
      label: "Contacts",
      icon: Users,
      badge: contactsCount !== undefined ? `${contactsCount}` : undefined,
    },
    {
      id: "campaigns",
      label: "Campaigns",
      icon: Send,
      badge: activeCampaignsCount > 0 ? `${activeCampaignsCount}` : undefined,
    },
    {
      id: "reports",
      label: "Delivery Reports",
      icon: BarChart3,
    },
    {
      id: "numbers",
      label: "Virtual Numbers (+91)",
      icon: PhoneCall,
    },
    {
      id: "wallet",
      label: "Wallet & Ledger",
      icon: Wallet,
      badge: `₹${walletBalanceINR}`,
      badgeHighlight: true,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900 border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center text-white shadow-md shadow-emerald-950/40">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-white tracking-tight">
                  SalesBuster
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                  +91
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-none">
                Enterprise Platform
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id as any)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[#128C7E] text-white shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-400"}`}
                  />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        item.badgeHighlight
                          ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                          : isActive
                            ? "bg-black/20 text-white"
                            : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Section: Tenant Info, Wallet Balance & Quick Campaign Action */}
          <div className="flex items-center space-x-3 shrink-0">
            {/* Live Dynamic Engine Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/70 px-2.5 py-1 rounded-full border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
              <span>
                {isLiveSyncing ? "Live Syncing..." : "Dynamic Engine Active"}
              </span>
            </div>

            {/* Tenant Pill */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium text-slate-200">
                Demo Enterprises
              </span>
            </div>

            {/* Wallet Balance Pill */}
            <button
              onClick={() => onSelectTab("wallet")}
              className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition"
              title="Click to view Wallet & Transactions"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>₹{walletBalanceINR}</span>
            </button>

            {/* Quick Launch WhatsApp Button */}
            <button
              onClick={onOpenQuickCampaign}
              className="px-3 py-1.5 bg-[#25D366] hover:bg-[#1da851] text-white rounded-lg text-xs font-bold shadow-sm shadow-emerald-600/30 transition flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Campaign</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav row (visible on small screens) */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id as any)}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  isActive
                    ? "bg-[#128C7E] text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
