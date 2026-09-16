import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { X, CheckCircle2, AlertTriangle, Copy, Check, Smartphone, RefreshCw, Lock, Radio } from 'lucide-react';
import { Order } from '../types';
import { BrandEmblem } from './BrandEmblem';
import { useLanguage } from '../context/LanguageContext';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: {
    jowarQuantity: number;
    chapathiQuantity: number;
    karamSelection: {
      karivepaku: boolean;
      aviseGinjalu: boolean;
    };
    customer: {
      name: string;
      mobile: string;
      address: string;
      landmark?: string;
      locationLink?: string;
      latitude?: number;
      longitude?: number;
    };
  };
  onPaymentSuccess: (confirmedOrder: Order) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  orderData,
  onPaymentSuccess,
}) => {
  const { language } = useLanguage();
  const isTe = language !== 'en';

  const [isLoadingIntent, setIsLoadingIntent] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Payment Intent from server
  const [intentData, setIntentData] = useState<{
    intentId: string;
    orderId: string;
    customerAccessToken: string;
    orderStatus: string;
    provider: string;
    amountRupees: number;
    subtotalRupees: number;
    deliveryChargeRupees: number;
    distanceKm: number;
    businessUpiId: string;
    businessPhone: string;
    upiUri: string;
  } | null>(null);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [paymentState, setPaymentState] = useState<'AWAITING_PAYMENT' | 'VERIFYING' | 'CONFIRMED_REDIRECTING'>('AWAITING_PAYMENT');
  
  const pollingIntervalRef = useRef<any>(null);
  const isSuccessHandledRef = useRef<boolean>(false);

  // 1. Create Server-Authoritative Payment Intent & Pending Order
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingIntent(true);
    setErrorMessage('');
    setIntentData(null);
    setPaymentState('AWAITING_PAYMENT');
    isSuccessHandledRef.current = false;

    async function initIntent() {
      try {
        const res = await fetch('/api/payment/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jowarQuantity: orderData.jowarQuantity,
            chapathiQuantity: orderData.chapathiQuantity,
            karamSelection: orderData.karamSelection,
            customer: orderData.customer,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || 'Failed to initialize payment with server.');
        }

        if (isMounted) {
          setIntentData(data);

          // Generate QR code for clean UPI intent
          const upiUri = data.upiUri || `upi://pay?pa=${data.businessUpiId}&pn=${encodeURIComponent('Mana Enti Vanta')}&am=${data.amountRupees}&cu=INR&tr=${data.orderId}`;
          QRCode.toDataURL(upiUri, {
            width: 260,
            margin: 1,
            color: { dark: '#451A03', light: '#FFFFFF' },
          }).then(url => {
            if (isMounted) setQrCodeDataUrl(url);
          }).catch(() => {});
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Payment server connection error.');
        }
      } finally {
        if (isMounted) setIsLoadingIntent(false);
      }
    }

    initIntent();

    return () => {
      isMounted = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isOpen, orderData]);

  // 2. Automated Gateway Status Polling (No manual actions)
  // Polls server every 1.5 seconds for authoritative gateway webhook / verification
  useEffect(() => {
    if (!isOpen || !intentData || isSuccessHandledRef.current) return;

    const lookupId = intentData.customerAccessToken || intentData.intentId || intentData.orderId;
    if (!lookupId) return;

    const pollStatus = async () => {
      if (isSuccessHandledRef.current) return;

      try {
        const res = await fetch(`/api/payment/status/${lookupId}`);
        if (!res.ok) return;

        const statusData = await res.json();

        // Server authoritative check:
        // When payment status is PAID and ticket has been generated:
        if (
          statusData.isPaid === true &&
          (statusData.orderStatus === 'TICKET_GENERATED' || statusData.ticketGenerated === true) &&
          statusData.order
        ) {
          if (isSuccessHandledRef.current) return;
          isSuccessHandledRef.current = true;

          // Clear polling immediately
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          setPaymentState('CONFIRMED_REDIRECTING');

          // Short visual confirmation before instant transition
          setTimeout(() => {
            const confirmedOrder: Order = {
              ...statusData.order,
              customerAccessToken: statusData.customerAccessToken || intentData.customerAccessToken,
              orderStatus: 'TICKET_GENERATED',
              ticketText: statusData.ticket || statusData.order.ticketText,
            };
            onPaymentSuccess(confirmedOrder);
          }, 800);
        } else if (statusData.isPaid === true) {
          setPaymentState('VERIFYING');
        }
      } catch (err) {
        // Soft fail on network jitter, polling will retry next tick
      }
    };

    // Run first check after a brief initial pause to let UPI app settle
    const initialTimer = setTimeout(() => {
      pollStatus();
      pollingIntervalRef.current = setInterval(pollStatus, 1600);
    }, 1200);

    return () => {
      clearTimeout(initialTimer);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isOpen, intentData, onPaymentSuccess]);

  if (!isOpen) return null;

  const handleCopyUpi = () => {
    if (intentData?.businessUpiId) {
      navigator.clipboard.writeText(intentData.businessUpiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#211E1A] w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden relative font-telugu my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#78350F] to-[#92400E] p-5 sm:p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandEmblem size="sm" />
            <div>
              <h3 className="font-bold text-lg sm:text-xl leading-tight">
                {isTe ? 'సురక్షిత ఆన్‌లైన్ UPI చెల్లింపు' : 'Secure Online UPI Payment'}
              </h3>
              <p className="text-xs text-amber-200 mt-0.5">
                {isTe ? 'ఆన్‌లైన్ పేమెంట్ మాత్రమే (No COD)' : 'Online Payment Only (No COD)'}
              </p>
            </div>
          </div>
          {paymentState !== 'CONFIRMED_REDIRECTING' && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          
          {isLoadingIntent ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-700 dark:text-amber-400 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
                {isTe ? 'సర్వర్ నుండి సురక్షిత చెల్లింపు వివరాలు పొందుతోంది...' : 'Initializing secure server payment intent...'}
              </p>
            </div>
          ) : errorMessage && !intentData ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-red-700 dark:text-red-400">
                  {isTe ? 'ఆర్డర్ ప్రారంభించడం సాధ్యపడలేదు' : 'Unable to Start Order'}
                </h4>
                <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mx-auto">
                  {errorMessage}
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-bold rounded-xl cursor-pointer"
              >
                {isTe ? 'సరిచేయడానికి వెనుకకు వెళ్ళు' : 'Go Back & Edit'}
              </button>
            </div>
          ) : intentData && (
            <>
              {/* Order Pricing Breakdown (Authoritative from Server) */}
              <div className="bg-stone-50 dark:bg-[#1A1816] p-4 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2">
                <div className="flex justify-between items-center text-xs text-stone-600 dark:text-stone-400">
                  <span>
                    {isTe ? 'రొట్టెలు & చపాతీల మొత్తం' : 'Items Subtotal'} ({orderData.jowarQuantity > 0 ? `${orderData.jowarQuantity} జొన్న` : ''}{orderData.jowarQuantity > 0 && orderData.chapathiQuantity > 0 ? ' + ' : ''}{orderData.chapathiQuantity > 0 ? `${orderData.chapathiQuantity} చపాతీ` : ''})
                  </span>
                  <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                    ₹{intentData.subtotalRupees}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-stone-600 dark:text-stone-400">
                  <span>
                    {isTe ? 'డెలివరీ రుసుము' : 'Delivery Fee'} ({intentData.distanceKm} km)
                  </span>
                  <span className="font-mono font-bold">
                    {intentData.deliveryChargeRupees === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {isTe ? 'ఉచితం (₹0)' : 'FREE (₹0)'}
                      </span>
                    ) : (
                      <span className="text-stone-800 dark:text-stone-200">
                        ₹{intentData.deliveryChargeRupees}
                      </span>
                    )}
                  </span>
                </div>

                <div className="border-t border-stone-200 dark:border-stone-800 pt-2 flex justify-between items-center font-bold text-stone-900 dark:text-stone-100">
                  <div>
                    <span className="text-sm">
                      {isTe ? 'చెల్లించాల్సిన మొత్తం' : 'Total Payable'}
                    </span>
                    <p className="text-[10px] text-stone-500 font-normal">
                      {isTe ? `ఆర్డర్ ID: ${intentData.orderId}` : `Order ID: ${intentData.orderId}`}
                    </p>
                  </div>
                  <span className="text-2xl text-[#78350F] dark:text-amber-400 font-mono font-extrabold">
                    ₹{intentData.amountRupees}
                  </span>
                </div>
              </div>

              {/* UPI QR & Payment Action */}
              <div className="text-center space-y-3">
                {qrCodeDataUrl ? (
                  <div className="inline-block p-2 bg-white rounded-2xl border border-stone-200 shadow-sm relative">
                    <img
                      src={qrCodeDataUrl}
                      alt="UPI QR Code"
                      className="w-44 h-44 mx-auto rounded-xl"
                    />
                    {paymentState === 'CONFIRMED_REDIRECTING' && (
                      <div className="absolute inset-0 bg-white/90 dark:bg-stone-900/90 rounded-2xl flex flex-col items-center justify-center p-4">
                        <CheckCircle2 className="w-12 h-12 text-emerald-600 animate-bounce" />
                        <span className="text-xs font-bold text-emerald-700 mt-2">
                          {isTe ? 'చెల్లింపు పూర్తయింది!' : 'Payment Complete!'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                    {isTe ? 'PhonePe, Google Pay, Paytm, BHIM ద్వారా స్కాన్ చేయండి' : 'Scan using PhonePe, Google Pay, Paytm, or BHIM'}
                  </p>
                  
                  {/* UPI ID copy */}
                  <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-full text-xs">
                    <span className="font-mono font-bold text-amber-900 dark:text-amber-200">
                      {intentData.businessUpiId}
                    </span>
                    <button
                      onClick={handleCopyUpi}
                      className="text-amber-700 dark:text-amber-400 hover:text-amber-900 p-0.5 cursor-pointer"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Mobile Deep Link: Open Directly in UPI App */}
                  {intentData.upiUri && (
                    <div className="pt-1">
                      <a
                        href={intentData.upiUri}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold rounded-xl transition-colors"
                      >
                        <Smartphone className="w-4 h-4 text-[#78350F] dark:text-amber-400" />
                        <span>{isTe ? 'మొబైల్ UPI యాప్‌లో చెల్లించండి' : 'Pay via Mobile UPI App'}</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* AUTOMATED VERIFICATION & STATUS BANNER (No manual buttons) */}
              <div className="rounded-2xl border p-4 transition-all duration-300">
                {paymentState === 'CONFIRMED_REDIRECTING' ? (
                  <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">
                        {isTe ? 'పేమెంట్ ధృవీకరించబడింది! టికెట్ తయారైంది' : 'Payment Verified! Ticket Generated'}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {isTe ? 'ఆర్డర్ కన్ఫర్మేషన్ పేజీకి మళ్లిస్తోంది...' : 'Redirecting to your Order Confirmation page...'}
                      </p>
                    </div>
                  </div>
                ) : paymentState === 'VERIFYING' ? (
                  <div className="flex items-center gap-3 text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
                    <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">
                        {isTe ? 'బ్యాంక్ చెల్లింపు ధృవీకరించబడుతోంది...' : 'Verifying Bank Payment with Gateway...'}
                      </h4>
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        {isTe ? 'దయచేసి వేచి ఉండండి, కొద్ది క్షణాల్లో టికెట్ జనరేట్ అవుతుంది.' : 'Please wait, generating order ticket in a moment.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600"></span>
                        </span>
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          {isTe ? 'చెల్లింపు కోసం వేచి చూస్తున్నాము...' : 'Waiting for payment confirmation...'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                        <span>{isTe ? 'లైవ్' : 'LIVE'}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                      {isTe
                        ? 'మీరు UPI యాప్‌లో చెల్లింపు పూర్తి చేయగానే, గేట్‌వే ధృవీకరణ ద్వారా ఆర్డర్ & వాట్సాప్ టికెట్ ఆటోమేటిక్‌గా ఖరారై తెరపైకి వస్తాయి.'
                        : 'Once you complete payment in your UPI app, gateway verification will automatically confirm your order and redirect to your ticket.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Security Badge */}
              <div className="flex items-center justify-center gap-2 text-[11px] text-stone-500 dark:text-stone-400 pt-1">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {isTe ? '100% ఆటోమేటిక్ గేట్‌వే వెరిఫైడ్ ఆర్డర్ ప్రాసెసింగ్' : '100% Automated Gateway-Verified Order Processing'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
