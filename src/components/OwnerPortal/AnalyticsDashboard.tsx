import React from 'react';
import { Package, Gift, BarChart3, PieChart, Star } from 'lucide-react';
import { AnalyticsData } from '../../types';

interface AnalyticsDashboardProps {
  analytics: AnalyticsData | null;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ analytics }) => {
  if (!analytics) {
    return (
      <div className="p-8 text-center text-stone-500 font-telugu">
        విశ్లేషణ డేటాను లోడ్ చేస్తోంది...
      </div>
    );
  }

  const summary = analytics.summary || {
    totalRevenueRupees: 0,
    totalOrders: 0,
    totalItems: 0,
    totalJowarRotis: 0,
    totalChapathis: 0,
    totalKarivepakuGrams: 0,
    totalAviseGrams: 0,
    todayOrdersCount: 0,
    todayRevenueRupees: 0,
    averageOrderValueRupees: 0,
  };

  const statusCounts = analytics.ordersByStatus || {
    RECEIVED: 0,
    PREPARING: 0,
    OUT_FOR_DELIVERY: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  };

  const hourlyList = analytics.hourlyOrderDistribution || [];
  const maxHourlyCount = Math.max(...hourlyList.map(h => h.count), 1);
  const avgRating = analytics.feedbackSummary?.averageRating || 5.0;
  const totalReviews = analytics.feedbackSummary?.totalReviews || 0;

  return (
    <div className="space-y-6 font-telugu">
      
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Revenue */}
        <div className="bg-white dark:bg-[#211E1A] p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
            <span className="text-xs font-semibold">మొత్తం ఆదాయం</span>
            <span className="p-1.5 sm:p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold">
              ₹
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-mono">
            ₹{summary.totalRevenueRupees}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            నేటి రాబడి: ₹{summary.todayRevenueRupees} ({summary.todayOrdersCount} ఆర్డర్లు)
          </div>
        </div>

        {/* Total Rotis & Chapathis */}
        <div className="bg-white dark:bg-[#211E1A] p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
            <span className="text-xs font-semibold">విక్రయాలు (పదార్థాలు)</span>
            <span className="p-1.5 sm:p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-mono">
            {summary.totalItems}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            {summary.totalJowarRotis} జొన్న + {summary.totalChapathis} చపాతీ
          </div>
        </div>

        {/* Customer Rating & Satisfaction */}
        <div className="bg-white dark:bg-[#211E1A] p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
            <span className="text-xs font-semibold">సగటు రేటింగ్</span>
            <span className="p-1.5 sm:p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#78350F] dark:text-amber-400 font-mono flex items-baseline gap-1">
            {avgRating.toFixed(1)}
            <span className="text-xs text-stone-400 font-normal">/ 5.0</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            {totalReviews} కస్టమర్ సమీక్షలు
          </div>
        </div>

        {/* Karivepaku Karam Provided */}
        <div className="bg-white dark:bg-[#211E1A] p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
            <span className="text-xs font-semibold">కరివేపాకు కారం</span>
            <span className="p-1.5 sm:p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              <Gift className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
            {summary.totalKarivepakuGrams} <span className="text-xs font-normal">గ్రా.</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            ఉచితంగా అందించినది
          </div>
        </div>

        {/* Avise Karam Provided */}
        <div className="bg-white dark:bg-[#211E1A] p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
            <span className="text-xs font-semibold">అవిసె గింజల కారం</span>
            <span className="p-1.5 sm:p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
              <Gift className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#78350F] dark:text-amber-400 font-mono">
            {summary.totalAviseGrams} <span className="text-xs font-normal">గ్రా.</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            ఉచితంగా అందించినది
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Hourly Order Volume Chart (Peak Distribution) */}
        <div className="lg:col-span-8 bg-white dark:bg-[#211E1A] p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#78350F] dark:text-amber-400" />
                <span>గంటల వారీ ఆర్డర్ల రద్దీ (Hourly Peak Ordering Volume)</span>
              </h3>
              <p className="text-xs text-stone-500">ఆర్డరింగ్ వేళలు: 11:00 AM – 4:00 PM IST</p>
            </div>
          </div>

          <div className="pt-4 space-y-4">
            {hourlyList.map((slot) => {
              const pct = Math.max((slot.count / maxHourlyCount) * 100, 4);
              return (
                <div key={slot.hourSlot} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-stone-700 dark:text-stone-300">{slot.hourSlot}</span>
                    <span className="font-mono text-stone-900 dark:text-stone-100">
                      {slot.count} ఆర్డర్లు
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 dark:bg-stone-800 h-6 rounded-lg overflow-hidden flex items-center p-1">
                    <div
                      className="bg-gradient-to-r from-[#78350F] to-[#A1582C] h-full rounded-md transition-all duration-700 flex items-center justify-end px-2"
                      style={{ width: `${pct}%` }}
                    >
                      {slot.count > 0 && (
                        <span className="text-[10px] font-mono font-bold text-white">
                          {slot.count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fulfillment Status Breakdown */}
        <div className="lg:col-span-4 bg-white dark:bg-[#211E1A] p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 mb-1">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <span>ఆర్డర్ల నిర్వహణ స్థితి (Status)</span>
            </h3>
            <p className="text-xs text-stone-500 mb-5">డెలివరీ పురోగతి వర్గీకరణ</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-xs">
                <span className="font-bold text-blue-900 dark:text-blue-200">ఆర్డర్ అందింది (Received)</span>
                <span className="font-mono font-bold text-blue-800 dark:text-blue-300 text-sm">
                  {statusCounts.RECEIVED || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-xs">
                <span className="font-bold text-amber-900 dark:text-amber-200">తయారవుతోంది (Preparing)</span>
                <span className="font-mono font-bold text-amber-800 dark:text-amber-300 text-sm">
                  {statusCounts.PREPARING || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-xs">
                <span className="font-bold text-purple-900 dark:text-purple-200">డెలివరీలో ఉంది (Out for delivery)</span>
                <span className="font-mono font-bold text-purple-800 dark:text-purple-300 text-sm">
                  {statusCounts.OUT_FOR_DELIVERY || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs">
                <span className="font-bold text-emerald-900 dark:text-emerald-200">డెలివరీ పూర్తయింది (Delivered)</span>
                <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                  {statusCounts.DELIVERED || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800 text-center">
            <span className="text-xs text-stone-500">
              డెలివరీ సమయ కిటికీ: <strong>సాయంత్రం 6:00 – 8:00 గంటలు</strong>
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
