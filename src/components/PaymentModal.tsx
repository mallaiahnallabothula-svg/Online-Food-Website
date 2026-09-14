import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, CheckCircle2, AlertTriangle, ShieldCheck, Copy, Check, Smartphone, RefreshCw, Lock } from 'lucide-react';
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
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Payment Intent from server
  const [intentData, setIntentData] = useState<{
    intentId: string;
    provider: string;
    amountRupees: number;
    subtotalRupees: number;
    deliveryChargeRupees: number;
    distanceKm: number;
    businessUpiId: string;
    businessPhone: string;
    mockDetails?: {
      isMock: boolean;
      verificationToken: string;
      instructions: string;
    };
  } | null>(null);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);
  const [simulatedUtr, setSimulatedUtr] = useState<string>('');

  // 1. Create Server-Authoritative Payment Intent
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingIntent(true);
    setErrorMessage('');
    setIntentData(null);

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
          setSimulatedUtr(`UPI${Math.floor(1000000000 + Math.random() * 9000000000)}`);

          // Generate QR code for clean UPI intent
          const upiUri = `upi://pay?pa=${data.businessUpiId}&pn=${encodeURIComponent('Mana Enti Vanta')}&am=${data.amountRupees}&cu=INR`;
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
    };
  }, [isOpen, orderData]);

  if (!isOpen) return null;

  const handleCopyUpi = () => {
    if (intentData?.businessUpiId) {
      navigator.clipboard.writeText(intentData.businessUpiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleCopyPhone = () => {
    if (intentData?.businessPhone) {
      navigator.clipboard.writeText(intentData.businessPhone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  // 2. Authoritative Server Verification
  const handleVerifyAndCompletePayment = async () => {
    if (!intentData) return;

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: intentData.intentId,
          providerPaymentId: simulatedUtr || `PAY-${Date.now()}`,
          mockVerificationToken: intentData.mockDetails?.verificationToken,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.order) {
        throw new Error(data.error?.message || 'Payment verification failed on server.');
      }

      // Pass real confirmed order with customerAccessToken
      onPaymentSuccess({
        ...data.order,
        customerAccessToken: data.customerAccessToken,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#211E1A] w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden relative font-telugu my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#78350F] to-[#92400E] p-5 sm:p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandEmblem size="sm" />
            <div>
              <h3 className="font-bold text-lg sm:text-xl leading-tight">
                {isTe ? 'సురక్షిత ఆన్‌లైన్ చెల్లింపు' : 'Secure Online Payment'}
              </h3>
              <p className="text-xs text-amber-200 mt-0.5">
                {isTe ? 'ఆన్‌లైన్ పేమెంట్ మాత్రమే (No COD)' : 'Online Payment Only (No COD)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
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
                className="px-5 py-2.5 bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-bold rounded-xl"
              >
                {isTe ? 'సరిచేయడానికి వెనుకకు వెళ్ళు' : 'Go Back & Edit'}
              </button>
            </div>
          ) : intentData && (
            <>
              {/* Order Pricing Breakdown (Authoritative from Server) */}
              <div className="bg-stone-50 dark:bg-[#1A1816] p-4 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2">
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                  <span>
                    {isTe ? 'రొట్టెలు & చపాతీల మొత్తం' : 'Items Subtotal'} ({orderData.jowarQuantity > 0 ? `${orderData.jowarQuantity} జొన్న` : ''}{orderData.jowarQuantity > 0 && orderData.chapathiQuantity > 0 ? ' + ' : ''}{orderData.chapathiQuantity > 0 ? `${orderData.chapathiQuantity} చపాతీ` : ''})
                  </span>
                  <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                    ₹{intentData.subtotalRupees}
                  </span>
                </div>

                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
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
                  <span className="text-sm">
                    {isTe ? 'చెల్లించాల్సిన మొత్తం' : 'Total Payable'}
                  </span>
                  <span className="text-xl text-[#78350F] dark:text-amber-400 font-mono">
                    ₹{intentData.amountRupees}
                  </span>
                </div>
              </div>

              {/* UPI QR & Payment Action */}
              <div className="text-center space-y-3">
                {qrCodeDataUrl ? (
                  <div className="inline-block p-2 bg-white rounded-2xl border border-stone-200 shadow-sm">
                    <img
                      src={qrCodeDataUrl}
                      alt="UPI QR Code"
                      className="w-44 h-44 mx-auto rounded-xl"
                    />
                  </div>
                ) : null}

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                    {isTe ? 'PhonePe, Google Pay, Paytm ద్వారా స్కాన్ చేయండి' : 'Scan using PhonePe, Google Pay, or Paytm'}
                  </p>
                  
                  {/* UPI ID copy */}
                  <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-full text-xs">
                    <span className="font-mono font-bold text-amber-900 dark:text-amber-200">
                      {intentData.businessUpiId}
                    </span>
                    <button
                      onClick={handleCopyUpi}
                      className="text-amber-700 dark:text-amber-400 hover:text-amber-900 p-0.5"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Development Sandbox Simulation Notice */}
              {intentData.mockDetails?.isMock && (
                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>{isTe ? 'డెవలప్‌మెంట్ వెరిఫైడ్ శాండ్‌బాక్స్ మోడ్' : 'Development Verified Sandbox Mode'}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {isTe
                      ? 'పరీక్షా పద్ధతిలో నిజమైన బ్యాంక్ చెల్లింపు అవసరం లేదు. "చెల్లింపు పూర్తయింది - ఆర్డర్ నిర్ధారించు" బటన్‌ను నొక్కడం ద్వారా సర్వర్ ఇంటెంట్ అధికారికంగా వెరిఫై చేయబడి ఆర్డర్ ప్లేస్ అవుతుంది.'
                      : 'Simulated payment sandbox. Clicking verify will authoritatively confirm payment with the server.'}
                  </p>
                </div>
              )}

              {/* Verification Error */}
              {errorMessage && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl p-3 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Complete & Verify Button */}
              <button
                onClick={handleVerifyAndCompletePayment}
                disabled={isVerifying}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#78350F] to-[#92400E] text-white rounded-xl font-bold shadow-md hover:from-[#602a0c] hover:to-[#78350f] focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm sm:text-base"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>{isTe ? 'చెల్లింపును ధృవీకరిస్తోంది...' : 'Verifying with Provider...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>
                      {isTe
                        ? `చెల్లింపు పూర్తయింది — ఆర్డర్ నిర్ధారించు (₹${intentData.amountRupees})`
                        : `Payment Completed — Confirm Order (₹${intentData.amountRupees})`}
                    </span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-stone-400">
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {isTe ? '100% సురక్షిత సర్వర్ చెల్లింపు ప్రాసెసింగ్' : '100% Secure Server-Authoritative Processing'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
