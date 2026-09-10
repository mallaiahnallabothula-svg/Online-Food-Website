import React from 'react';
import { ShieldCheck, History, ArrowDownRight, User, CheckCircle2 } from 'lucide-react';
import { AuditLog } from '../../types';

interface AuditLogsProps {
  logs: AuditLog[];
}

export const AuditLogs: React.FC<AuditLogsProps> = ({ logs }) => {
  return (
    <div className="bg-white dark:bg-[#211E1A] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden font-telugu">
      <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <History className="w-5 h-5 text-[#78350F] dark:text-amber-400" />
            <span>లావాదేవీల ఆడిట్ రికార్డులు (Transaction & Security Audit Logs)</span>
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            సర్వర్ ద్వారా నమోదైన అన్ని చెల్లింపులు మరియు ఆర్డర్ స్థితి మార్పుల వివరాలు
          </p>
        </div>
        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
          మొత్తం రికార్డులు: {logs.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 dark:bg-stone-900/60 text-stone-600 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider font-mono">
            <tr>
              <th className="px-5 py-3.5">సమయం (IST)</th>
              <th className="px-5 py-3.5">రకం</th>
              <th className="px-5 py-3.5">ఆర్డర్ ఐడీ</th>
              <th className="px-5 py-3.5">రిఫరెన్స్</th>
              <th className="px-5 py-3.5">మొత్తం</th>
              <th className="px-5 py-3.5">వివరాలు</th>
              <th className="px-5 py-3.5">ఆపరేటర్</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-stone-500">
                  ఇంకా ఎలాంటి ఆడిట్ రికార్డులు నమోదు కాలేదు.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-amber-50/40 dark:hover:bg-stone-900/40 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-stone-600 dark:text-stone-400 whitespace-nowrap">
                    {log.timestampIST || log.timestamp.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold font-mono text-[10px] ${
                      log.type === 'PAYMENT_VERIFIED'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                    }`}>
                      {log.type === 'PAYMENT_VERIFIED' ? <CheckCircle2 className="w-3 h-3" /> : null}
                      {log.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono font-bold text-[#78350F] dark:text-amber-400 whitespace-nowrap">
                    {log.orderId || '-'}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-stone-600 dark:text-stone-300 whitespace-nowrap">
                    {log.paymentReference || '-'}
                  </td>
                  <td className="px-5 py-3.5 font-mono font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                    {log.amount ? `₹${log.amount}` : '-'}
                  </td>
                  <td className="px-5 py-3.5 text-stone-700 dark:text-stone-300 min-w-[200px]">
                    {log.details}
                  </td>
                  <td className="px-5 py-3.5 text-stone-500 whitespace-nowrap">
                    {log.actor}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
