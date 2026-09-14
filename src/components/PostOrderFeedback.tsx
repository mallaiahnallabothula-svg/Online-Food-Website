import React, { useState } from 'react';
import {
  Star,
  CheckCircle2,
  ThumbsUp,
  MessageSquare,
  Sparkles,
  PackageCheck,
  Send,
  Loader2,
  Edit3,
} from 'lucide-react';
import { Order, OrderFeedback } from '../types';

interface PostOrderFeedbackProps {
  order: Order;
  onOrderUpdated?: (updatedOrder: Order) => void;
  className?: string;
}

const FEEDBACK_TAGS = [
  { id: 'TASTE_SOFTNESS', label: '🌾 రొట్టెల రుచి & మెత్తదనం (Soft & Tasty)' },
  { id: 'HOT_AND_FRESH', label: '🔥 వేడివేడిగా అందింది (Hot & Fresh)' },
  { id: 'DELICIOUS_KARAM', label: '🌶️ కారాల రుచి అద్భుతం (Super Karam)' },
  { id: 'ON_TIME_DELIVERY', label: '⏰ సమయానికి డెలివరీ (On-time Delivery)' },
  { id: 'HOMEMADE_HYGIENE', label: '🏡 స్వచ్ఛమైన ఇంటి వంట (Hygienic Home Food)' },
  { id: 'POLITE_SERVICE', label: '🤝 చక్కని స్పందన (Polite Delivery)' },
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
  const [comments, setComments] = useState<string>(existingFeedback?.comment || existingFeedback?.comments || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(existingFeedback?.aspects || ['TASTE_SOFTNESS', 'HOT_AND_FRESH']);
  const [customerName, setCustomerName] = useState<string>(
    existingFeedback?.customerName || currentOrder.customer?.name || currentOrder.customerName || ''
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isReceived = currentOrder.isCustomerReceived || currentOrder.fulfillmentStatus === 'DELIVERED' || Boolean(currentOrder.receivedAt);

  // Handler: Customer marks order as received
  const handleMarkAsReceived = async () => {
    setIsMarkingReceived(true);
    setErrorMessage(null);
    try {
      const targetIdentifier = currentOrder.customerAccessToken || currentOrder.id;
      const res = await fetch(`/api/orders/${targetIdentifier}/received`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const nowIso = new Date().toISOString();
        const updated: Order = {
          ...currentOrder,
          fulfillmentStatus: 'DELIVERED',
          isCustomerReceived: true,
          receivedAt: nowIso,
          receivedAtIST: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        };
        setCurrentOrder(updated);
        onOrderUpdated?.(updated);
        setMarkSuccessMsg('ఆర్డర్ అందినట్లుగా ధృవీకరించబడింది! దయచేసి క్రింద మీ రేటింగ్ మరియు అభిప్రాయాన్ని తెలపండి.');
        setIsEditing(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error?.message || err.message || 'ఆర్డర్ స్థితి అప్‌డేట్ చేయడంలో లోపం ఏర్పడింది.');
      }
    } catch {
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
      const targetIdentifier = currentOrder.customerAccessToken || currentOrder.id;
      const res = await fetch(`/api/orders/${targetIdentifier}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment: comments.trim(),
          aspects: selectedTags,
        }),
      });

      if (res.ok) {
        const nowIso = new Date().toISOString();
        const newFb: OrderFeedback = {
          id: `FDB-${Date.now()}`,
          orderId: currentOrder.id,
          rating,
          comment: comments.trim(),
          comments: comments.trim(),
          aspects: selectedTags,
          customerName: customerName.trim() || currentOrder.customer?.name || currentOrder.customerName || 'Customer',
          createdAt: nowIso,
          createdAtIST: new Date().toLocaleDateString('te-IN'),
          isPublic: true,
        };
        const updated: Order = {
          ...currentOrder,
          feedback: newFb,
        };
        setCurrentOrder(updated);
        onOrderUpdated?.(updated);
        setSubmitSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSubmitSuccess(false), 5000);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error?.message || err.message || 'ఫీడ్‌బ్యాక్ సమర్పించడంలో లోపం ఏర్పడింది.');
      }
    } catch {
      setErrorMessage('సర్వర్ కనెక్షన్ లోపం. దయచేసి మళ్లీ ప్రయత్నించండి.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="post-order-feedback-section"
      className={`rounded-2xl border border-amber-200/80 dark:border-stone-800 bg-gradient-to-b from-white to-[#FDFBF7] dark:from-[#211E1A] dark:to-[#1A1816] shadow-xs overflow-hidden font-telugu ${className}`}
    >
      {/* Header bar */}
      <div className="bg-amber-900/5 dark:bg-stone-900 px-5 sm:px-6 py-4 border-b border-amber-200/50 dark:border-stone-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-[#78350F] dark:text-amber-400">
            <PackageCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              డెలివరీ ధృవీకరణ & కస్టమర్ అభిప్రాయం (Delivery & Feedback)
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              ఆర్డర్ నంబర్: <span className="font-mono font-semibold">{currentOrder.id}</span>
            </p>
          </div>
        </div>

        {isReceived && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>చేరింది (Delivered)</span>
          </span>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* STEP 1: Delivery Receipt Confirmation */}
        <div className="bg-[#FAF4EA] dark:bg-stone-900/70 rounded-xl p-4 border border-amber-900/10 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                ప్రస్తుత డెలివరీ స్థితి:
              </span>
              {currentOrder.fulfillmentStatus === 'DELIVERED' || isReceived ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  డెలివరీ పూర్తయింది
                </span>
              ) : currentOrder.fulfillmentStatus === 'OUT_FOR_DELIVERY' ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  డెలివరీ కోసం బయలుదేరింది (6-8 PM)
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
                ? `మీరు ఈ ఆర్డర్ అందుకున్నట్లు విజయవంతంగా రికార్డైంది (${currentOrder.receivedAtIST || currentOrder.receivedAt || currentOrder.createdAtIST || ''}).`
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
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-xs transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {isMarkingReceived ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>నమోదవుతోంది...</span>
                </>
              ) : (
                <>
                  <ThumbsUp className="w-4 h-4" />
                  <span>రొట్టెలు అందాయి (Confirm Received)</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/80">
              <CheckCircle2 className="w-4 h-4" />
              <span>అందుకున్నారు</span>
            </div>
          )}
        </div>

        {markSuccessMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{markSuccessMsg}</span>
          </div>
        )}

        {/* STEP 2: Feedback & Review Section */}
        {currentOrder.feedback && !isEditing ? (
          /* View Submitted Feedback */
          <div className="bg-amber-50/50 dark:bg-stone-900 rounded-xl p-5 border border-amber-200/60 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  మీరు సమర్పించిన రేటింగ్:
                </span>
                <div className="flex text-amber-500">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= currentOrder.feedback!.rating
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-stone-300 dark:text-stone-700'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-bold text-sm text-[#78350F] dark:text-amber-400 font-mono">
                  {currentOrder.feedback.rating}.0
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                id="edit-feedback-btn"
                className="inline-flex items-center gap-1 text-xs text-[#78350F] dark:text-amber-400 hover:underline font-semibold cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>సవరించండి</span>
              </button>
            </div>

            {/* Selected Aspects */}
            {currentOrder.feedback.aspects && currentOrder.feedback.aspects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {currentOrder.feedback.aspects.map((tagId: string) => {
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
            {(currentOrder.feedback.comment || currentOrder.feedback.comments) && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-stone-800/80 border border-amber-200/60 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-sm italic">
                "{currentOrder.feedback.comment || currentOrder.feedback.comments}"
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 pt-1 border-t border-amber-200/50 dark:border-stone-800 font-mono">
              <span>సమర్పించినవారు: {currentOrder.feedback.customerName || 'కస్టమర్'}</span>
              <span>{currentOrder.feedback.createdAtIST || currentOrder.feedback.createdAt?.slice(0, 10)}</span>
            </div>
          </div>
        ) : (
          /* Feedback Form */
          <form onSubmit={handleSubmitFeedback} className="space-y-5" id="customer-feedback-form">
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  జొన్న రొట్టెల అనుభవం ఎలా ఉంది? (Rate your experience)
                </label>
                <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                  {rating === 5 ? 'అద్భుతం! (5/5)' : rating === 4 ? 'చాలా బాగుంది (4/5)' : rating === 3 ? 'బాగుంది (3/5)' : `${rating}/5`}
                </span>
              </div>

              {/* Star Selector */}
              <div className="flex items-center gap-2 mt-2" role="radiogroup" aria-label="Rating out of 5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    id={`feedback-star-${star}`}
                    className="p-1 rounded-lg hover:scale-110 active:scale-95 transition-transform focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    aria-label={`${star} నక్షత్రాలు`}
                  >
                    <Star
                      className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                        (hoverRating || rating) >= star
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-stone-300 dark:text-stone-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Experience Tags */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-2">
                మీకు బాగా నచ్చిన విషయాలు (Select Highlights):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FEEDBACK_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTag(tag.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium text-left border transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-600 text-amber-900 dark:text-amber-100 font-semibold shadow-2xs'
                          : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-amber-400'
                      }`}
                    >
                      <span>{tag.label}</span>
                      {isSelected ? <CheckCircle2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0 ml-1" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Freeform Comment */}
            <div>
              <label
                htmlFor="feedback-comments-input"
                className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-1"
              >
                మరిన్ని అభిప్రాయాలు లేదా సూచనలు (Comments / Suggestions):
              </label>
              <textarea
                id="feedback-comments-input"
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="ఉదా: రొట్టెలు చాలా మెత్తగా ఉన్నాయి, కరివేపాకు కారం అదిరిపోయింది..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-600 focus:border-amber-600 font-telugu"
              />
            </div>

            {/* Reviewer Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="feedback-name-input"
                  className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1"
                >
                  మీ పేరు (Name for review):
                </label>
                <input
                  type="text"
                  id="feedback-name-input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="మీ పేరు"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs font-telugu"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-200 font-semibold">
                {errorMessage}
              </div>
            )}

            {/* Submit / Cancel Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                id="submit-feedback-btn"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-[#78350F] hover:bg-[#8C4A26] active:scale-98 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>సమర్పిస్తోంది...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>అభిప్రాయం సమర్పించండి (Submit Review)</span>
                  </>
                )}
              </button>

              {currentOrder.feedback && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  రద్దు చేయండి (Cancel)
                </button>
              )}
            </div>
          </form>
        )}

        {submitSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>మీ విలువైన అభిప్రాయానికి చాలా ధన్యవాదాలు! ఇది ఇతర కస్టమర్లకు సహాయపడుతుంది.</span>
          </div>
        )}
      </div>
    </div>
  );
};
