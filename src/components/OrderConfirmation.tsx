import React, { useState } from 'react';
import { CheckCircle2, MessageSquare, Copy, Check, ArrowRight, ShieldCheck, MapPin, Calendar, Clock } from 'lucide-react';
import { Order } from '../types';
import { buildWhatsAppTicket, getWhatsAppUrl, OWNER_PHONE_DISPLAY } from '../utils/whatsapp';

interface OrderConfirmationProps {
  order: Order;
  onNewOrder: () => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({ order, onNewOrder }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const ticketText = buildWhatsAppTicket(order);
  const whatsappUrl = getWhatsAppUrl(order);

  const handleCopyTicket = () => {
    navigator.clipboard.writeText(ticketText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 font-telugu">
      <div className="bg-white dark:bg-[#211E1A] rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        
        {/* Success Banner */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 text-white p-6 sm:p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mx-auto mb-3 shadow-inner">
            <CheckCircle2 className="w-10 h-10 text-emerald-100" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-telugu tracking-tight">
            ధన్యవాదాలు! మీ ఆర్డర్ విజయవంతంగా నమోదైంది
          </h2>
          <p className="text-emerald-100 text-sm mt-1">
            ఆన్‌లైన్ UPI చెల్లింపు సర్వర్ ద్వారా ధృవీకరించబడింది. మీ ఆర్డర్ మా కిచెన్‌లో నమోదు చేయబడింది.
          </p>
          <div className="inline-block mt-3 px-4 py-1.5 rounded-full bg-emerald-900/60 text-emerald-100 text-xs font-mono font-bold tracking-wide border border-emerald-500/30">
            ఆర్డర్ నంబర్: {order.id}
          </div>
        </div>

        {/* Core Order Summary Card */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Order Snapshot Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#FAF4EA] dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800">
            <div>
              <span className="text-xs text-stone-500 dark:text-stone-400 block">జొన్న రొట్టెలు:</span>
              <span className="text-lg font-bold text-[#78350F] dark:text-amber-400 font-mono">
                {order.quantity} రొట్టెలు
              </span>
              <span className="text-[11px] text-stone-500 block font-mono">₹{order.pricePerRoti} చొప్పున</span>
            </div>

            <div>
              <span className="text-xs text-stone-500 dark:text-stone-400 block">మొత్తం చెల్లింపు:</span>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                ₹{order.totalPaid} (పూర్తయింది)
              </span>
              <span className="text-[11px] text-stone-500 block font-mono">Ref: {order.paymentReference.slice(0, 16)}</span>
            </div>

            <div>
              <span className="text-xs text-stone-500 dark:text-stone-400 block">డెలివరీ సమయం:</span>
              <span className="text-base font-bold text-stone-800 dark:text-stone-200">
                {order.deliveryWindow}
              </span>
              <span className="text-[11px] text-stone-500 block">{order.deliveryDate}</span>
            </div>
          </div>

          {/* Free Karam Details */}
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-200 mb-2">
              🎁 ఉచిత కారాలు (Free Karams Included):
            </h4>
            <div className="space-y-1 text-xs sm:text-sm text-emerald-900 dark:text-emerald-300">
              {order.karamQuantities.karivepakuGrams > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>కరివేపాకు కారం: <strong>{order.karamQuantities.karivepakuGrams} గ్రాములు</strong> (ఉచితం)</span>
                </div>
              )}
              {order.karamQuantities.aviseGinjaluGrams > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>అవిసె గింజల కారం: <strong>{order.karamQuantities.aviseGinjaluGrams} గ్రాములు</strong> (ఉచితం)</span>
                </div>
              )}
              {order.karamQuantities.karivepakuGrams === 0 && order.karamQuantities.aviseGinjaluGrams === 0 && (
                <span className="text-stone-500 italic">కారాలు ఏమీ ఎంచుకోలేదు.</span>
              )}
            </div>
          </div>

          {/* Delivery Address Review */}
          <div className="space-y-1 text-sm text-stone-700 dark:text-stone-300">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#78350F] dark:text-amber-400 mt-1 flex-shrink-0" />
              <div>
                <span className="font-bold">డెలివరీ చిరునామా: </span>
                <span>{order.customer.name} (+91 {order.customer.mobile}), {order.customer.address}</span>
                {order.customer.landmark && (
                  <span className="block text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    ల్యాండ్మార్క్: {order.customer.landmark}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* WHATSAPP ACTION SECTION (Directly following prompt requirements) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-amber-50/90 dark:bg-stone-900 border-2 border-amber-300 dark:border-stone-700 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-600 text-white">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
                  ఆర్డర్ కాపీని WhatsAppలో పొందండి / యజమానికి పంపండి
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  యజమాని నంబర్: {OWNER_PHONE_DISPLAY}
                </p>
              </div>
            </div>

            {/* Crucial Instructions Banner (Explicit Requirement) */}
            <div className="bg-white/80 dark:bg-stone-800/80 p-3.5 rounded-xl border border-amber-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 space-y-1.5 leading-relaxed">
              <p className="font-bold text-amber-900 dark:text-amber-300">
                ముఖ్యమైన సూచన:
              </p>
              <p>
                1. క్రింది బటన్ నొక్కినప్పుడు మీ మొబైల్ లేదా కంప్యూటర్‌లో WhatsApp తెరవబడుతుంది.
              </p>
              <p>
                2. <strong>దయచేసి WhatsAppలో 'Send' బటన్ తప్పనిసరిగా నొక్కండి.</strong> కేవలం వాట్సాప్ తెరవడం వల్ల మెసేజ్ ఆటోమేటిక్‌గా వెళ్లదు.
              </p>
              <p className="text-emerald-800 dark:text-emerald-300 font-semibold">
                3. మీరు వాట్సాప్ మెసేజ్ పంపకపోయినా కూడా మీ ఆర్డర్ మా సిస్టమ్‌లో సురక్షితంగా రికార్డైంది మరియు నిర్ణీత సమయంలో డెలివరీ చేయబడుతుంది.
              </p>
            </div>

            {/* Prominent WhatsApp Ticket Button */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                id="send-whatsapp-ticket-btn"
                className="flex-1 inline-flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base text-white bg-[#25D366] hover:bg-[#1EBE5D] active:scale-[0.99] shadow-md transition-all"
              >
                <MessageSquare className="w-5 h-5" />
                <span>ఆర్డర్ వివరాలు WhatsAppలో పంపండి</span>
              </a>

              <button
                type="button"
                onClick={handleCopyTicket}
                id="copy-ticket-text-btn"
                className="px-4 py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700 flex items-center justify-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'టికెట్ కాపీ చేయబడింది!' : 'టికెట్ కాపీ చేయండి'}</span>
              </button>
            </div>
          </div>

          {/* Ticket Preview Box */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-4 bg-stone-50 dark:bg-stone-900/50">
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400 block mb-2">
              WhatsApp టికెట్ ముందస్తు రూపం:
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
              className="inline-flex items-center gap-2 text-sm font-bold text-[#78350F] dark:text-amber-400 hover:underline"
            >
              <span>మరొక ఆర్డర్ చేయండి</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
