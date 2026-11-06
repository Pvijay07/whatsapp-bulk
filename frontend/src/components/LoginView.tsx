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
  CheckCircle2,
} from 'lucide-react';

interface LoginViewProps {
  onLogin: (credentials: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('info@sibestce.in');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
      const res = await onLogin({ email, password });
      if (!res.success) {
        setErrorMessage(res.error || 'Authentication failed. Please check credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('info@sibestce.in');
    setPassword('admin123');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center p-4 selection:bg-teal-100 selection:text-teal-900">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-2 rounded-2xl bg-white border border-slate-200/80 shadow-2xs mb-4">
            <img
              src="/logo.png"
              alt="salesbuster.ai"
              className="h-9 w-auto object-contain mx-auto"
            />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Sign in to salesbuster.ai
          </h1>
          <p className="text-xs text-slate-500 mt-1.5">
            Enterprise customer leads repository & WhatsApp marketing gateway
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@sibestce.in"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00b493] focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => alert('Demo default password is: admin123')}
                  className="text-[11px] font-semibold text-[#00897b] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00b493] focus:border-transparent transition"
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

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-[#00b493] rounded focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-slate-600 font-medium">Keep me signed in</span>
              </label>

              {/* 1-Click Fill Demo */}
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="text-[11px] font-bold text-[#00897b] bg-[#e6fffa] hover:bg-[#ccfbf1] px-2 py-0.5 rounded-md border border-[#99f6e4] transition flex items-center gap-1"
                title="Fill demo credentials"
              >
                <Sparkles className="w-3 h-3 text-[#00a79d]" />
                Demo Info
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-[#00b493] hover:bg-[#009e81] text-white rounded-xl text-xs font-bold transition shadow-md shadow-teal-500/20 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Verification Badge */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>256-bit Encrypted Session • Verified Tenant</span>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6 text-xs text-slate-400">
          salesbuster.ai &copy; {new Date().getFullYear()} • Enterprise Multi-WhatsApp Cloud
        </div>
      </div>
    </div>
  );
};

