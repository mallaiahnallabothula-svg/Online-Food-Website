import React, { useState, useEffect } from 'react';
import { CheckCircle2, MessageSquare, Copy, Check, ArrowRight, MapPin, Send, BellRing } from 'lucide-react';
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
  const [autoOpened, setAutoOpened] = useState<boolean>(false);
  const ticketText = buildWhatsAppTicket(currentOrder, language);
  const whatsappUrl = getWhatsAppUrl(currentOrder, language);

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

  const handleOrderChange = (updated: Order) => {
    setCurrentOrder(updated);
    onOrderUpdated?.(updated);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 font-telugu">
      <div className="bg-white dark:bg-[#211E1A] rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        
        {/* Success Banner */}
        <div className={`p-6 sm:p-8 text-center text-white ${
          order.paymentStatus === 'PAY_ON_DELIVERY'
            ? 'bg-gradient-to-r from-amber-700 to-amber-800'
            : 'bg-gradient-to-r from-emerald-700 to-emerald-800'
        }`}>
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mx-auto mb-3 shadow-inner">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-telugu tracking-tight">
            {t.orderConfirmedTitle}
          </h2>
          <p className="text-amber-100 dark:text-emerald-100 text-sm mt-1">
            {order.paymentStatus === 'PAY_ON_DELIVERY'
              ? t.orderConfirmedSubtitlePod
              : t.orderConfirmedSubtitleUpi}
          </p>
          <div className="inline-block mt-3 px-4 py-1.5 rounded-full bg-black/25 text-white text-xs font-mono font-bold tracking-wide border border-white/20">
            {t.orderNumberLabel}: {order.id}
          </div>
        </div>

        {/* Core Order Summary Card */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Order Snapshot Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#FAF4EA] dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800">
            <div>
              <span className="text-xs text-stone-500 dark:text-stone-400 block">{t.orderDetailsTitle}:</span>
              {(order.jowarQuantity !== undefined || order.chapathiQuantity !== undefined) ? (
                <div className="space-y-1 mt-0.5">
                  {(order.jowarQuantity ?? (order.chapathiQuantity ? 0 : order.quantity)) > 0 && (
                    <div className="text-sm font-bold text-[#78350F] dark:text-amber-400 font-mono">
                      🌾 {order.jowarQuantity ?? order.quantity} {language === 'en' ? 'Jowar Rotis' : 'జొన్న రొట్టెలు'}
                      <span className="text-[11px] text-stone-500 dark:text-stone-400 font-normal block font-sans">
                        ₹30 × {order.jowarQuantity ?? order.quantity} = ₹{(order.jowarQuantity ?? order.quantity) * 30}
                      </span>
                    </div>
                  )}
                  {(order.chapathiQuantity ?? 0) > 0 && (
                    <div className="text-sm font-bold text-amber-700 dark:text-amber-300 font-mono">
                      🥞 {order.chapathiQuantity} {language === 'en' ? 'Chapathis' : 'చపాతీలు'}
                      <span className="text-[11px] text-stone-500 dark:text-stone-400 font-normal block font-sans">
                        ₹10 × {order.chapathiQuantity} = ₹{(order.chapathiQuantity || 0) * 10}
                      </span>
                    </div>
                  )}
                  <span className="text-[11px] text-stone-500 block font-mono">
                    {language === 'en' ? 'Total items' : 'మొత్తం ఐటెమ్స్'}: {order.quantity}
                  </span>
                </div>
              ) : (
                <>
                  <span className="text-lg font-bold text-[#78350F] dark:text-amber-400 font-mono">
                    {order.quantity} {t.rotisUnit}
                  </span>
                  <span className="text-[11px] text-stone-500 block font-mono">₹{order.pricePerRoti} {language === 'en' ? 'each' : 'చొప్పున'}</span>
                </>
              )}
            </div>

            <div>
              <span className="text-xs text-stone-500 dark:text-stone-400 block">{language === 'en' ? 'Payment Details:' : 'చెల్లింపు వివరాలు:'}</span>
              <span className={`text-lg font-bold font-mono ${
                order.paymentStatus === 'PAY_ON_DELIVERY'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}>
                ₹{order.totalPaid} {order.paymentStatus === 'PAY_ON_DELIVERY' ? t.payAtDeliveryStatus : t.paidStatus}
              </span>
              <span className="text-[11px] text-stone-500 block font-mono">
                {order.paymentStatus === 'PAY_ON_DELIVERY' 
                  ? (language === 'en' ? 'Mode: Cash/UPI on delivery' : 'విధానం: డెలివరీ సమయంలో నగదు/UPI') 
                  : `Ref: ${order.paymentReference.slice(0, 16)}`}
              </span>
              {typeof order.deliveryCharge === 'number' && order.deliveryCharge > 0 ? (
                <span className="text-[11px] text-amber-700 dark:text-amber-400 block font-medium mt-0.5">
                  {language === 'en'
                    ? `(Includes ₹${order.deliveryCharge} delivery fee)`
                    : `(డెలివరీ ఛార్జీ ₹${order.deliveryCharge} కలిపి)`}
                </span>
              ) : (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-medium mt-0.5">
                  {language === 'en' ? '✓ Free delivery (≤ 5 km)' : '✓ ఉచిత డెలివరీ (5 కి.మీ. లోపల)'}
                </span>
              )}
            </div>

            <div>
              <span className="text-xs text-stone-500 dark:text-stone-400 block">{t.deliveryTimeWindowLabel}:</span>
              <span className="text-base font-bold text-stone-800 dark:text-stone-200">
                {order.deliveryWindow}
              </span>
              <span className="text-[11px] text-stone-500 block">{order.deliveryDate}</span>
            </div>
          </div>

          {/* Free Karam Details */}
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-200 mb-2">
              🎁 {t.freeKaramsIncluded}:
            </h4>
            <div className="space-y-1 text-xs sm:text-sm text-emerald-900 dark:text-emerald-300">
              {order.karamQuantities.karivepakuGrams > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>{t.karivepakuTitle}: <strong>{order.karamQuantities.karivepakuGrams} {t.gramsUnit}</strong> ({t.freeCostZero})</span>
                </div>
              )}
              {order.karamQuantities.aviseGinjaluGrams > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>{t.aviseTitle}: <strong>{order.karamQuantities.aviseGinjaluGrams} {t.gramsUnit}</strong> ({t.freeCostZero})</span>
                </div>
              )}
              {order.karamQuantities.karivepakuGrams === 0 && order.karamQuantities.aviseGinjaluGrams === 0 && (
                <span className="text-stone-500 italic">{language === 'en' ? 'No karam selected.' : 'కారాలు ఏమీ ఎంచుకోలేదు.'}</span>
              )}
            </div>
          </div>

          {/* Delivery Address Review */}
          <div className="space-y-1 text-sm text-stone-700 dark:text-stone-300">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#78350F] dark:text-amber-400 mt-1 flex-shrink-0" />
              <div>
                <span className="font-bold">{t.deliveryAddressHeader}: </span>
                <span>{order.customer.name} (+91 {order.customer.mobile}), {order.customer.address}</span>
                {order.customer.landmark && (
                  <span className="block text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    {t.landmarkLabel}: {order.customer.landmark}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* WHATSAPP ACTION SECTION */}
          <div className="p-5 sm:p-6 rounded-2xl bg-amber-50/90 dark:bg-stone-900 border-2 border-amber-300 dark:border-stone-700 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-600 text-white">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
                  {language === 'en' ? 'Send order copy to owner via WhatsApp' : 'ఆర్డర్ కాపీని WhatsAppలో పొందండి / యజమానికి పంపండి'}
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  {language === 'en' ? 'Owner Contact:' : 'యజమాని నంబర్:'} {OWNER_PHONE_DISPLAY}
                </p>
              </div>
            </div>

            {/* Instructions Banner */}
            <div className="bg-white/80 dark:bg-stone-800/80 p-3.5 rounded-xl border border-amber-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 space-y-1.5 leading-relaxed">
              <p className="font-bold text-amber-900 dark:text-amber-300">
                {language === 'en' ? 'Important Note:' : 'ముఖ్యమైన సూచన:'}
              </p>
              <p>
                {language === 'en'
                  ? "1. Clicking the button opens WhatsApp on your phone or computer with order details."
                  : "1. క్రింది బటన్ నొక్కినప్పుడు మీ మొబైల్ లేదా కంప్యూటర్‌లో WhatsApp తెరవబడుతుంది."}
              </p>
              <p>
                {language === 'en'
                  ? "2. Please tap 'Send' inside WhatsApp to deliver the message to the kitchen owner."
                  : "2. దయచేసి WhatsAppలో 'Send' బటన్ తప్పనిసరిగా నొక్కండి."}
              </p>
              <p className="text-emerald-800 dark:text-emerald-300 font-semibold">
                {language === 'en'
                  ? "3. Even if you do not send the WhatsApp message, your order is already confirmed in our system."
                  : "3. మీరు వాట్సాప్ మెసేజ్ పంపకపోయినా కూడా మీ ఆర్డర్ మా సిస్టమ్‌లో సురక్షితంగా రికార్డైంది మరియు సమయానికి డెలివరీ చేయబడుతుంది."}
              </p>
            </div>

            {/* WhatsApp Ticket Button */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                id="send-whatsapp-ticket-btn"
                className="flex-1 inline-flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base text-white bg-[#25D366] hover:bg-[#1EBE5D] active:scale-[0.99] shadow-md transition-all cursor-pointer ring-2 ring-emerald-500/30"
              >
                <MessageSquare className="w-5 h-5 fill-current" />
                <span>
                  {language === 'en' 
                    ? 'Send Order Ticket via WhatsApp (+91 8499865803)' 
                    : 'WhatsApp లో యజమానికి ఆర్డర్ టికెట్ పంపండి (+91 8499865803)'}
                </span>
              </a>

              <button
                type="button"
                onClick={handleCopyTicket}
                id="copy-ticket-text-btn"
                className="px-4 py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? t.ticketCopiedBtn : t.copyTicketBtn}</span>
              </button>
            </div>
          </div>

          {/* Post-Order Feedback & Delivery Confirmation Component */}
          <PostOrderFeedback
            order={currentOrder}
            onOrderUpdated={handleOrderChange}
          />

          {/* Ticket Preview Box */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-4 bg-stone-50 dark:bg-stone-900/50">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400 block mb-2">
              {language === 'en' ? 'WhatsApp Ticket Preview:' : 'WhatsApp టికెట్ ముందస్తు రూపం:'}
            </span>
            <pre className="font-sans text-xs text-stone-800 dark:text-stone-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {ticketText}
            </pre>
          </div>

          {/* New Order CTA */}
          <div className="pt-4 text-center">
            <button
              onClick={onNewOrder}
              id="new-order-btn"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#78350F] dark:text-amber-400 hover:underline cursor-pointer"
            >
              <span>{t.orderAgainBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
