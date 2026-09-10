import React, { useState } from 'react';
import { ShieldCheck, KeyRound, Lock, ArrowRight, RefreshCw, AlertCircle, Smartphone } from 'lucide-react';
import { AdminRole } from '../../types';

interface AdminLoginProps {
  onLoginSuccess: (token: string, role: AdminRole) => void;
  onCancel: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onCancel }) => {
  const [step, setStep] = useState<'PIN' | '2FA'>('PIN');
  const [pin, setPin] = useState<string>('8499');
  const [role, setRole] = useState<AdminRole>('ADMIN');
  const [twoFactorCode, setTwoFactorCode] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [sampleOtpNotice, setSampleOtpNotice] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Step 1: Submit PIN to get 2FA code
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'లాగిన్ విఫలమైంది.');
      }

      setSessionId(data.sessionId);
      setSampleOtpNotice(data.sampleCode || '123456');
      setTwoFactorCode(data.sampleCode || '');
      setStep('2FA');
    } catch (err: any) {
      setError(err.message || 'పిన్ నమోదు చేయడం విఫలమైంది.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify 2FA OTP Code
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          code: twoFactorCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || '2FA ధృవీకరణ విఫలమైంది.');
      }

      onLoginSuccess(data.token, data.role);
    } catch (err: any) {
      setError(err.message || '2FA కోడ్ తప్పుగా ఉంది.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 px-4 font-telugu">
      <div className="bg-white dark:bg-[#211E1A] rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 p-6 sm:p-8">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#78350F] text-amber-100 flex items-center justify-center mx-auto mb-3 shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-[#451A03] dark:text-amber-100">
            యజమాని & నిర్వాహకుల పోర్టల్
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            ద్విముఖ ప్రమాణీకరణ (Two-Factor Authentication) రక్షణ
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'PIN' ? (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label htmlFor="role-select" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                హోదా (Role-Based Access):
              </label>
              <select
                id="role-select"
                value={role}
                onChange={(e) => setRole(e.target.value as AdminRole)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-sm font-semibold"
              >
                <option value="ADMIN">యజమాని / ప్రధాన నిర్వాహకులు (Owner / Admin)</option>
                <option value="STAFF">డెలివరీ సిబ్బంది (Delivery Staff)</option>
              </select>
            </div>

            <div>
              <label htmlFor="pin-input" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                పాస్‌కోడ్ / పిన్ (Owner Security PIN):
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="pin-input"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="8499"
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 font-mono text-center tracking-widest text-lg font-bold"
                />
              </div>
              <p className="text-[11px] text-stone-500 mt-1 text-center">
                డిఫాల్ట్ పిన్: <strong>8499</strong> (+91 8499865803)
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              id="submit-pin-btn"
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-[#78350F] hover:bg-[#8C4A26] active:scale-[0.99] flex items-center justify-center gap-2 shadow-md transition-all"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              <span>2FA కోడ్ పొందండి</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handle2FASubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-50/90 dark:bg-stone-900 border border-amber-300 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200">
              <div className="flex items-center gap-1.5 font-bold text-[#78350F] dark:text-amber-400 mb-1">
                <Smartphone className="w-4 h-4" />
                <span>2FA వెరిఫికేషన్ కోడ్ పంపబడింది:</span>
              </div>
              <p>యజమాని నంబర్ <strong>+91 8499865803</strong> కు పంపబడిన 6 అంకెల కోడ్ నమోదు చేయండి.</p>
              {sampleOtpNotice && (
                <div className="mt-2 p-1.5 bg-white dark:bg-stone-800 rounded font-mono font-bold text-emerald-700 dark:text-emerald-400 text-center">
                  సెక్యూరిటీ కోడ్: {sampleOtpNotice}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="2fa-code-input" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1 text-center">
                6 అంకెల ధృవీకరణ కోడ్ (Verification Code):
              </label>
              <input
                type="text"
                id="2fa-code-input"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 font-mono text-center tracking-widest text-2xl font-bold"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || twoFactorCode.trim().length !== 6}
              id="verify-2fa-btn"
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-md transition-all"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>లాగిన్ ధృవీకరించండి</span>
            </button>

            <button
              type="button"
              onClick={() => setStep('PIN')}
              className="w-full text-xs text-stone-500 hover:underline text-center"
            >
              పిన్ మళ్లీ నమోదు చేయండి
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-stone-200 dark:border-stone-800 mt-6 text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-stone-600 dark:text-stone-400 hover:underline"
          >
            ఆర్డరింగ్ పేజీకి తిరిగి వెళ్లండి
          </button>
        </div>

      </div>
    </div>
  );
};
