import React, { useState } from 'react';
import { Lock, RefreshCw, AlertCircle, ShieldCheck, User, Eye, EyeOff } from 'lucide-react';
import { AdminRole } from '../../types';
import { BrandEmblem } from '../BrandEmblem';
import { useLanguage } from '../../context/LanguageContext';

interface AdminLoginProps {
  onLoginSuccess: (token: string, role: AdminRole) => void;
  onCancel: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onCancel }) => {
  const { language } = useLanguage();
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isTe = language !== 'en';

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError(isTe ? 'దయచేసి యూజర్‌నేమ్ మరియు పాస్‌వర్డ్ నమోదు చేయండి.' : 'Please enter username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Sets HttpOnly cookie
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.error?.message || (isTe ? 'లాగిన్ విఫలమైంది. వివరాలు తనిఖీ చేయండి.' : 'Login failed. Please check credentials.');
        setError(errorMsg);
        setIsLoading(false);
        return;
      }

      onLoginSuccess(data.sessionToken, data.user.role);
    } catch (err: any) {
      setError(isTe ? 'సర్వర్‌తో కనెక్ట్ కావడం సాధ్యపడలేదు.' : 'Failed to connect to authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 px-4 font-telugu">
      <div className="bg-white dark:bg-[#211E1A] rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 p-6 sm:p-8">
        
        {/* Header with Brand Emblem */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <BrandEmblem size="lg" />
          </div>
          <h2 className="text-2xl font-bold text-[#451A03] dark:text-amber-100">
            {isTe ? 'అధీకృత అడ్మిన్ లాగిన్' : 'Authorized Admin Portal'}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            {isTe ? 'మన ఇంటి వంట ఆర్డర్ల నిర్వహణ వ్యవస్థ' : 'Mana Enti Vanta Kitchen & Delivery Management'}
          </p>
        </div>

        {/* Security Notice */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 mb-6 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            {isTe
              ? 'ఈ ప్రాంతం కేవలం అధీకృత యజమాని మరియు వంటశాల సిబ్బందికి మాత్రమే. అన్ని లాగిన్ ప్రయత్నాలు ఆడిట్ లాగ్ చేయబడతాయి.'
              : 'Authorized personnel only. All access attempts are rate-limited and audited.'}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl p-3 mb-4 flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              {isTe ? 'యూజర్‌నేమ్ (Username)' : 'Username'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full pl-9 pr-3 py-2.5 bg-stone-50 dark:bg-[#1A1816] border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                placeholder="admin"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              {isTe ? 'పాస్‌వర్డ్ (Password)' : 'Password'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full pl-9 pr-10 py-2.5 bg-stone-50 dark:bg-[#1A1816] border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                placeholder="••••••••"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              {isTe ? 'డిఫాల్ట్ అడ్మిన్ పాస్‌వర్డ్: ManaEntiVanta@2026' : 'Default admin password: ManaEntiVanta@2026'}
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#78350F] to-[#92400E] text-white rounded-xl font-bold shadow-md hover:from-[#602a0c] hover:to-[#78350f] focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{isTe ? 'ప్రామాణీకరిస్తోంది...' : 'Authenticating...'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>{isTe ? 'సురక్షితంగా లాగిన్ అవ్వండి' : 'Secure Login'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 px-4 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
            >
              {isTe ? 'రద్దు చేయి / కస్టమర్ పేజీకి వెళ్లు' : 'Cancel / Return to Customer Store'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
