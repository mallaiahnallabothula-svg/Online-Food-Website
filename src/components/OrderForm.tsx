import React, { useState, useEffect } from 'react';
import { Plus, Minus, Check, MapPin, AlertCircle, Sparkles, ShieldCheck, ArrowRight, Navigation, Gift, Eye } from 'lucide-react';
import { KaramSelection, CustomerDetails, OrderingHoursStatus } from '../types';
import { PRESET_LOCALITIES, checkKollurDeliveryEligibility, KOLLUR_CENTER } from '../data/kollurAreas';
import karivepakuKaramImg from '../assets/images/karivepaku_karam_podi_1789125808536.jpg';
import aviseKaramImg from '../assets/images/avise_ginjala_karam_1789125831933.jpg';

interface OrderFormProps {
  hoursStatus: OrderingHoursStatus;
  allowOutsideHours: boolean;
  onProceedToPayment: (orderPayload: {
    quantity: number;
    totalAmount: number;
    karamSelection: KaramSelection;
    karamQuantities: { karivepakuGrams: number; aviseGinjaluGrams: number };
    customer: CustomerDetails;
    deliveryDate: string;
    deliveryWindow: string;
  }) => void;
  onOpenPhotoGallery?: (photoId?: string) => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  hoursStatus,
  allowOutsideHours,
  onProceedToPayment,
  onOpenPhotoGallery,
}) => {
  // Quantity (minimum 5)
  const [quantity, setQuantity] = useState<number>(5);

  // Business Rule:
  // - If quantity <= 10: only ONE karam option is allowed at a time (either Karivepaku OR Avise Ginjalu).
  // - If quantity > 10: BOTH options are available and can be selected simultaneously.
  const canSelectBoth = quantity > 10;

  // Karam selections: defaults to single option (Karivepaku) for starting quantity 5
  const [karamSelection, setKaramSelection] = useState<KaramSelection>({
    karivepaku: true,
    aviseGinjalu: false,
  });

  // Whenever quantity drops to <= 10, if both were previously selected, enforce single choice
  useEffect(() => {
    if (quantity <= 10) {
      if (karamSelection.karivepaku && karamSelection.aviseGinjalu) {
        setKaramSelection({
          karivepaku: true,
          aviseGinjalu: false,
        });
      }
    }
  }, [quantity]);

  // Handlers for single vs dual karam choices
  const handleSelectKarivepaku = () => {
    if (!canSelectBoth) {
      // Single choice mode: either this or that
      setKaramSelection({
        karivepaku: true,
        aviseGinjalu: false,
      });
    } else {
      // Dual choice mode (> 10 rotis)
      setKaramSelection(prev => ({
        ...prev,
        karivepaku: !prev.karivepaku,
      }));
    }
  };

  const handleSelectAviseGinjalu = () => {
    if (!canSelectBoth) {
      // Single choice mode: either this or that
      setKaramSelection({
        karivepaku: false,
        aviseGinjalu: true,
      });
    } else {
      // Dual choice mode (> 10 rotis)
      setKaramSelection(prev => ({
        ...prev,
        aviseGinjalu: !prev.aviseGinjalu,
      }));
    }
  };

  const handleSelectBothKarams = () => {
    if (canSelectBoth) {
      setKaramSelection({
        karivepaku: true,
        aviseGinjalu: true,
      });
    }
  };

  // Customer inputs
  const [customerName, setCustomerName] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [selectedPresetArea, setSelectedPresetArea] = useState<string>('కొల్లూరు గ్రామం (కేంద్రం)');
  const [customLocationLink, setCustomLocationLink] = useState<string>('');
  const [currentDistanceKm, setCurrentDistanceKm] = useState<number>(0.5);

  // Delivery check state
  const [deliveryEligibility, setDeliveryEligibility] = useState<{
    isEligible: boolean;
    distanceKm: number;
    messageTe: string;
  }>({
    isEligible: true,
    distanceKm: 0.5,
    messageTe: 'ఉచిత డెలివరీ అందుబాటులో ఉంది (కొల్లూరు నుండి దూరం: 0.5 కి.మీ.).',
  });

  // Form errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Calculations
  const pricePerRoti = 30;
  const totalAmount = quantity * pricePerRoti;
  const setsOf5 = Math.floor(quantity / 5);
  const gramsPerSelected = setsOf5 * 20;

  const karivepakuGrams = karamSelection.karivepaku ? gramsPerSelected : 0;
  const aviseGinjaluGrams = karamSelection.aviseGinjalu ? gramsPerSelected : 0;

  // Delivery date & fixed window
  const deliveryWindow = 'సాయంత్రం 6–8 గంటలు';
  const deliveryDateStr = hoursStatus.currentDateIST || 'నేడు (Today)';

  // Handle preset locality change
  const handleLocalityChange = (areaName: string) => {
    setSelectedPresetArea(areaName);
    const matched = PRESET_LOCALITIES.find(p => p.nameTe === areaName);
    if (matched) {
      setCurrentDistanceKm(matched.distanceKm);
      const res = checkKollurDeliveryEligibility(matched.lat, matched.lng, matched.distanceKm);
      setDeliveryEligibility(res);
      if (!customLocationLink) {
        setCustomLocationLink(`https://maps.google.com/?q=${matched.lat},${matched.lng}`);
      }
    }
  };

  // Browser Geolocation support
  const handleDetectGPSLocation = () => {
    if (!navigator.geolocation) {
      alert('మీ బ్రౌజర్‌లో లొకేషన్ సదుపాయం అందుబాటులో లేదు.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const res = checkKollurDeliveryEligibility(lat, lng);
        setCurrentDistanceKm(res.distanceKm);
        setDeliveryEligibility(res);
        setCustomLocationLink(`https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`);
        setSelectedPresetArea('GPS ద్వారా గుర్తించబడిన లొకేషన్');
      },
      (err) => {
        setIsLocating(false);
        alert('లొకేషన్ పొందడం సాధ్యం కాలేదు. దయచేసి జాబితా నుండి ఎంచుకోండి.');
      },
      { timeout: 10000 }
    );
  };

  // Quantity helpers
  const incrementQuantity = () => setQuantity(q => q + 1);
  const decrementQuantity = () => setQuantity(q => (q > 5 ? q - 1 : 5));

  // Validation & Auto-scroll
  const handleQuickDemoFill = () => {
    setCustomerName('మల్లయ్య గారు');
    setMobileNumber('8499865803');
    setSelectedPresetArea('కొల్లూరు గ్రామం (కేంద్రం)');
    setCurrentDistanceKm(0.5);
    setDeliveryEligibility({
      isEligible: true,
      distanceKm: 0.5,
      messageTe: 'ఉచిత డెలివరీ అందుబాటులో ఉంది (కొల్లూరు నుండి దూరం: 0.5 కి.మీ.).',
    });
    setAddress('ఇంటి నెం. 2-45, రామాలయం వీధి, కొల్లూరు గ్రామం');
    setLandmark('గ్రామ పంచాయతీ ఎదురుగా');
    setCustomLocationLink('https://maps.google.com/?q=17.4782,78.2323');
    setErrors({});
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    let firstErrorElementId = '';

    if (!customerName.trim()) {
      errs.customerName = 'దయచేసి మీ పూర్తి పేరు నమోదు చేయండి.';
      if (!firstErrorElementId) firstErrorElementId = 'customer-name-input';
    }

    const cleanMobile = mobileNumber.replace(/\D/g, '');
    if (!cleanMobile) {
      errs.mobileNumber = 'దయచేసి మొబైల్ నంబర్ నమోదు చేయండి.';
      if (!firstErrorElementId) firstErrorElementId = 'customer-mobile-input';
    } else if (cleanMobile.length !== 10) {
      errs.mobileNumber = 'సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి (ఉదా: 8499865803).';
      if (!firstErrorElementId) firstErrorElementId = 'customer-mobile-input';
    }

    if (!address.trim()) {
      errs.address = 'దయచేసి పూర్తి డెలివరీ చిరునామా (ఇంటి నం, కాలనీ) నమోదు చేయండి.';
      if (!firstErrorElementId) firstErrorElementId = 'customer-address-input';
    }

    if (!deliveryEligibility.isEligible) {
      errs.delivery = `కొల్లూరు గ్రామం నుండి 5 కి.మీ. పరిధి దాటింది (${deliveryEligibility.distanceKm} కి.మీ.). ఉచిత డెలివరీ కేవలం 5 కి.మీ. లోపలే సాధ్యం.`;
      if (!firstErrorElementId) firstErrorElementId = 'locality-select';
    }

    if (!karamSelection.karivepaku && !karamSelection.aviseGinjalu) {
      errs.karam = 'దయచేసి కనీసం ఒక ఉచిత కారాన్ని ఎంచుకోండి (కరివేపాకు లేదా అవిసె గింజల కారం).';
      if (!firstErrorElementId) firstErrorElementId = 'karam-card-karivepaku';
    }

    setErrors(errs);

    if (firstErrorElementId) {
      setTimeout(() => {
        const el = document.getElementById(firstErrorElementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 50);
    }

    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    onProceedToPayment({
      quantity,
      totalAmount,
      karamSelection,
      karamQuantities: {
        karivepakuGrams,
        aviseGinjaluGrams,
      },
      customer: {
        name: customerName.trim(),
        mobile: mobileNumber.replace(/\D/g, ''),
        address: address.trim(),
        landmark: landmark.trim(),
        locationLink: customLocationLink.trim() || `https://maps.google.com/?q=${KOLLUR_CENTER.lat},${KOLLUR_CENTER.lng}`,
        distanceKm: deliveryEligibility.distanceKm,
      },
      deliveryDate: deliveryDateStr,
      deliveryWindow,
    });
  };

  const isOrderBlockedByHours = !hoursStatus.isOpen && !allowOutsideHours;

  return (
    <div id="order-section" className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: Product & Quantity */}
        <div className="bg-white dark:bg-[#211E1A] rounded-2xl p-6 sm:p-8 shadow-sm border border-amber-900/10 dark:border-stone-800">
          <div className="flex items-center gap-3 pb-5 border-b border-stone-100 dark:border-stone-800">
            <span className="w-8 h-8 rounded-full bg-[#78350F] text-amber-100 font-bold flex items-center justify-center text-sm">
              1
            </span>
            <div>
              <h2 className="text-xl font-bold text-[#451A03] dark:text-amber-100 font-telugu">
                జొన్న రొట్టెల సంఖ్య ఎంచుకోండి
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-telugu">
                తాజా మధ్యస్థ పరిమాణపు జొన్న రొట్టె | ఒక్కొక్కటి ₹30 (కనీసం 5 రొట్టెలు)
              </p>
            </div>
          </div>

          <div className="pt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Quantity Selector Control */}
            <div className="md:col-span-7 flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="flex items-center gap-3 bg-[#FBF7EE] dark:bg-stone-900 p-2 rounded-2xl border border-amber-900/15 dark:border-stone-700">
                <button
                  type="button"
                  onClick={decrementQuantity}
                  disabled={quantity <= 5}
                  id="qty-decrement-btn"
                  className="w-12 h-12 rounded-xl bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-stone-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all"
                  aria-label="తగ్గించండి"
                >
                  <Minus className="w-5 h-5" />
                </button>

                <div className="w-20 text-center">
                  <span className="text-3xl font-extrabold text-[#78350F] dark:text-amber-400 font-mono">
                    {quantity}
                  </span>
                  <span className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 font-telugu">
                    రొట్టెలు
                  </span>
                </div>

                <button
                  type="button"
                  onClick={incrementQuantity}
                  id="qty-increment-btn"
                  className="w-12 h-12 rounded-xl bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-stone-700 active:scale-95 shadow-xs transition-all"
                  aria-label="పెంచండి"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {[5, 10, 15, 20].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuantity(num)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all ${
                      quantity === num
                        ? 'bg-[#78350F] text-white shadow-xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100 dark:hover:bg-stone-700'
                    }`}
                  >
                    {num} రొట్టెలు
                  </button>
                ))}
              </div>
            </div>

            {/* Live Subtotal Card */}
            <div className="md:col-span-5 bg-amber-50/70 dark:bg-stone-900/60 p-4 rounded-xl border border-amber-200 dark:border-stone-800 flex flex-col justify-center text-right font-telugu">
              <span className="text-xs text-stone-600 dark:text-stone-400">రొట్టెల ఉపమొత్తం (Subtotal):</span>
              <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
                <span className="text-xs font-mono text-stone-500">{quantity} × ₹30 =</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-[#78350F] dark:text-amber-400 font-mono">
                  ₹{totalAmount}
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-1">
                ✓ కొల్లూరు పరిధిలో ఉచిత డెలివరీ
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Free Karam Selection */}
        <div className="bg-white dark:bg-[#211E1A] rounded-2xl p-6 sm:p-8 shadow-sm border border-amber-900/10 dark:border-stone-800">
          <div className="flex items-center gap-3 pb-5 border-b border-stone-100 dark:border-stone-800">
            <span className="w-8 h-8 rounded-full bg-emerald-700 text-emerald-50 font-bold flex items-center justify-center text-sm">
              2
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-[#451A03] dark:text-amber-100 font-telugu">
                  ఉచిత కారాలు (Free Karam Selection)
                </h2>
                {canSelectBoth ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-telugu">
                    🎉 రెండు కారాలూ ఎంచుకోవచ్చు! (10+ రొట్టెలు)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-telugu">
                    ఏదైనా ఒకటి మాత్రమే (10 రొట్టెల వరకు)
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-telugu mt-0.5">
                {canSelectBoth
                  ? 'మీరు 10 కంటే ఎక్కువ రొట్టెలు ఆర్డర్ చేస్తున్నారు! కరివేపాకు మరియు అవిసె గింజల కారం రెండింటినీ ఉచితంగా ఎంచుకోవచ్చు.'
                  : '10 రొట్టెల వరకు ఒక కారం మాత్రమే (కరివేపాకు లేదా అవిసె గింజల కారం) ఉచితంగా ఎంచుకోవచ్చు.'}
              </p>
            </div>
          </div>

          {/* Karam Selection Rule Box */}
          {canSelectBoth ? (
            <div className="my-5 p-4 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 font-telugu space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold text-sm">
                  <Gift className="w-5 h-5 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
                  <span>🎉 10 రొట్టెల కంటే ఎక్కువ ({quantity}) ఆర్డర్ చేస్తున్నారు - రెండు కారాలూ ఉచితం!</span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectBothKarams}
                  id="select-both-karams-btn"
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors cursor-pointer"
                >
                  రెండు కారాలనూ ఎంచుకోండి (Select Both)
                </button>
              </div>
              <div className="text-xs text-emerald-800 dark:text-emerald-300">
                మీరు ఎంచుకున్న ప్రతి కారం: <strong className="font-mono font-bold">{gramsPerSelected} గ్రాములు</strong> ఉచితం. (రెండూ కలిపి మొత్తం <strong className="font-mono">{gramsPerSelected * 2} గ్రాములు</strong>).
              </div>
            </div>
          ) : (
            <div className="my-5 p-4 rounded-xl bg-amber-50/90 dark:bg-stone-900/90 border border-amber-300 dark:border-stone-700 font-telugu space-y-1.5">
              <div className="flex items-center gap-2 text-[#78350F] dark:text-amber-300 font-bold text-xs sm:text-sm">
                <Gift className="w-4 h-4 flex-shrink-0" />
                <span>ఒక కారం మాత్రమే ఉచితం (కరివేపాకు లేదా అవిసె గింజల కారం)</span>
              </div>
              <p className="text-xs text-stone-700 dark:text-stone-300">
                మీరు <strong>{quantity}</strong> రొట్టెలు ఎంచుకున్నారు (10 లేదా అంతకంటే తక్కువ). కావున ఏదైనా ఒక కారాన్ని మాత్రమే ఎంచుకోవచ్చు (<strong className="font-mono">{gramsPerSelected} గ్రాములు</strong> ఉచితం).
                <span className="block text-[#78350F] dark:text-amber-400 font-bold mt-1">
                  💡 సలహా: 10 కంటే ఎక్కువ (11+) రొట్టెలు ఆర్డర్ చేస్తే రెండు కారాలనూ ఉచితంగా పొందవచ్చు!
                </span>
              </p>
            </div>
          )}

          {/* Karam Selection Cards with Authentic Photos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-telugu">
            {/* Option 1: Karivepaku Karam */}
            <div
              onClick={handleSelectKarivepaku}
              id="karam-card-karivepaku"
              className={`relative flex flex-col sm:flex-row items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                karamSelection.karivepaku
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/35 border-emerald-600 dark:border-emerald-500 shadow-sm'
                  : 'bg-stone-50/70 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center sm:items-start gap-3">
                {/* Radio for <= 10, Checkbox for > 10 */}
                <div className="pt-0.5">
                  {!canSelectBoth ? (
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      karamSelection.karivepaku
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-stone-400 bg-white dark:bg-stone-800'
                    }`}>
                      {karamSelection.karivepaku && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  ) : (
                    <input
                      type="checkbox"
                      id="checkbox-karivepaku"
                      checked={karamSelection.karivepaku}
                      onChange={handleSelectKarivepaku}
                      className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  )}
                </div>

                {/* Original Photo Thumbnail */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 border border-emerald-900/20 shadow-xs group/img">
                  <img
                    src={karivepakuKaramImg}
                    alt="స్వచ్ఛమైన కరివేపాకు కారం"
                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] sm:text-[9px] text-emerald-200 font-bold text-center py-0.5 font-telugu">
                    అసలైన ఫోటో
                  </div>
                </div>
              </div>

              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-stone-900 dark:text-stone-100">
                    కరివేపాకు కారం
                  </span>
                  {!canSelectBoth && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-stone-800 text-amber-900 dark:text-amber-200">
                      ఆప్షన్ A
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-tight">
                  స్వచ్ఛమైన తాజా కరివేపాకు, ఎండుమిర్చి, వెల్లుల్లితో రోట్లో దంచినట్లు సిద్ధం చేసిన కారం
                </p>
                <div className="pt-1.5 flex items-center justify-between flex-wrap gap-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    karamSelection.karivepaku
                      ? 'bg-emerald-600 text-white font-mono'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-500'
                  }`}>
                    {karamSelection.karivepaku ? `${karivepakuGrams} గ్రా. ఉచితం` : 'ఎంపిక కాలేదు'}
                  </span>

                  {onOpenPhotoGallery && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPhotoGallery('karivepaku-karam');
                      }}
                      className="text-[11px] text-[#78350F] dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>ఫోటో చూడండి</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Option 2: Avise Ginjala Karam */}
            <div
              onClick={handleSelectAviseGinjalu}
              id="karam-card-avise"
              className={`relative flex flex-col sm:flex-row items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                karamSelection.aviseGinjalu
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/35 border-emerald-600 dark:border-emerald-500 shadow-sm'
                  : 'bg-stone-50/70 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center sm:items-start gap-3">
                {/* Radio for <= 10, Checkbox for > 10 */}
                <div className="pt-0.5">
                  {!canSelectBoth ? (
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      karamSelection.aviseGinjalu
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-stone-400 bg-white dark:bg-stone-800'
                    }`}>
                      {karamSelection.aviseGinjalu && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  ) : (
                    <input
                      type="checkbox"
                      id="checkbox-avise"
                      checked={karamSelection.aviseGinjalu}
                      onChange={handleSelectAviseGinjalu}
                      className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  )}
                </div>

                {/* Original Photo Thumbnail */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 border border-amber-900/20 shadow-xs group/img">
                  <img
                    src={aviseKaramImg}
                    alt="అవిసె గింజల కారం"
                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] sm:text-[9px] text-amber-200 font-bold text-center py-0.5 font-telugu">
                    అసలైన ఫోటో
                  </div>
                </div>
              </div>

              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-stone-900 dark:text-stone-100">
                    అవిసె గింజల కారం
                  </span>
                  {!canSelectBoth && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-stone-800 text-amber-900 dark:text-amber-200">
                      ఆప్షన్ B
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-tight">
                  వేయించిన నాణ్యమైన అవిసె గింజలు (Flaxseeds), ఎండుమిర్చిల సంప్రదాయ ఘుమఘుమలాడే కారం
                </p>
                <div className="pt-1.5 flex items-center justify-between flex-wrap gap-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    karamSelection.aviseGinjalu
                      ? 'bg-emerald-600 text-white font-mono'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-500'
                  }`}>
                    {karamSelection.aviseGinjalu ? `${aviseGinjaluGrams} గ్రా. ఉచితం` : 'ఎంపిక కాలేదు'}
                  </span>

                  {onOpenPhotoGallery && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPhotoGallery('avise-ginjala-karam');
                      }}
                      className="text-[11px] text-[#78350F] dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>ఫోటో చూడండి</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Customer & Delivery Details with 5km Kollur Service Area Check */}
        <div className="bg-white dark:bg-[#211E1A] rounded-2xl p-6 sm:p-8 shadow-sm border border-amber-900/10 dark:border-stone-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#8C4A26] text-amber-100 font-bold flex items-center justify-center text-sm">
                3
              </span>
              <div>
                <h2 className="text-xl font-bold text-[#451A03] dark:text-amber-100 font-telugu">
                  కస్టమర్ వివరాలు & డెలివరీ చిరునామా
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-telugu">
                  కొల్లూరు గ్రామం నుండి 5 కి.మీ. పరిధిలో ఉచిత హోమ్ డెలివరీ
                </p>
              </div>
            </div>

            {/* Quick Demo Fill button */}
            <button
              type="button"
              onClick={handleQuickDemoFill}
              className="px-3.5 py-1.5 rounded-xl bg-amber-100 dark:bg-stone-800 hover:bg-amber-200 dark:hover:bg-stone-700 text-[#78350F] dark:text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all self-end sm:self-auto border border-amber-300 dark:border-stone-700 font-telugu"
              title="టెస్ట్ చేయడానికి ఒకే క్లిక్‌తో నమూనా వివరాలను నింపండి"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>నమూనా వివరాలు నింపండి</span>
            </button>
          </div>

          <div className="pt-6 space-y-5 font-telugu">
            
            {/* Customer Name */}
            <div>
              <label htmlFor="customer-name-input" className="block text-sm font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                కస్టమర్ పూర్తి పేరు <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="customer-name-input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="ఉదాహరణ: సురేష్ కుమార్"
                className={`w-full px-4 py-3 rounded-xl border bg-[#FDFBF7] dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#78350F] transition-all ${
                  errors.customerName ? 'border-red-500 ring-1 ring-red-500' : 'border-stone-300 dark:border-stone-700'
                }`}
              />
              {errors.customerName && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errors.customerName}</span>
                </p>
              )}
            </div>

            {/* Customer Mobile with Fixed +91 Prefix */}
            <div>
              <label htmlFor="customer-mobile-input" className="block text-sm font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                మొబైల్ సంఖ్య (10 అంకెలు) <span className="text-red-600">*</span>
              </label>
              <div className="flex rounded-xl overflow-hidden shadow-xs border border-stone-300 dark:border-stone-700 focus-within:ring-2 focus-within:ring-[#78350F]">
                <div className="bg-stone-100 dark:bg-stone-800 px-4 py-3 flex items-center border-r border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-mono font-bold text-sm">
                  +91
                </div>
                <input
                  type="tel"
                  id="customer-mobile-input"
                  maxLength={10}
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="8499865803"
                  className="w-full px-4 py-3 bg-[#FDFBF7] dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none font-mono text-sm sm:text-base"
                />
              </div>
              {errors.mobileNumber && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errors.mobileNumber}</span>
                </p>
              )}
            </div>

            {/* Delivery Locality Preset & 5km Radius Check */}
            <div>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                <label htmlFor="locality-select" className="text-sm font-bold text-stone-800 dark:text-stone-200">
                  డెలివరీ ప్రాంతం (కొల్లూరు 5 కి.మీ. పరిధి) <span className="text-red-600">*</span>
                </label>

                {/* GPS current location button */}
                <button
                  type="button"
                  onClick={handleDetectGPSLocation}
                  disabled={isLocating}
                  id="detect-gps-btn"
                  className="inline-flex items-center gap-1 text-xs text-[#78350F] dark:text-amber-400 font-semibold hover:underline"
                >
                  <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? 'గుర్తిస్తోంది...' : 'నా ప్రస్తుత GPS లొకేషన్ గుర్తించండి'}</span>
                </button>
              </div>

              <select
                id="locality-select"
                value={selectedPresetArea}
                onChange={(e) => handleLocalityChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FDFBF7] dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#78350F] text-sm"
              >
                {PRESET_LOCALITIES.map((loc) => (
                  <option key={loc.nameTe} value={loc.nameTe}>
                    {loc.nameTe} ({loc.distanceKm} కి.మీ. {loc.isEligible ? '— ఉచిత డెలివరీ' : '— 5 కి.మీ. దాటింది'})
                  </option>
                ))}
              </select>

              {/* Real-time 5km Service Area Status */}
              <div className={`mt-2 p-3 rounded-xl text-xs flex items-start gap-2 ${
                deliveryEligibility.isEligible
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-800'
              }`}>
                {deliveryEligibility.isEligible ? (
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <span>{deliveryEligibility.messageTe}</span>
              </div>
            </div>

            {/* Complete Address */}
            <div>
              <label htmlFor="customer-address-input" className="block text-sm font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                పూర్తి చిరునామా (ఫ్లాట్ / ఇంటి నంబర్, వీధి, కాలనీ) <span className="text-red-600">*</span>
              </label>
              <textarea
                id="customer-address-input"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="ఉదాహరణ: ఫ్లాట్ 202, శ్రీ సాయి రెసిడెన్సీ, మెయిన్ రోడ్, కొల్లూరు"
                className={`w-full px-4 py-3 rounded-xl border bg-[#FDFBF7] dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#78350F] text-sm ${
                  errors.address ? 'border-red-500 ring-1 ring-red-500' : 'border-stone-300 dark:border-stone-700'
                }`}
              />
              {errors.address && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errors.address}</span>
                </p>
              )}
            </div>

            {/* Landmark & Optional Maps Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="customer-landmark-input" className="block text-sm font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                  ల్యాండ్మార్క్ (గుడి, పాఠశాల లేదా అపార్ట్‌మెంట్ పేరు)
                </label>
                <input
                  type="text"
                  id="customer-landmark-input"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="ఉదా: గ్రామ పంచాయతీ దగ్గర"
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FDFBF7] dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#78350F] text-sm"
                />
              </div>

              <div>
                <label htmlFor="customer-location-link" className="block text-sm font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                  లొకేషన్ లింక్ (ఐచ్ఛికం - Google Maps Link)
                </label>
                <input
                  type="text"
                  id="customer-location-link"
                  value={customLocationLink}
                  onChange={(e) => setCustomLocationLink(e.target.value)}
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FDFBF7] dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#78350F] text-sm"
                />
              </div>
            </div>

            {/* Delivery Date & Window (Fixed: 6:00 PM - 8:00 PM) */}
            <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-stone-900/60 border border-amber-900/10 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-semibold text-stone-600 dark:text-stone-400">డెలివరీ తేదీ:</span>
                <span className="font-bold text-base text-stone-900 dark:text-stone-100 font-mono">
                  {deliveryDateStr}
                </span>
              </div>

              <div>
                <span className="block text-xs font-semibold text-stone-600 dark:text-stone-400">డెలివరీ సమయం (Delivery Window):</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-base text-[#78350F] dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>సాయంత్రం 6–8 గంటలు</span>
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Global Error Banner */}
        {Object.keys(errors).length > 0 && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm font-telugu flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">దయచేసి క్రింది వివరాలను సరిచూసుకోండి:</p>
              <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
                {Object.values(errors).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* SECTION 4: Order Summary & Proceed to Payment */}
        <div className="bg-[#FAF4EA] dark:bg-[#28241F] rounded-2xl p-6 sm:p-8 border-2 border-amber-300 dark:border-stone-700 shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-amber-900/15 dark:border-stone-700 font-telugu">
            <div>
              <h3 className="text-lg font-bold text-[#451A03] dark:text-amber-100">
                ఆర్డర్ సమీక్ష (Order Summary)
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                {quantity} జొన్న రొట్టెలు + ఉచిత కారాలు
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-stone-600 dark:text-stone-400 block">మొత్తం చెల్లించవలసినది:</span>
              <span className="text-3xl font-extrabold text-[#78350F] dark:text-amber-400 font-mono">
                ₹{totalAmount}
              </span>
            </div>
          </div>

          {/* Karam Summary Breakdown */}
          <div className="py-3 text-xs sm:text-sm font-telugu text-stone-700 dark:text-stone-300 space-y-1">
            <div className="flex justify-between">
              <span>జొన్న రొట్టెలు ({quantity} × ₹30):</span>
              <span className="font-mono font-bold">₹{totalAmount}</span>
            </div>
            <div className="flex justify-between text-emerald-800 dark:text-emerald-400 font-semibold">
              <span>కరివేపాకు కారం:</span>
              <span>{karamSelection.karivepaku ? `${karivepakuGrams} గ్రా. (ఉచితం ₹0)` : 'ఎంపిక చేయలేదు'}</span>
            </div>
            <div className="flex justify-between text-emerald-800 dark:text-emerald-400 font-semibold">
              <span>అవిసె గింజల కారం:</span>
              <span>{karamSelection.aviseGinjalu ? `${aviseGinjaluGrams} గ్రా. (ఉచితం ₹0)` : 'ఎంపిక చేయలేదు'}</span>
            </div>
            <div className="flex justify-between text-stone-600 dark:text-stone-400">
              <span>హోమ్ డెలివరీ (కొల్లూరు 5 కి.మీ. పరిధి):</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 font-telugu">ఉచితం (₹0)</span>
            </div>
          </div>

          {/* Submit / Proceed Button */}
          <div className="pt-4 flex flex-col gap-3">
            {/* Missing Info Prompt */}
            {(!customerName.trim() || mobileNumber.replace(/\D/g, '').length !== 10 || !address.trim()) && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-stone-900 border border-amber-300 dark:border-stone-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 font-telugu text-xs">
                <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>ఆర్డర్ చేయడానికి పైన పేరు, మొబైల్ నంబర్ మరియు చిరునామా నమోదు చేయండి.</span>
                </div>
                <button
                  type="button"
                  onClick={handleQuickDemoFill}
                  className="px-3 py-1.5 rounded-lg bg-[#78350F] hover:bg-[#8C4A26] text-white font-bold flex items-center gap-1 text-xs self-end sm:self-auto shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>నమూనా వివరాలు నింపండి</span>
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isOrderBlockedByHours || !deliveryEligibility.isEligible}
              id="proceed-to-payment-btn"
              className="w-full py-4 px-6 rounded-xl font-bold text-base sm:text-lg text-amber-50 bg-[#78350F] hover:bg-[#8C4A26] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-950/20 flex items-center justify-center gap-3 transition-all font-telugu"
            >
              <span>UPI చెల్లింపుకు కొనసాగించండి (₹{totalAmount})</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {isOrderBlockedByHours && (
              <p className="text-center text-xs text-amber-800 dark:text-amber-300 font-telugu font-semibold">
                ⚠️ ఆర్డర్ల సమయం (11:00 AM – 4:00 PM IST) ముగిసినందున చెకౌట్ డిసేబుల్ చేయబడింది.
              </p>
            )}

            {!deliveryEligibility.isEligible && (
              <p className="text-center text-xs text-red-600 dark:text-red-400 font-telugu font-semibold">
                ⚠️ దయచేసి కొల్లూరు గ్రామం నుండి 5 కి.మీ. పరిధిలోని చిరునామాను ఎంచుకోండి.
              </p>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-stone-500 dark:text-stone-400 font-telugu pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ఆన్‌లైన్ UPI ద్వారా మాత్రమే చెల్లింపు. క్యాష్ ఆన్ డెలివరీ లేదు. సర్వర్ ద్వారా ధృవీకరించబడుతుంది.</span>
            </div>
          </div>

        </div>

      </form>
    </div>
  );
};
