import React from 'react';
import { Clock, CheckCircle } from 'lucide-react';
import { OrderingHoursStatus } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface OrderingHoursBannerProps {
  status: OrderingHoursStatus;
}

export const OrderingHoursBanner: React.FC<OrderingHoursBannerProps> = ({
  status,
}) => {
  const { language, t } = useLanguage();

  const openMessage = language === 'en' 
    ? (status.nextOpenMessageEn || status.nextOpenMessage)
    : status.nextOpenMessage;

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
                  {status.testMode
                    ? (language === 'en' ? 'Razorpay Test checkout' : 'Razorpay టెస్ట్ చెకౌట్')
                    : status.isOpen ? t.ordersAcceptingTitle : t.ordersPausedTitle}
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-stone-200/80 dark:bg-stone-800 text-stone-800 dark:text-stone-300">
                  {t.currentIstLabel} {status.currentTimeIST}
                </span>
              </div>

              <p className="text-sm font-telugu text-stone-700 dark:text-stone-300 leading-relaxed">
                {openMessage}
              </p>

              <div className="flex items-center gap-4 text-xs font-telugu text-stone-600 dark:text-stone-400 pt-0.5 flex-wrap">
                <span>🕒 {language === 'en' ? 'Orders: 11:00 AM – 4:00 PM IST' : 'ఆర్డర్లు: ఉదయం 11:00 – సాయంత్రం 4:00 IST'}</span>
                <span>🚚 {language === 'en' ? 'Delivery: 6:00 – 8:00 PM' : 'డెలివరీ: సాయంత్రం 6:00 – 8:00'}</span>
              </div>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
};
