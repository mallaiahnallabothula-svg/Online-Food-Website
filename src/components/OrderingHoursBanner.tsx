import React from 'react';
import { Clock, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { OrderingHoursStatus } from '../types';

interface OrderingHoursBannerProps {
  status: OrderingHoursStatus;
  allowOutsideHoursForTesting: boolean;
  onToggleAllowOutsideHours: (val: boolean) => void;
}

export const OrderingHoursBanner: React.FC<OrderingHoursBannerProps> = ({
  status,
  allowOutsideHoursForTesting,
  onToggleAllowOutsideHours,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 my-4">
      <div
        className={`rounded-2xl p-4 sm:p-5 border transition-all ${
          status.isOpen
            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
            : 'bg-amber-50/95 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${
                status.isOpen
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-600 text-white'
              }`}
            >
              {status.isOpen ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg font-telugu">
                  {status.isOpen
                    ? 'ఆర్డర్లు స్వీకరించబడుతున్నాయి (24/7 ఆర్డరింగ్ అందుబాటులో ఉంది)'
                    : 'ఆర్డర్ల స్వీకరణ ప్రస్తుతం నిలిపివేయబడింది'}
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-stone-200/80 dark:bg-stone-800 text-stone-800 dark:text-stone-300">
                  ప్రస్తుత IST సమయం: {status.currentTimeIST}
                </span>
              </div>

              <p className="text-sm font-telugu text-stone-700 dark:text-stone-300 leading-relaxed">
                {status.nextOpenMessage}
              </p>

              <div className="flex items-center gap-4 text-xs font-telugu text-stone-600 dark:text-stone-400 pt-0.5 flex-wrap">
                <span>🕒 <strong>సాయంత్రం 4:00 PM లోపు:</strong> నేటి సాయంత్రం 6:00 – 8:00 PM కి డెలివరీ</span>
                <span>🚚 <strong>సాయంత్రం 4:00 PM దాటితే:</strong> రేపటి సాయంత్రం 6:00 – 8:00 PM కి డెలివరీ</span>
              </div>
            </div>
          </div>

          {/* Testing / Override Control (useful for evaluating preview outside 11-4 IST) */}
          {!status.isOpen && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 bg-white/70 dark:bg-stone-900/80 p-2.5 rounded-xl border border-amber-300/60 dark:border-stone-700 text-xs font-telugu self-stretch md:self-auto">
              <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>ప్రివ్యూ టెస్టింగ్ కోసం సమయ నిబంధన మినహాయింపు:</span>
              </div>
              <button
                type="button"
                onClick={() => onToggleAllowOutsideHours(!allowOutsideHoursForTesting)}
                id="toggle-ordering-hours-override"
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  allowOutsideHoursForTesting
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                {allowOutsideHoursForTesting ? 'ఆర్డరింగ్ ఎనేబుల్ అయింది' : 'ఆర్డరింగ్ టెస్ట్ చేయండి'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
