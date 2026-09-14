import React, { useState } from 'react';
import { Star, MessageSquareHeart, ThumbsUp, Sparkles, Filter, CheckCircle2, User, Phone, Calendar, RefreshCw } from 'lucide-react';
import { OrderFeedback } from '../../types';

interface CustomerFeedbackViewProps {
  feedbacks: OrderFeedback[];
  averageRating: number;
  totalFeedbacks: number;
  ratingDistribution?: Record<number, number>;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const TAG_TRANSLATIONS: Record<string, string> = {
  TASTE_SOFTNESS: '🫓 రొట్టెల మెత్తదనం & రుచి',
  HOT_AND_FRESH: '🔥 వేడివేడిగా అందింది',
  KARIVEPAKU_KARAM: '🌿 కరివేపాకు కారం అదిరింది',
  AVISE_KARAM: '🌰 అవిసె గింజల కారం బాగుంది',
  ON_TIME_DELIVERY: '⏱️ సమయానికి డెలివరీ',
  CLEAN_PACKAGING: '📦 పరిశుభ్రమైన ప్యాకింగ్',
  PACKAGING: '📦 పరిశుభ్రమైన ప్యాకింగ్',
};

export const CustomerFeedbackView: React.FC<CustomerFeedbackViewProps> = ({
  feedbacks,
  averageRating,
  totalFeedbacks,
  ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  onRefresh,
  isRefreshing = false,
}) => {
  const [filterStar, setFilterStar] = useState<number | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredFeedbacks = feedbacks.filter((fb) => {
    const matchesStar = filterStar === 'ALL' || fb.rating === filterStar;
    const commentText = fb.comment || fb.comments || '';
    const matchesSearch =
      !searchTerm ||
      fb.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fb.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      commentText.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStar && matchesSearch;
  });

  return (
    <div className="space-y-6 font-telugu">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Average Rating Card */}
        <div className="bg-white dark:bg-[#211E1A] p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              సగటు కస్టమర్ రేటింగ్ (Average Rating)
            </span>
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-[#78350F] dark:text-amber-400">
              <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            </div>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-stone-900 dark:text-stone-100 font-mono">
              {averageRating.toFixed(1)}
            </span>
            <span className="text-stone-400 text-lg">/ 5.0</span>
          </div>

          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-4 h-4 ${
                  s <= Math.round(averageRating)
                    ? 'fill-amber-400 text-amber-500'
                    : 'text-stone-300 dark:text-stone-700'
                }`}
              />
            ))}
            <span className="text-xs text-stone-500 ml-2">({totalFeedbacks} సమీక్షలు)</span>
          </div>
        </div>

        {/* Rating Breakdown Bar */}
        <div className="sm:col-span-2 bg-white dark:bg-[#211E1A] p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
            రేటింగ్ల విభజన (Rating Breakdown)
          </span>

          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratingDistribution[stars] || 0;
            const pct = totalFeedbacks > 0 ? (count / totalFeedbacks) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-2 text-xs">
                <span className="w-10 font-bold flex items-center gap-0.5 text-stone-700 dark:text-stone-300">
                  {stars} <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                </span>
                <div className="flex-1 h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-stone-500">
                  {count} ({Math.round(pct)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="bg-white dark:bg-[#211E1A] p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Star Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> ఫిల్టర్:
          </span>
          <button
            type="button"
            onClick={() => setFilterStar('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterStar === 'ALL'
                ? 'bg-[#78350F] text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
            }`}
          >
            అన్నీ ({feedbacks.length})
          </button>
          {[5, 4, 3, 2, 1].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStar(s)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                filterStar === s
                  ? 'bg-[#78350F] text-white shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
              }`}
            >
              <span>{s}</span>
              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
              <span>({ratingDistribution[s] || 0})</span>
            </button>
          ))}
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="కస్టమర్ లేదా కామెంట్ శోధించండి..."
            className="w-full sm:w-60 px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs text-stone-900 dark:text-stone-100 outline-hidden focus:ring-1 focus:ring-amber-500"
          />
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
              title="రీఫ్రెష్ చేయండి"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Feedback Reviews List */}
      <div className="space-y-3">
        {filteredFeedbacks.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#211E1A] rounded-2xl border border-stone-200 dark:border-stone-800 text-stone-400 space-y-2">
            <MessageSquareHeart className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600" />
            <p className="text-sm font-semibold">ఈ కేటగిరీలో ఎలాంటి సమీక్షలు లేవు.</p>
          </div>
        ) : (
          filteredFeedbacks.map((fb) => (
            <div
              key={fb.id}
              className="bg-white dark:bg-[#211E1A] p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs hover:border-amber-300 dark:hover:border-amber-700/50 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-stone-800 text-[#78350F] dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                    {fb.customerName ? fb.customerName.charAt(0) : 'C'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 leading-tight">
                      {fb.customerName || 'గౌరవనీయ కస్టమర్'}
                    </h4>
                    <span className="text-xs text-stone-400 font-mono">
                      ఆర్డర్: <span className="font-bold text-stone-700 dark:text-stone-300">{fb.orderId}</span>
                      {fb.customerMobile && ` • +91 ${fb.customerMobile}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= fb.rating
                            ? 'fill-amber-400 text-amber-500'
                            : 'text-stone-300 dark:text-stone-700'
                        }`}
                      />
                    ))}
                    <span className="ml-1.5 font-bold text-xs text-[#78350F] dark:text-amber-400">
                      {fb.rating}.0
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-400 whitespace-nowrap">
                    {fb.createdAtIST || fb.createdAt}
                  </span>
                </div>
              </div>

              {/* Aspects Tags */}
              {fb.aspects && fb.aspects.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {fb.aspects.map((tagId: string) => (
                    <span
                      key={tagId}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
                    >
                      {TAG_TRANSLATIONS[tagId] || tagId}
                    </span>
                  ))}
                </div>
              )}

              {/* Comments */}
              {(fb.comment || fb.comments) ? (
                <p className="text-sm text-stone-800 dark:text-stone-200 italic bg-[#FAF4EA]/50 dark:bg-stone-900/50 p-3 rounded-xl border border-amber-900/5 dark:border-stone-800">
                  "{fb.comment || fb.comments}"
                </p>
              ) : (
                <span className="text-xs text-stone-400 italic">వ్యాఖ్యలు లేవు (నక్షత్రాల రేటింగ్ మాత్రమే ఇవ్వబడింది).</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
