import React from 'react';
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Calendar,
  Target,
  BarChart2,
  MessageSquare,
  Send,
  PhoneCall,
  FileCheck2,
  LineChart,
  Cpu,
  Bell,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from 'lucide-react';

export type NavTabId =
  | 'dashboard'
  | 'crm'
  | 'followups'
  | 'events'
  | 'target-intel'
  | 'team-perf'
  | 'chat'
  | 'campaigns'
  | 'reports'
  | 'numbers'
  | 'bi-analyst'
  | 'test-ai'
  | 'wallet'
  | 'notifications'
  | 'support';

interface SidebarProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  contactsCount?: number;
  activeCampaignsCount?: number;
  walletBalanceINR?: string;
  onLogout?: () => void;
}

interface NavSection {
  title: string;
  items: Array<{
    id: NavTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    isTealBadge?: boolean;
  }>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  contactsCount,
  activeCampaignsCount,
  walletBalanceINR,
  onLogout,
}) => {
  const sections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'SALES & PIPELINE',
      items: [
        {
          id: 'crm',
          label: 'Leads Directory',
          icon: Users,
          badge: contactsCount !== undefined && contactsCount > 0 ? `${contactsCount}` : undefined,
        },
        {
          id: 'followups',
          label: 'AI Followups',
          icon: Sparkles,
        },
        {
          id: 'events',
          label: 'Events & Networking',
          icon: Calendar,
        },
        {
          id: 'target-intel',
          label: 'Target Intelligence',
          icon: Target,
        },
        {
          id: 'team-perf',
          label: 'Team Performance',
          icon: BarChart2,
        },
      ],
    },
    {
      title: 'COMMUNICATIONS & AI',
      items: [
        {
          id: 'chat',
          label: 'WhatsApp Chat',
          icon: MessageSquare,
        },
        {
          id: 'campaigns',
          label: 'WhatsApp Campaigns',
          icon: Send,
          badge: activeCampaignsCount !== undefined && activeCampaignsCount > 0 ? `${activeCampaignsCount}` : undefined,
        },
        {
          id: 'reports',
          label: 'Delivery Reports',
          icon: FileCheck2,
        },
        {
          id: 'numbers',
          label: 'Virtual Numbers (+91)',
          icon: PhoneCall,
        },
        {
          id: 'bi-analyst',
          label: 'BI Analyst',
          icon: LineChart,
        },
        {
          id: 'test-ai',
          label: 'Test AI',
          icon: Cpu,
        },
      ],
    },
    {
      title: 'FINANCE & WALLET',
      items: [
        {
          id: 'wallet',
          label: 'Wallet & Ledger',
          icon: Wallet,
          badge: walletBalanceINR ? `₹${walletBalanceINR}` : undefined,
          isTealBadge: true,
        },
      ],
    },
    {
      title: 'SYSTEM & ALERTS',
      items: [
        {
          id: 'notifications',
          label: 'Notifications',
          icon: Bell,
        },
      ],
    },
    {
      title: 'HELP & SUPPORT',
      items: [
        {
          id: 'support',
          label: 'Support & Help',
          icon: HelpCircle,
        },
      ],
    },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-30 bg-white border-r border-slate-200/80 transition-all duration-300 ease-in-out flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onSelectTab('crm')}>
            <span className="text-xl font-extrabold tracking-tight text-[#0f172a]">salesbuster</span>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-[#e6fffa] text-[#00a79d] border border-[#99f6e4]/60">
              .ai
            </span>
          </div>
        ) : (
          <div className="w-full flex justify-center cursor-pointer" onClick={() => onSelectTab('crm')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0f172a] to-[#1e293b] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
              sb<span className="text-[#00b493]">.ai</span>
            </div>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <h3 className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase select-none mb-1.5">
                {section.title}
              </h3>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? 'bg-[#e8f7fa] text-[#00897b] font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-[#00897b]' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate flex-1 text-left">{item.label}</span>
                  )}
                  {!collapsed && item.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                        item.isTealBadge
                          ? 'bg-[#e6fffa] text-[#00a79d] border border-[#99f6e4]'
                          : isActive
                          ? 'bg-[#00897b] text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Logout Footer */}
      <div className="p-3 border-t border-slate-100 shrink-0">
        <button
          onClick={onLogout || (() => alert('Logged out successfully'))}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-colors ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0 text-rose-500" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
