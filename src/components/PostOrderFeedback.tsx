import React, { useState } from 'react';
import { Star, CheckCircle2, MessageSquareHeart, PackageCheck, Send, Check, Sparkles, Clock, Edit3, ThumbsUp } from 'lucide-react';
import { Order, OrderFeedback } from '../types';

interface PostOrderFeedbackProps {
  order: Order;
  onOrderUpdated?: (updatedOrder: Order) => void;
  className?: string;
}

const RATING_LABELS: Record<number, { telugu: string; color: string }> = {
  5: { telugu: 'అద్భుతం! (Excellent)', color: 'text-amber-500 dark:text-amber-400' },
  4: { telugu: 'చాలా బాగుంది (Very Good)', color: 'text-emerald-600 dark:text-emerald-400' },
  3: { telugu: 'బాగుంది (Good)', color: 'text-blue-600 dark:text-blue-400' },
  2: { telugu: 'పర్వాలేదు (Fair)', color: 'text-stone-600 dark:text-stone-400' },
  1: { telugu: 'అసంతృప్తి (Needs Improvement)', color: 'text-rose-600 dark:text-rose-400' },
};

const FEEDBACK_TAGS = [
  { id: 'TASTE_SOFTNESS', label: '🫓 రొట్టెల మెత్తదనం & రుచి' },
  { id: 'HOT_AND_FRESH', label: '🔥 వేడివేడిగా అందింది' },
  { id: 'KARIVEPAKU_KARAM', label: '🌿 కరివేపాకు కారం అదిరింది' },
  { id: 'AVISE_KARAM', label: '🌰 అవిసె గింజల కారం బాగుంది' },
  { id: 'ON_TIME_DELIVERY', label: '⏱️ సమయానికి డెలివరీ' },
  { id: 'CLEAN_PACKAGING', label: '📦 పరిశుభ్రమైన ప్యాకింగ్' },
];

export const PostOrderFeedback: React.FC<PostOrderFeedbackProps> = ({
  order,
  onOrderUpdated,
  className = '',
}) => {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);
  const [isMarkingReceived, setIsMarkingReceived] = useState<boolean>(false);
  const [markSuccessMsg, setMarkSuccessMsg] = useState<string | null>(null);

  // Feedback form state
  const existingFeedback = currentOrder.feedback;
  const [isEditing, setIsEditing] = useState<boolean>(!existingFeedback);
  const [rating, setRating] = useState<number>(existingFeedback?.rating || 5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comments, setComments] = useState<string>(existingFeedback?.comments || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(existingFeedback?.aspects || ['TASTE_SOFTNESS', 'HOT_AND_FRESH']);
  const [customerName, setCustomerName] = useState<string>(
    existingFeedback?.customerName || currentOrder.customer?.name || ''
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isReceived = currentOrder.isCustomerReceived || currentOrder.fulfillmentStatus === 'DELIVERED';

  // Handler: Customer marks order as received
  const handleMarkAsReceived = async () => {
    setIsMarkingReceived(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/orders/${currentOrder.id}/received`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.order) {
          setCurrentOrder(data.order);
          onOrderUpdated?.(data.order);
          setMarkSuccessMsg('ఆర్డర్ అందినట్లుగా ధృవీకరించబడింది! దయచేసి క్రింద మీ రేటింగ్ మరియు అభిప్రాయాన్ని తెలపండి.');
          setIsEditing(true);
        }
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'ఆర్డర్ స్థితి అప్‌డేట్ చేయడంలో లోపం ఏర్పడింది.');
      }
    } catch (e) {
      setErrorMessage('సర్వర్ కనెక్షన్ లోపం. దయచేసి మళ్లీ ప్రయత్నించండి.');
    } finally {
      setIsMarkingReceived(false);
    }
  };

  // Toggle feedback tag
  const handleToggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  // Submit Feedback Handler
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) {
      setErrorMessage('దయచేసి నక్షత్రాల రేటింగ్ ఎంచుకోండి.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/orders/${currentOrder.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comments: comments.trim(),
          aspects: selectedTags,
          customerName: customerName.trim() || currentOrder.customer?.name,
          customerMobile: currentOrder.customer?.mobile,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.order) {
          setCurrentOrder(data.order);
          onOrderUpdated?.(data.order);
        }
        setSubmitSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSubmitSuccess(false), 5000);
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'ఫీడ్‌బ్యాక్ సమర్పించడంలో లోపం ఏర్పడింది.');
      }
    } catch (e) {
      setErrorMessage('సర్వర్ కనెక్షన్ లోపం. దయచేసి మళ్లీ ప్రయత్నించండి.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="post-order-feedback-section"
      className={`rounded-2xl border border-amber-200/80 dark:border-stone-800 bg-gradient-to-b from-white to-[#FDFBF7] dark:from-[#211E1A] dark:to-[#1A1816] shadow-sm overflow-hidden font-telugu ${className}`}
    >
      {/* Header bar */}
      <div className="bg-amber-900/5 dark:bg-stone-900 px-5 sm:px-6 py-4 border-b border-amber-200/50 dark:border-stone-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-[#78350F] dark:text-amber-400">
            <MessageSquareHeart className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100 leading-tight">
              ఆర్డర్ డెలివరీ & కస్టమర్ ఫీడ్‌బ్యాక్
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              ఆర్డర్ ఐడీ: <span className="font-mono font-bold text-[#78350F] dark:text-amber-400">{currentOrder.id}</span>
            </p>
          </div>
        </div>

        {isReceived && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <Check className="w-3.5 h-3.5" />
            <span>ఆర్డర్ అందింది</span>
          </span>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* STEP 1: Mark as Received Action */}
        <div className="p-4 sm:p-5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  డెలివరీ స్థితి (Delivery Status)
                </span>
                {currentOrder.fulfillmentStatus === 'DELIVERED' ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    డెలివరీ పూర్తయింది
                  </span>
                ) : currentOrder.fulfillmentStatus === 'OUT_FOR_DELIVERY' ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                    డెలివరీలో ఉంది
                  </span>
                ) : currentOrder.fulfillmentStatus === 'PREPARING' ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    తయారవుతోంది
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                    నమోదైంది (కొత్తది)
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 mt-1">
                {isReceived
                  ? `మీరు ఈ ఆర్డర్ అందుకున్నట్లు విజయవంతంగా రికార్డైంది (${currentOrder.receivedAtIST || currentOrder.createdAtIST}).`
                  : 'మీ చేతికి వేడివేడి జొన్న రొట్టెల ఆర్డర్ అందిన తర్వాత క్రింది బటన్ నొక్కండి.'}
              </p>
            </div>

            {/* Mark as Received Button */}
            {!isReceived ? (
              <button
                type="button"
                id="mark-order-received-btn"
                onClick={handleMarkAsReceived}
                disabled={isMarkingReceived}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-sm transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <PackageCheck className="w-4 h-4" />
                <span>{isMarkingReceived ? 'నమోదు చేస్తోంది...' : '📦 ఆర్డర్ అందిందిగా మార్క్ చేయండి'}</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>ఆర్డర్ స్వీకరించబడింది</span>
              </div>
            )}
          </div>

          {markSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
              <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{markSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* STEP 2: POST-ORDER FEEDBACK SECTION */}
        {/* If feedback already submitted and not in edit mode: show review display */}
        {currentOrder.feedback && !isEditing ? (
          <div className="p-5 rounded-2xl bg-amber-50/70 dark:bg-stone-900 border border-amber-200 dark:border-stone-800 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                  ధన్యవాదాలు! మీ అభిప్రాయం సమర్పించబడింది
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((starVal) => (
                    <Star
                      key={starVal}
                      className={`w-5 h-5 ${
                        starVal <= (currentOrder.feedback?.rating || 5)
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-stone-300 dark:text-stone-700'
                      }`}
                    />
                  ))}
                  <span className="ml-2 font-bold text-sm text-stone-800 dark:text-stone-200">
                    {RATING_LABELS[currentOrder.feedback?.rating || 5]?.telugu}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                id="edit-feedback-btn"
                className="inline-flex items-center gap-1 text-xs text-[#78350F] dark:text-amber-400 hover:underline font-semibold"
              >
                <Edit3 className="w-3 h-3" />
                <span>సవరించండి</span>
              </button>
            </div>

            {/* Selected Aspects */}
            {currentOrder.feedback.aspects && currentOrder.feedback.aspects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {currentOrder.feedback.aspects.map((tagId) => {
                  const tag = FEEDBACK_TAGS.find((t) => t.id === tagId);
                  return tag ? (
                    <span
                      key={tagId}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-stone-800 text-[#78350F] dark:text-amber-300 border border-amber-200 dark:border-stone-700"
                    >
                      {tag.label}
                    </span>
                  ) : null;
                })}
              </div>
            )}

            {/* Comments Quote */}
            {currentOrder.feedback.comments && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-stone-800/80 border border-amber-200/60 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-sm italic">
                "{currentOrder.feedback.comments}"
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 pt-1 border-t border-amber-200/50 dark:border-stone-800 font-mono">
              <span>సమర్పించినవారు: {currentOrder.feedback.customerName}</span>
              <span>{currentOrder.feedback.createdAtIST}</span>
            </div>
          </div>
        ) : (
          /* Feedback Form */
          <form onSubmit={handleSubmitFeedback} className="space-y-5" id="customer-feedback-form">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                  మీ రొట్టెల అనుభవాన్ని రేట్ చేయండి (Rate Your Experience)
                </h4>
                {currentOrder.feedback && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-stone-500 hover:underline"
                  >
                    రద్దు చేయండి
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                రొట్టెల నాణ్యత, రుచి, కారం మరియు డెలివరీపై మీ నిజాయితీతో కూడిన రేటింగ్‌ను ఎంచుకోండి.
              </p>
            </div>

            {/* Interactive 5-Star Rating Control */}
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-stone-900/80 border border-amber-200/60 dark:border-stone-800 flex flex-col items-center justify-center space-y-2 text-center">
              <span className="text-xs font-bold text-stone-600 dark:text-stone-400">
                నక్షత్రాలను నొక్కండి (Tap Stars to Rate):
              </span>
              <div className="flex items-center gap-2 sm:gap-3">
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const isFilled = starVal <= (hoverRating || rating);
                  return (
                    <button
                      key={starVal}
                      type="button"
                      id={`rate-star-${starVal}`}
                      onMouseEnter={() => setHoverRating(starVal)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(starVal)}
                      className="p-1 sm:p-2 rounded-xl hover:bg-amber-100/80 dark:hover:bg-stone-800 transition-all active:scale-95 focus:outline-hidden"
                      aria-label={`Rate ${starVal} stars`}
                    >
                      <Star
                        className={`w-7 h-7 sm:w-8 sm:h-8 transition-transform ${
                          isFilled
                            ? 'fill-amber-400 text-amber-500 scale-110 drop-shadow-xs'
                            : 'text-stone-300 dark:text-stone-700 hover:text-amber-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Telugu description for selected star */}
              <div className="h-5 flex items-center justify-center">
                <span className={`text-sm font-bold ${RATING_LABELS[hoverRating || rating]?.color}`}>
                  {RATING_LABELS[hoverRating || rating]?.telugu}
                </span>
              </div>
            </div>

            {/* Quick Experience Highlights (Pills) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                మీకు బాగా నచ్చిన విషయాలు (Highlights):
              </label>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      id={`tag-btn-${tag.id}`}
                      onClick={() => handleToggleTag(tag.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-[#78350F] text-amber-100 border-[#78350F] dark:bg-amber-500 dark:text-stone-950 dark:border-amber-400 shadow-xs'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-amber-400'
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comments Textarea */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="customer-comment-input" className="font-bold text-stone-700 dark:text-stone-300">
                  మీ అభిప్రాయం లేదా సలహాలు (Comments & Suggestions):
                </label>
                <span className="text-stone-400 font-mono text-[11px]">{comments.length}/500</span>
              </div>
              <textarea
                id="customer-comment-input"
                rows={3}
                maxLength={500}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="ఉదాహరణకు: రొట్టెలు చాలా మెత్తగా ఉన్నాయి, కరివేపాకు కారం రుచి ఎంతో బాగుంది. డెలివరీ సమయానికి అందింది..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden transition-all resize-none"
              />
            </div>

            {/* Reviewer Name */}
            <div className="space-y-1">
              <label htmlFor="customer-name-input" className="block text-xs font-semibold text-stone-600 dark:text-stone-400">
                మీ పేరు (Name):
              </label>
              <input
                type="text"
                id="customer-name-input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="మీ పేరు"
                className="w-full sm:max-w-xs px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs">
                {errorMessage}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                id="submit-feedback-btn"
                disabled={isSubmitting || !rating}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white bg-[#78350F] hover:bg-[#92400E] active:scale-98 shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'సమర్పిస్తోంది...' : 'అభిప్రాయాన్ని సమర్పించండి (Submit Feedback)'}</span>
              </button>

              {!isReceived && (
                <span className="text-[11px] text-stone-500 dark:text-stone-400 italic">
                  * ఫీడ్‌బ్యాక్ సమర్పించగానే ఆర్డర్ అందినట్లు ఆటోమేటిక్‌గా నమోదు చేయబడుతుంది.
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
