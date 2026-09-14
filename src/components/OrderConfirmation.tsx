import React, { useState, useEffect } from 'react';
import { CheckCircle2, MessageSquare, Copy, Check, ArrowRight, MapPin, Send, BellRing, ShieldCheck, Key } from 'lucide-react';
import { Order } from '../types';
import { buildWhatsAppTicket, getWhatsAppUrl, OWNER_PHONE, OWNER_PHONE_DISPLAY } from '../utils/whatsapp';
import { PostOrderFeedback } from './PostOrderFeedback';
import { useLanguage } from '../context/LanguageContext';

interface OrderConfirmationProps {
  order: Order;
  onNewOrder: () => void;
  onOrderUpdated?: (updated: Order) => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({ order, onNewOrder, onOrderUpdated }) => {
  const { t, language } = useLanguage();
  const [currentOrder, setCurrentOrder] = useState<Order>(order);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [autoOpened, setAutoOpened] = useState<boolean>(false);
  const ticketText = buildWhatsAppTicket(currentOrder, language);
  const whatsappUrl = getWhatsAppUrl(currentOrder, language);

  const totalPaid = currentOrder.totalAmount || currentOrder.totalPaid || 0;
  const isTe = language !== 'en';

  // Automatically attempt opening WhatsApp to owner (8499865803) upon order placement
  useEffect(() => {
    try {
      const sessionKey = `wa_prompted_${order.id}`;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, 'true');
        const popup = window.open(whatsappUrl, '_blank');
        if (popup) {
          setAutoOpened(true);
        }
      }
    } catch {}
  }, [order.id, whatsappUrl]);

  const handleCopyTicket = () => {
    navigator.clipboard.writeText(ticketText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAccessToken = () => {
    if (currentOrder.customerAccessToken) {
      navigator.clipboard.writeText(currentOrder.customerAccessToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleOrderChange = (updated: Order) => {
    setCurrentOrder(updated);
    onOrderUpdated?.(updated);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 font-telugu">
      <div className="bg-white dark:bg-[#211E1A] rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        
        {/* Success Banner */}
        <div className="p-6 sm:p-8 text-center text-white bg-gradient-to-r from-emerald-700 to-emerald-800">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mx-auto mb-3 shadow-inner">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-telugu tracking-tight">
            {t.orderConfirmedTitle}
          </h2>
          <p className="text-emerald-100 text-sm mt-1">
            {t.orderConfirmedSubtitleUpi}
          </p>
          <div className="inline-block mt-3 px-4 py-1.5 rounded-full bg-black/25 text-white text-xs font-mono font-bold tracking-wide border border-white/20">
            {t.orderNumberLabel}: {currentOrder.id}
          </div>
        </div>

        {/* Core Order Summary Card */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Customer Access Token Bar */}
          {currentOrder.customerAccessToken && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#78350F] dark:text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold text-amber-900 dark:text-amber-200">
                    {isTe ? 'మీ వ్యక్తిగత ట్రాకింగ్ కీ (Private Tracking Key):' : 'Your Private Tracking Key:'}
                  </span>
                  <span className="font-mono text-stone-600 dark:text-stone-400 block text-[11px] truncate max-w-xs">
                    {currentOrder.customerAccessToken}
                  </span>
                </div>
              </div>
              <button
                onClick={handleCopyAccessToken}
                className="px-2.5 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 font-bold hover:bg-stone-100 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedToken ? 'కాపీ అయింది' : 'కీ కాపీ చేయి'}</span>
              </button>
            </div>
          )}

          {/* Order Snapshot Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#FAF4EA] dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800">
            <div>
              <span className="text-xs text-stone-500 dark:text-stone-400 block">{t.orderDetailsTitle}:</span>
              <div className="space-y-1 mt-0.5">
                {(currentOrder.jowarQuantity > 0) && (
                  <div className="text-sm font-bold text-[#78350F] dark:text-amber-400 font-mono">
                    🌾 {currentOrder.jowarQuantity} {language === 'en' ? 'Jowar Rotis' : 'జొన్న రొట్టెలు'}
                    <span className="text-[11px] text-stone-500 dark:text-stone-400 font-normal block font-sans">
                      ₹30 × {currentOrder.jowarQuantity} = ₹{currentOrder.jowarQuantity * 30}
                    </span>
                  </div>
                )}
                {(currentOrder.chapathiQuantity > 0) && (
                  <div className="text-sm font-bold text-amber-700 dark:text-amber-300 font-mono">
                    🥞 {currentOrder.chapathiQuantity} {language === 'en' ? 'Chapathis' : 'చపాతీలు'}
                    <span className="text-[11px] text-stone-500 dark:text-stone-400 font-normal block font-sans">
                      ₹10 × {currentOrder.chapathiQuantity} = ₹{currentOrder.chapathiQuantity * 10}
                    </span>
                  </div>
                )}
                <span className="text-[11px] text-stone-500 block font-mono">
                  {language === 'en' ? 'Total items' : 'మొత్తం ఐటెమ్స్'}: {currentOrder.totalItems || (currentOrder.jowarQuantity + currentOrder.chapathiQuantity)}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs text-stone-500 dark:text-stone-400 block">{language === 'en' ? 'Payment Details:' : 'చెల్లింపు వివరాలు:'}</span>
              <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                ₹{totalPaid} {t.paidStatus}
              </span>
              <span className="text-[11px] text-stone-500 block font-mono">
                {currentOrder.providerPaymentId ? `Ref: ${currentOrder.providerPaymentId.slice(0, 18)}` : 'Mode: Verified UPI Online'}
              </span>
              {typeof currentOrder.deliveryCharge === 'number' && currentOrder.deliveryCharge > 0 ? (
                <span className="text-[11px] text-amber-700 dark:text-amber-400 block font-medium mt-0.5">
                  {language === 'en'
                    ? `(Includes ₹${currentOrder.deliveryCharge} delivery fee)`
                    : `(డెలివరీ ఛార్జీ ₹${currentOrder.deliveryCharge} కలిపి)`}
                </span>
              ) : (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-medium mt-0.5">
                  {language === 'en' ? '✓ Free delivery (≤ 5 km)' : '✓ ఉచిత డెలివరీ (5 కి.మీ. లోపల)'}
                </span>
              )}
            </div>

            <div>
              <span className="text-xs text-stone-500 dark:text-stone-400 block">{t.deliveryTimeWindowLabel}:</span>
              <span className="text-sm font-bold text-stone-900 dark:text-stone-100 block">
                {currentOrder.deliveryDate}
              </span>
              <span className="text-xs text-[#78350F] dark:text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{currentOrder.deliveryWindow || '6:00 PM – 8:00 PM'}</span>
              </span>
            </div>
          </div>

          {/* Complimentary Karams Notice */}
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200">
            <span className="font-bold block mb-1">🎁 {isTe ? 'ఉచితంగా అందించిన కారాలు:' : 'Complimentary Karams:'}</span>
            <div className="flex flex-wrap gap-3">
              {currentOrder.karivepakuGrams ? (
                <span>✓ {isTe ? 'కరివేపాకు కారం' : 'Curry Leaf Karam'} ({currentOrder.karivepakuGrams} {t.gramsUnit})</span>
              ) : null}
              {currentOrder.aviseGrams ? (
                <span>✓ {isTe ? 'అవిసె గింజల కారం' : 'Flax Seed Karam'} ({currentOrder.aviseGrams} {t.gramsUnit})</span>
              ) : null}
            </div>
          </div>

          {/* WhatsApp Direct Notification Ticket */}
          <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                {isTe ? 'వంటశాల వాట్సాప్ రసీదు (WhatsApp Notification):' : 'Kitchen WhatsApp Receipt:'}
              </span>
              <button
                onClick={handleCopyTicket}
                className="text-xs text-amber-800 dark:text-amber-400 hover:underline flex items-center gap-1 font-bold"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'కాపీ అయింది' : 'రసీదు కాపీ చేయి'}</span>
              </button>
            </div>

            <pre className="p-3 bg-white dark:bg-black/40 rounded-lg text-[11px] font-mono whitespace-pre-wrap text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 max-h-36 overflow-y-auto">
              {ticketText}
            </pre>

            <div className="flex flex-wrap gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isTe ? 'వాట్సాప్‌లో వివరాలు పంపండి' : 'Send Details on WhatsApp'}</span>
              </a>

              <button
                onClick={onNewOrder}
                className="py-2.5 px-4 bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-bold rounded-xl hover:bg-stone-300 transition-colors"
              >
                {isTe ? 'మరొక ఆర్డర్ చేయండి' : 'Order More'}
              </button>
            </div>
          </div>

          {/* Post-Order Feedback & Delivery Confirmation Component */}
          <PostOrderFeedback
            order={currentOrder}
            onOrderUpdated={handleOrderChange}
          />
        </div>
      </div>
    </div>
  );
};
