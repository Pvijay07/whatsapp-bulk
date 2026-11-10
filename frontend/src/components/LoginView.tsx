import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Building,
  UserCheck,
} from 'lucide-react';

interface LoginViewProps {
  onLogin: (credentials: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  onRegister?: (data: { orgName: string; email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('admin@petsfolio.in');
  const [password, setPassword] = useState('Admin@Petsfolio2026!');
  const [orgName, setOrgName] = useState('Petsfolio Marketing');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'LOGIN') {
        const res = await onLogin({ email, password });
        if (!res.success) {
          setErrorMessage(res.error || 'Invalid email or password.');
        }
      } else {
        if (!onRegister) {
          setErrorMessage('Registration is not enabled.');
          return;
        }
        const res = await onRegister({ orgName, email, password });
        if (!res.success) {
          setErrorMessage(res.error || 'Registration failed.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDefaultAdmin = () => {
    setEmail('admin@petsfolio.in');
    setPassword('Admin@Petsfolio2026!');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center p-4 selection:bg-teal-100 selection:text-teal-900">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-block p-2 rounded-2xl bg-white border border-slate-200/80 shadow-2xs mb-3">
            <img
              src="/logo.png"
              alt="Petsfolio Marketing"
              className="h-9 w-auto object-contain mx-auto"
              onError={(e) => {
                // Fallback text icon if logo.png not found
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="text-base font-extrabold text-[#00897b] flex items-center justify-center gap-1.5 px-3 py-1">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Petsfolio WhatsApp SaaS</span>
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {mode === 'LOGIN' ? 'Sign in to Your Account' : 'Create New Admin Account'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise WhatsApp Multi-Number Gateway & CRM
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-200/70 p-1 rounded-2xl mb-4 max-w-xs mx-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 rounded-xl transition ${
              mode === 'LOGIN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('REGISTER');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 rounded-xl transition ${
              mode === 'REGISTER' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-7 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Org Name Field (Register Mode Only) */}
            {mode === 'REGISTER' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Organization / Business Name
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Petsfolio Hyderabad"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00b493]"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Admin Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@petsfolio.in"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00b493] transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Password
                </label>
                {mode === 'LOGIN' && (
                  <button
                    type="button"
                    onClick={fillDefaultAdmin}
                    className="text-[11px] font-bold text-[#00897b] hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-[#00a79d]" />
                    Use Default Admin
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00b493] transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-[#00b493] hover:bg-[#009e81] text-white rounded-xl text-xs font-bold transition shadow-md shadow-teal-500/20 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-70 disabled:cursor-not-allowed mt-3"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{mode === 'LOGIN' ? 'Verifying with PostgreSQL...' : 'Creating Account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'LOGIN' ? 'Sign In with Secure JWT' : 'Register Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Verification Badge */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>PostgreSQL Bcrypt 10-Salt Hashed • 7-Day Signed JWT</span>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6 text-xs text-slate-400">
          bulk.petsfolio.in &copy; {new Date().getFullYear()} • Secure Multi-WhatsApp Marketing Gateway
        </div>
      </div>
    </div>
  );
};
