import React from 'react';
import {
  Search,
  Mail,
  Bell,
  Plus,
} from 'lucide-react';

interface TopHeaderProps {
  onSearch?: (term: string) => void;
  onInstantHelp?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onSearch,
  onInstantHelp,
}) => {
  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shadow-2xs">
      {/* Search Input Box on Left */}
      <div className="relative w-72">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search"
          onChange={(e) => onSearch?.(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 text-slate-800 bg-white"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Mail Icon Button */}
        <button
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors relative"
          title="Messages / Inquiries"
        >
          <Mail className="w-4 h-4" />
        </button>

        {/* Bell Notification Icon Button */}
        <button
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
        </button>

        {/* Instant-help Pill Button */}
        <a
          href="https://wa.me/918897727709?text=Hi%20SalesBuster%20Team%2C%20I%20need%20assistance"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#00897b] bg-[#e6fffa] hover:bg-[#ccfbf1] border border-[#99f6e4] transition-all shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5 text-[#00a79d]" />
          <span>Instant-help</span>
        </a>

        {/* User Avatar Circle */}
        <div
          className="w-8 h-8 rounded-full bg-[#0f172a] text-white flex items-center justify-center text-xs font-bold shadow-xs select-none cursor-pointer ring-2 ring-slate-100"
          title="Admin Info (IN)"
        >
          IN
        </div>
      </div>
    </header>
  );
};
