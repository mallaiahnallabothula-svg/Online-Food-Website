import React, { useState, useEffect } from 'react';
import { Plus, Minus, Check, MapPin, AlertCircle, Sparkles, ShieldCheck, ArrowRight, Navigation, Gift, CheckCircle2, ExternalLink, Leaf } from 'lucide-react';
import { KaramSelection, CustomerDetails, OrderingHoursStatus } from '../types';
import { PRESET_LOCALITIES, checkKollurDeliveryEligibility, KOLLUR_CENTER } from '../data/kollurAreas';
import { useLanguage } from '../context/LanguageContext';

interface OrderFormProps {
  hoursStatus: OrderingHoursStatus;
  allowOutsideHours: boolean;
  onProceedToPayment: (orderPayload: {
    quantity: number;
    jowarQuantity: number;
    chapathiQuantity: number;
    totalAmount: number;
    karamSelection: KaramSelection;
    karamQuantities: { karivepakuGrams: number; aviseGinjaluGrams: number };
    customer: CustomerDetails;
    deliveryDate: string;
    deliveryWindow: string;
  }) => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  hoursStatus,
  allowOutsideHours,
  onProceedToPayment,
}) => {
  const { t, language } = useLanguage();

  // Item Quantities
  // Jowar Roti: ₹30 each, minimum 5 if chosen
  const [jowarQuantity, setJowarQuantity] = useState<number>(5);
  // Fresh Wheat Chapathi: ₹10 each, minimum 5 if chosen
  const [chapathiQuantity, setChapathiQuantity] = useState<number>(0);

  const totalQuantity = jowarQuantity + chapathiQuantity;
  const quantity = totalQuantity; // Backwards-compatible alias

  // Business Rule:
  // - If total quantity <= 10: only ONE karam option is allowed at a time (either Karivepaku OR Avise Ginjalu).
  // - If total quantity > 10: BOTH options are available and can be selected simultaneously.
  const canSelectBoth = totalQuantity > 10;

  // Karam selections: defaults to single option (Karivepaku) for starting quantity 5
  const [karamSelection, setKaramSelection] = useState<KaramSelection>({
    karivepaku: true,
    aviseGinjalu: false,
  });

  // Whenever quantity drops to <= 10, if both were previously selected, enforce single choice
  useEffect(() => {
    if (totalQuantity <= 10) {
      if (karamSelection.karivepaku && karamSelection.aviseGinjalu) {
        setKaramSelection({
          karivepaku: true,
          aviseGinjalu: false,
        });
      }
    }
  }, [totalQuantity]);

  // Quantity Stepper Helpers
  const incrementJowar = () => {
    if (jowarQuantity === 0) {
      setJowarQuantity(5);
    } else {
      setJowarQuantity(prev => prev + 1);
    }
  };

  const decrementJowar = () => {
    if (jowarQuantity > 5) {
      setJowarQuantity(prev => prev - 1);
    } else if (jowarQuantity === 5) {
      if (chapathiQuantity >= 5) {
        setJowarQuantity(0);
      }
    }
  };

  const incrementChapathi = () => {
    if (chapathiQuantity === 0) {
      setChapathiQuantity(5);
    } else {
      setChapathiQuantity(prev => prev + 1);
    }
  };

  const decrementChapathi = () => {
    if (chapathiQuantity > 5) {
      setChapathiQuantity(prev => prev - 1);
    } else if (chapathiQuantity === 5) {
      setChapathiQuantity(0);
    }
  };

  // Handlers for single vs dual karam choices
  const handleSelectKarivepaku = () => {
    if (!canSelectBoth) {
      // Single choice mode
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
      // Single choice mode
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
  const [selectedPresetArea, setSelectedPresetArea] = useState<string>(PRESET_LOCALITIES[0].nameTe);
  const [customLocationLink, setCustomLocationLink] = useState<string>('');
  const [currentDistanceKm, setCurrentDistanceKm] = useState<number>(0.5);

  // Delivery check state
  const [deliveryEligibility, setDeliveryEligibility] = useState<{
    isEligible: boolean;
    distanceKm: number;
    isFreeDelivery?: boolean;
    extraKm?: number;
    deliveryCharge?: number;
    messageTe: string;
    messageEn: string;
  }>({
    isEligible: true,
    distanceKm: 0.5,
    isFreeDelivery: true,
    extraKm: 0,
    deliveryCharge: 0,
    messageTe: 'ఉచిత డెలివరీ అందుబాటులో ఉంది (కొల్లూరు నుండి దూరం: 0.5 కి.మీ. — 5 కి.మీ. లోపల ఉచితం).',
    messageEn: 'Free delivery available (Distance from Kolluru center: 0.5 km — free within 5 km).',
  });

  // Form errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationFeedback, setLocationFeedback] = useState<string>('');
  const [showManualLocationInput, setShowManualLocationInput] = useState<boolean>(false);

  // Calculations
  const pricePerRoti = 30;
  const pricePerChapathi = 10;
  const jowarSubtotal = jowarQuantity * pricePerRoti;
  const chapathiSubtotal = chapathiQuantity * pricePerChapathi;
  const itemsSubtotal = jowarSubtotal + chapathiSubtotal;

  // Delivery charge calculation: Free within 5 km, ₹9/km for distance above 5 km
  const currentDist = typeof deliveryEligibility.distanceKm === 'number' 
    ? deliveryEligibility.distanceKm 
    : (currentDistanceKm || 0.5);
  const extraKm = currentDist > 5.0 ? Math.round((currentDist - 5.0) * 10) / 10 : 0;
  const deliveryCharge = currentDist > 5.0 ? Math.max(9, Math.round(extraKm * 9)) : 0;
  const isFreeDelivery = currentDist <= 5.0;
  const totalAmount = itemsSubtotal + deliveryCharge;

  const setsOf5 = Math.max(1, Math.floor(totalQuantity / 5));
  const gramsPerSelected = setsOf5 * 20;

  const karivepakuGrams = karamSelection.karivepaku ? gramsPerSelected : 0;
  const aviseGinjaluGrams = karamSelection.aviseGinjalu ? gramsPerSelected : 0;

  // Delivery date & fixed window
  const deliveryWindow = language === 'en' ? 'Evening 6:00 – 8:00 PM' : 'సాయంత్రం 6:00 – 8:00 గంటలు';
  const deliveryDateStr = language === 'en'
    ? (hoursStatus.currentDateISTEn || hoursStatus.currentDateIST || 'Today')
    : (hoursStatus.currentDateIST || 'నేడు');

  // Handle preset locality change
  const handleLocalityChange = (areaIdentifier: string) => {
    setSelectedPresetArea(areaIdentifier);
    const matched = PRESET_LOCALITIES.find(p => p.nameTe === areaIdentifier || p.nameEn === areaIdentifier);
    if (matched) {
      setCurrentDistanceKm(matched.distanceKm);
      const res = checkKollurDeliveryEligibility(matched.lat, matched.lng, matched.distanceKm);
      setDeliveryEligibility(res);
      if (!customLocationLink) {
        setCustomLocationLink(`https://maps.google.com/?q=${matched.lat},${matched.lng}`);
      }
    }
  };

  // 1-Click Auto-Receive GPS Location
  const handleDetectGPSLocation = () => {
    if (!navigator.geolocation) {
      setLocationFeedback(
        language === 'en'
          ? 'Geolocation is not supported on this device. Please select an area from list.'
          : 'మీ డివైస్‌లో లొకేషన్ సదుపాయం అందుబాటులో లేదు. దయచేసి జాబితా నుండి ఎంచుకోండి.'
      );
      return;
    }

    setIsLocating(true);
    setLocationFeedback(
      language === 'en' ? 'Detecting your current GPS location...' : 'మీ ప్రస్తుత GPS లొకేషన్‌ను గుర్తిస్తోంది...'
    );

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const res = checkKollurDeliveryEligibility(lat, lng);
        setCurrentDistanceKm(res.distanceKm);
        setDeliveryEligibility(res);
        const generatedLink = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
        setCustomLocationLink(generatedLink);
        setSelectedPresetArea(language === 'en' ? 'GPS Detected Location' : 'GPS ద్వారా గుర్తించబడిన లొకేషన్');
        setLocationFeedback(
          language === 'en'
            ? `Location captured successfully (${res.distanceKm} km from Kolluru)`
            : `లొకేషన్ విజయవంతంగా స్వీకరించబడింది (${res.distanceKm} కి.మీ.)`
        );
      },
      () => {
        setIsLocating(false);
        setLocationFeedback(
          language === 'en'
            ? 'Location permission denied. Please select from the dropdown or enter address manually.'
            : 'లొకేషన్ అనుమతి లభించలేదు. దయచేసి జాబితా నుండి ఎంచుకోండి లేదా మాన్యువల్ గా నమోదు చేయండి.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Quick Demo Fill
  const handleQuickDemoFill = () => {
    setCustomerName(language === 'en' ? 'Suresh Kumar' : 'సురేష్ కుమార్');
    setMobileNumber('8499865803');
    setSelectedPresetArea(language === 'en' ? PRESET_LOCALITIES[0].nameEn : PRESET_LOCALITIES[0].nameTe);
    setCurrentDistanceKm(0.5);
    setDeliveryEligibility({
      isEligible: true,
      distanceKm: 0.5,
      messageTe: 'ఉచిత డెలివరీ అందుబాటులో ఉంది (కొల్లూరు నుండి దూరం: 0.5 కి.మీ.).',
      messageEn: 'Free delivery available (Distance from Kolluru center: 0.5 km).',
    });
    setAddress(
      language === 'en'
        ? 'Flat 202, Sri Sai Residency, Main Road, Kolluru Village'
        : 'ఇంటి నెం. 2-45, రామాలయం వీధి, కొల్లూరు గ్రామం'
    );
    setLandmark(language === 'en' ? 'Near Gram Panchayat' : 'గ్రామ పంచాయతీ ఎదురుగా');
    setCustomLocationLink('https://maps.google.com/?q=17.4782,78.2323');
    setErrors({});
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    let firstErrorElementId = '';

    if (totalQuantity < 5) {
      errs.quantity = language === 'en' 
        ? 'Minimum order quantity is 5 items.' 
        : 'కనీస ఆర్డర్ 5 సంఖ్య ఉండాలి.';
      if (!firstErrorElementId) firstErrorElementId = 'jowar-roti-card';
    }

    if (jowarQuantity > 0 && jowarQuantity < 5) {
      errs.jowar = language === 'en' 
        ? 'Minimum 5 Jowar Rotis required if selected.' 
        : 'జొన్న రొట్టెలు కనీసం 5 సంఖ్య ఆర్డర్ చేయాలి.';
      if (!firstErrorElementId) firstErrorElementId = 'jowar-roti-card';
    }

    if (chapathiQuantity > 0 && chapathiQuantity < 5) {
      errs.chapathi = language === 'en' 
        ? 'Minimum 5 Chapathis required if selected.' 
        : 'చపాతీలు కనీసం 5 సంఖ్య ఆర్డర్ చేయాలి.';
      if (!firstErrorElementId) firstErrorElementId = 'chapathi-card';
    }

    if (!customerName.trim()) {
      errs.customerName = t.errCustomerName;
      if (!firstErrorElementId) firstErrorElementId = 'customer-name-input';
    }

    const cleanMobile = mobileNumber.replace(/\D/g, '');
    if (!cleanMobile) {
      errs.mobileNumber = t.errMobileEmpty;
      if (!firstErrorElementId) firstErrorElementId = 'customer-mobile-input';
    } else if (cleanMobile.length !== 10) {
      errs.mobileNumber = t.errMobileDigits;
      if (!firstErrorElementId) firstErrorElementId = 'customer-mobile-input';
    }

    if (!address.trim()) {
      errs.address = t.errAddress;
      if (!firstErrorElementId) firstErrorElementId = 'customer-address-input';
    }

    if (!deliveryEligibility.isEligible) {
      errs.delivery = t.errDistance;
      if (!firstErrorElementId) firstErrorElementId = 'locality-select';
    }

    if (!karamSelection.karivepaku && !karamSelection.aviseGinjalu) {
      errs.karam = t.errKaram;
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
      quantity: totalQuantity,
      jowarQuantity,
      chapathiQuantity,
      subtotal: itemsSubtotal,
      deliveryCharge,
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
        distanceKm: currentDist,
      },
      deliveryDate: deliveryDateStr,
      deliveryWindow,
    });
  };

  const isOrderBlockedByHours = !hoursStatus.isOpen && !allowOutsideHours;
  const currentEligibilityMessage = language === 'en' ? deliveryEligibility.messageEn : deliveryEligibility.messageTe;

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
                {language === 'en' ? 'Select Items & Quantities' : 'రొట్టెలు & చపాతీలు ఎంచుకోండి'}
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-telugu">
                {language === 'en' 
                  ? 'Authentic Jowar Rotis (₹30) & Soft Wheat Chapathis (₹10). Minimum order: 5 nos.'
                  : 'పల్లెటూరి జొన్న రొట్టెలు (₹30) మరియు వేడివేడి చపాతీలు (₹10). కనీసం 5 సంఖ్య.'}
              </p>
            </div>
          </div>

          <div className="pt-6 space-y-6">
            {/* Two Menu Items Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* ITEM 1: JOWAR ROTI */}
              <div 
                id="jowar-roti-card"
                className={`p-5 rounded-2xl border-2 transition-all ${
                  jowarQuantity > 0 
                    ? 'border-amber-600 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs' 
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 text-[11px] font-bold font-telugu mb-1">
                      <span>🌾 {language === 'en' ? 'Traditional' : 'సంప్రదాయం'}</span>
                    </div>
                    <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-telugu">
                      {language === 'en' ? 'Authentic Jowar Roti' : 'పల్లె జొన్న రొట్టె'}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 font-telugu mt-0.5">
                      {language === 'en' ? 'Authentic tawa roasted sorghum roti' : 'కట్టెల పొయ్యిపై తాజాగా కాల్చిన మెత్తటి జొన్న రొట్టె'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-[#78350F] dark:text-amber-400 font-mono">
                      ₹30
                    </span>
                    <span className="block text-[10px] text-stone-500 font-telugu">
                      {language === 'en' ? 'per piece' : 'ఒక్కొక్కటి'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-amber-900/10 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Stepper */}
                  <div className="flex items-center gap-2.5 bg-white dark:bg-stone-800 p-1.5 rounded-xl border border-stone-300 dark:border-stone-700 shadow-2xs">
                    <button
                      type="button"
                      onClick={decrementJowar}
                      id="jowar-decrement-btn"
                      className="w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-800 dark:text-stone-100 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-stone-600 active:scale-95 transition-all cursor-pointer"
                      aria-label="Decrease jowar quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="w-14 text-center">
                      <span className="text-xl font-extrabold text-[#78350F] dark:text-amber-400 font-mono">
                        {jowarQuantity}
                      </span>
                      <span className="block text-[10px] text-stone-500 font-telugu">
                        {language === 'en' ? 'rotis' : 'రొట్టెలు'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={incrementJowar}
                      id="jowar-increment-btn"
                      className="w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-800 dark:text-stone-100 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-stone-600 active:scale-95 transition-all cursor-pointer"
                      aria-label="Increase jowar quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[5, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setJowarQuantity(num)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                          jowarQuantity === num
                            ? 'bg-[#78350F] text-white shadow-xs'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100 dark:hover:bg-stone-700'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs font-telugu text-stone-600 dark:text-stone-400">
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    {language === 'en' ? 'Min order: 5 nos' : 'కనీస ఆర్డర్: 5 సంఖ్య'}
                  </span>
                  <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                    {language === 'en' ? 'Subtotal' : 'ఉపమొత్తం'}: ₹{jowarSubtotal}
                  </span>
                </div>
              </div>

              {/* ITEM 2: CHAPATHI */}
              <div 
                id="chapathi-card"
                className={`p-5 rounded-2xl border-2 transition-all ${
                  chapathiQuantity > 0 
                    ? 'border-amber-600 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs' 
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 text-[11px] font-bold font-telugu mb-1">
                      <span>🥞 {language === 'en' ? 'Whole Wheat' : '100% గోధుమ'}</span>
                    </div>
                    <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-telugu">
                      {language === 'en' ? 'Fresh Soft Chapathi' : 'వేడివేడి చపాతీ'}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 font-telugu mt-0.5">
                      {language === 'en' ? 'Soft, freshly made traditional wheat chapathi' : 'చేతితో రుద్దిన తాజా వేడివేడి మెత్తటి గోధుమ చపాతీ'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-amber-700 dark:text-amber-400 font-mono">
                      ₹10
                    </span>
                    <span className="block text-[10px] text-stone-500 font-telugu">
                      {language === 'en' ? 'per piece' : 'ఒక్కొక్కటి'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-amber-900/10 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Stepper */}
                  <div className="flex items-center gap-2.5 bg-white dark:bg-stone-800 p-1.5 rounded-xl border border-stone-300 dark:border-stone-700 shadow-2xs">
                    <button
                      type="button"
                      onClick={decrementChapathi}
                      id="chapathi-decrement-btn"
                      className="w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-800 dark:text-stone-100 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-stone-600 active:scale-95 transition-all cursor-pointer"
                      aria-label="Decrease chapathi quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="w-14 text-center">
                      <span className="text-xl font-extrabold text-amber-700 dark:text-amber-400 font-mono">
                        {chapathiQuantity}
                      </span>
                      <span className="block text-[10px] text-stone-500 font-telugu">
                        {language === 'en' ? 'chapathis' : 'చపాతీలు'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={incrementChapathi}
                      id="chapathi-increment-btn"
                      className="w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-800 dark:text-stone-100 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-stone-600 active:scale-95 transition-all cursor-pointer"
                      aria-label="Increase chapathi quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[0, 5, 10, 15].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setChapathiQuantity(num)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                          chapathiQuantity === num
                            ? 'bg-amber-700 text-white shadow-xs'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100 dark:hover:bg-stone-700'
                        }`}
                      >
                        {num === 0 ? (language === 'en' ? 'None' : 'వద్దు') : num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs font-telugu text-stone-600 dark:text-stone-400">
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    {language === 'en' ? 'Price: ₹10 | Min order: 5 nos' : 'ధర: ₹10 | కనీస ఆర్డర్: 5 సంఖ్య'}
                  </span>
                  <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                    {language === 'en' ? 'Subtotal' : 'ఉపమొత్తం'}: ₹{chapathiSubtotal}
                  </span>
                </div>
              </div>

            </div>

            {/* Combined Live Order Summary Bar */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-stone-900 dark:to-stone-900 border border-amber-200 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-telugu">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    {language === 'en' ? 'Total Selected' : 'మొత్తం ఎంచుకున్నవి'}:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono font-bold text-xs border border-stone-200 dark:border-stone-700">
                    {totalQuantity} {language === 'en' ? 'items' : 'సంఖ్య'}
                  </span>
                  {jowarQuantity > 0 && (
                    <span className="text-xs text-stone-600 dark:text-stone-400">
                      (🌾 {jowarQuantity} {language === 'en' ? 'Rotis' : 'రొట్టెలు'})
                    </span>
                  )}
                  {chapathiQuantity > 0 && (
                    <span className="text-xs text-stone-600 dark:text-stone-400">
                      (🥞 {chapathiQuantity} {language === 'en' ? 'Chapathis' : 'చపాతీలు'})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-400 font-semibold">
                  <Gift className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {language === 'en' 
                      ? `${gramsPerSelected}g complimentary dry podi included!` 
                      : `${gramsPerSelected} గ్రా. ఉచిత పల్లెటూరి కారం పొడి లభిస్తుంది!`}
                  </span>
                </div>
              </div>

              <div className="text-right self-end sm:self-auto">
                <span className="text-xs text-stone-500 dark:text-stone-400 block">
                  {language === 'en' ? 'Total Amount' : 'మొత్తం చెల్లింపు'}
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold text-[#78350F] dark:text-amber-400 font-mono">
                  ₹{totalAmount}
                </span>
              </div>
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
                  {t.freeKaramsSectionTitle}
                </h2>
                {canSelectBoth ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-telugu">
                    {t.bothKaramsAllowedBadge}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-telugu">
                    {t.singleKaramAllowedBadge}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-telugu mt-0.5">
                {canSelectBoth ? t.bothKaramsNotice : t.singleKaramNotice}
              </p>
            </div>
          </div>

          {/* Karam Selection Rule Box */}
          {canSelectBoth ? (
            <div className="my-5 p-4 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 font-telugu space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold text-sm">
                  <Gift className="w-5 h-5 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
                  <span>{t.bothKaramsBannerTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectBothKarams}
                  id="select-both-karams-btn"
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors cursor-pointer"
                >
                  {t.selectBothKaramsBtn}
                </button>
              </div>
              <div className="text-xs text-emerald-800 dark:text-emerald-300">
                {t.eachKaramFreeGrams} <strong className="font-mono font-bold">{gramsPerSelected} {t.gramsUnit}</strong> {t.freeGramsSuffix}. ({t.totalGramsSuffix} <strong className="font-mono">{gramsPerSelected * 2} {t.gramsUnit}</strong>).
              </div>
            </div>
          ) : (
            <div className="my-5 p-4 rounded-xl bg-amber-50/90 dark:bg-stone-900/90 border border-amber-300 dark:border-stone-700 font-telugu space-y-1.5">
              <div className="flex items-center gap-2 text-[#78350F] dark:text-amber-300 font-bold text-xs sm:text-sm">
                <Gift className="w-4 h-4 flex-shrink-0" />
                <span>{t.singleKaramBannerTitle}</span>
              </div>
              <p className="text-xs text-stone-700 dark:text-stone-300">
                {t.singleKaramBannerDesc.replace('{quantity}', quantity.toString()).replace('{grams}', gramsPerSelected.toString())}
                <span className="block text-[#78350F] dark:text-amber-400 font-bold mt-1">
                  {t.singleKaramBannerTip}
                </span>
              </p>
            </div>
          )}

          {/* Karam Selection Cards */}
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

                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Leaf className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-700 dark:text-emerald-400" />
                </div>
              </div>

              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-stone-900 dark:text-stone-100">
                    {t.karivepakuTitle}
                  </span>
                  {!canSelectBoth && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-stone-800 text-amber-900 dark:text-amber-200">
                      {t.optionA}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-tight">
                  {t.karivepakuDesc}
                </p>
                <div className="pt-1.5 flex items-center justify-between flex-wrap gap-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    karamSelection.karivepaku
                      ? 'bg-emerald-600 text-white font-mono'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-500'
                  }`}>
                    {karamSelection.karivepaku 
                      ? `${karivepakuGrams} ${t.gramsUnit} ${t.freeGramsSuffix}` 
                      : t.notSelected}
                  </span>
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

                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-amber-700 dark:text-amber-400" />
                </div>
              </div>

              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-stone-900 dark:text-stone-100">
                    {t.aviseTitle}
                  </span>
                  {!canSelectBoth && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-stone-800 text-amber-900 dark:text-amber-200">
                      {t.optionB}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-tight">
                  {t.aviseDesc}
                </p>
                <div className="pt-1.5 flex items-center justify-between flex-wrap gap-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    karamSelection.aviseGinjalu
                      ? 'bg-emerald-600 text-white font-mono'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-500'
                  }`}>
                    {karamSelection.aviseGinjalu 
                      ? `${aviseGinjaluGrams} ${t.gramsUnit} ${t.freeGramsSuffix}` 
                      : t.notSelected}
                  </span>
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
                  {t.customerDetailsSectionTitle}
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-telugu">
                  {t.customerDetailsSectionSub}
                </p>
              </div>
            </div>

            {/* Quick Demo Fill button */}
            <button
              type="button"
              onClick={handleQuickDemoFill}
              className="px-3.5 py-1.5 rounded-xl bg-amber-100 dark:bg-stone-800 hover:bg-amber-200 dark:hover:bg-stone-700 text-[#78350F] dark:text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all self-end sm:self-auto border border-amber-300 dark:border-stone-700 font-telugu cursor-pointer"
              title={t.sampleFillTitle}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.sampleFillBtn}</span>
            </button>
          </div>

          <div className="pt-6 space-y-5 font-telugu">
            
            {/* Customer Name */}
            <div>
              <label htmlFor="customer-name-input" className="block text-sm font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                {t.customerNameLabel} <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="customer-name-input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t.customerNamePlaceholder}
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
                {t.customerMobileLabel} <span className="text-red-600">*</span>
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
                  {t.deliveryAreaLabel} <span className="text-red-600">*</span>
                </label>

                {/* GPS current location button */}
                <button
                  type="button"
                  onClick={handleDetectGPSLocation}
                  disabled={isLocating}
                  id="detect-gps-btn"
                  className="inline-flex items-center gap-1 text-xs text-[#78350F] dark:text-amber-400 font-semibold hover:underline cursor-pointer"
                >
                  <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? t.detectingGps : t.detectGpsBtn}</span>
                </button>
              </div>

              <select
                id="locality-select"
                value={selectedPresetArea}
                onChange={(e) => handleLocalityChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FDFBF7] dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#78350F] text-sm cursor-pointer"
              >
                {PRESET_LOCALITIES.map((loc) => {
                  const areaName = language === 'en' ? loc.nameEn : loc.nameTe;
                  const tag = loc.deliveryCharge === 0 
                    ? (language === 'en' ? '— Free Delivery (within 5 km)' : '— ఉచిత డెలివరీ (5 కి.మీ. లోపల)')
                    : (language === 'en' ? `— Delivery +₹${loc.deliveryCharge} (Above 5 km)` : `— డెలివరీ ఛార్జీ +₹${loc.deliveryCharge} (5 కి.మీ. పైబడినది)`);
                  const distUnit = language === 'en' ? 'km' : 'కి.మీ.';
                  return (
                    <option key={loc.nameTe} value={loc.nameTe}>
                      {areaName} ({loc.distanceKm} {distUnit} {tag})
                    </option>
                  );
                })}
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
                <span>{currentEligibilityMessage}</span>
              </div>
            </div>

            {/* Complete Address */}
            <div>
              <label htmlFor="customer-address-input" className="block text-sm font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                {t.addressLabel} <span className="text-red-600">*</span>
              </label>
              <textarea
                id="customer-address-input"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t.addressPlaceholder}
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

            {/* Landmark Input */}
            <div>
              <label htmlFor="customer-landmark-input" className="block text-sm font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                {t.landmarkLabel}
              </label>
              <input
                type="text"
                id="customer-landmark-input"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder={t.landmarkPlaceholder}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FDFBF7] dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#78350F] text-sm"
              />
            </div>

            {/* 1-Click Auto-Receive Location Link Component */}
            <div className="p-4 sm:p-5 rounded-2xl border-2 border-dashed border-amber-800/25 dark:border-stone-700 bg-amber-50/40 dark:bg-stone-900/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#78350F] dark:text-amber-400 flex-shrink-0" />
                    <span>{t.gpsLocationCardTitle}</span>
                  </span>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                    {t.gpsLocationCardSub}
                  </p>
                </div>

                {/* Big 1-Click Receive Button */}
                <button
                  type="button"
                  onClick={handleDetectGPSLocation}
                  disabled={isLocating}
                  id="click-to-receive-location-btn"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#78350F] hover:bg-[#8C4A26] active:scale-95 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer disabled:opacity-60 flex-shrink-0"
                >
                  <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? t.locationReceiving : t.clickToReceiveLocation}</span>
                </button>
              </div>

              {/* Status feedback & link preview */}
              {customLocationLink ? (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-emerald-950 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="font-bold block">
                        {t.gpsSuccessNotice}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300 truncate max-w-xs sm:max-w-md block">
                        {customLocationLink}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={customLocationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:underline bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{t.checkOnMap}</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleDetectGPSLocation}
                      className="text-[11px] text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 underline cursor-pointer"
                    >
                      {t.refresh}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-stone-600 dark:text-stone-400 bg-white/70 dark:bg-stone-800/70 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700">
                  {locationFeedback ? (
                    <span className="font-semibold text-amber-900 dark:text-amber-300">{locationFeedback}</span>
                  ) : (
                    <span>{t.autoLocationHint}</span>
                  )}
                </div>
              )}

              {/* Optional manual toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowManualLocationInput(prev => !prev)}
                  className="text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-300 underline cursor-pointer"
                >
                  {showManualLocationInput ? t.hideManualLink : t.showManualLink}
                </button>

                {showManualLocationInput && (
                  <div className="mt-2">
                    <input
                      type="text"
                      id="customer-location-link"
                      value={customLocationLink}
                      onChange={(e) => setCustomLocationLink(e.target.value)}
                      placeholder="https://maps.google.com/?q=..."
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Date & Window (Fixed: 6:00 PM - 8:00 PM) */}
            <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-stone-900/60 border border-amber-900/10 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-semibold text-stone-600 dark:text-stone-400">{t.deliveryDateLabel}</span>
                <span className="font-bold text-base text-stone-900 dark:text-stone-100 font-mono">
                  {deliveryDateStr}
                </span>
              </div>

              <div>
                <span className="block text-xs font-semibold text-stone-600 dark:text-stone-400">{t.deliveryTimeWindowLabel}</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-base text-[#78350F] dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>{t.deliveryWindowTime}</span>
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
              <p className="font-bold">{t.errorCheckPrompt}</p>
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
                {t.orderReviewTitle}
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                {t.orderReviewSub.replace('{quantity}', quantity.toString())}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-stone-600 dark:text-stone-400 block">{t.totalPayableLabel}</span>
              <span className="text-3xl font-extrabold text-[#78350F] dark:text-amber-400 font-mono">
                ₹{totalAmount}
              </span>
            </div>
          </div>

          {/* Order Items & Karam Summary Breakdown */}
          <div className="py-3 text-xs sm:text-sm font-telugu text-stone-700 dark:text-stone-300 space-y-1">
            {jowarQuantity > 0 && (
              <div className="flex justify-between">
                <span>🌾 {language === 'en' ? 'Jowar Rotis' : 'జొన్న రొట్టెలు'} ({jowarQuantity} × ₹30):</span>
                <span className="font-mono font-bold">₹{jowarSubtotal}</span>
              </div>
            )}
            {chapathiQuantity > 0 && (
              <div className="flex justify-between">
                <span>🥞 {language === 'en' ? 'Fresh Chapathis' : 'వేడివేడి చపాతీలు'} ({chapathiQuantity} × ₹10):</span>
                <span className="font-mono font-bold">₹{chapathiSubtotal}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-stone-500 dark:text-stone-400 pt-0.5 border-t border-amber-900/10 dark:border-stone-800">
              <span>{language === 'en' ? 'Total Items' : 'మొత్తం ఐటెమ్స్'}:</span>
              <span className="font-mono font-semibold">{totalQuantity} {language === 'en' ? 'nos' : 'సంఖ్య'}</span>
            </div>
            <div className="flex justify-between text-emerald-800 dark:text-emerald-400 font-semibold">
              <span>{t.karivepakuTitle}:</span>
              <span>
                {karamSelection.karivepaku 
                  ? `${karivepakuGrams} ${t.gramsUnit} (${t.freeCostZero})` 
                  : t.notSelected}
              </span>
            </div>
            <div className="flex justify-between text-emerald-800 dark:text-emerald-400 font-semibold">
              <span>{t.aviseTitle}:</span>
              <span>
                {karamSelection.aviseGinjalu 
                  ? `${aviseGinjaluGrams} ${t.gramsUnit} (${t.freeCostZero})` 
                  : t.notSelected}
              </span>
            </div>
            <div className="flex justify-between text-stone-600 dark:text-stone-400 pt-1 border-t border-amber-900/10 dark:border-stone-800">
              <span>{language === 'en' ? 'Items Subtotal:' : 'రొట్టెల ఉపమొత్తం:'}</span>
              <span className="font-mono font-bold text-stone-800 dark:text-stone-200">₹{itemsSubtotal}</span>
            </div>
            <div className="flex justify-between items-center text-stone-600 dark:text-stone-400">
              <div>
                <span>{t.homeDeliveryLine}</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 block">
                  {isFreeDelivery 
                    ? (language === 'en' ? 'Within 5 km radius (Free)' : 'కొల్లూరు కేంద్రం నుండి 5 కి.మీ. పరిధిలో ఉచితం')
                    : (language === 'en' ? `${extraKm} km above 5 km @ ₹9/km` : `5 కి.మీ. పైబడిన ${extraKm} కి.మీ. (కి.మీ.కు ₹9 చొప్పున)`)}
                </span>
              </div>
              <span className={`font-bold font-mono ${isFreeDelivery ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#78350F] dark:text-amber-400'}`}>
                {isFreeDelivery ? t.freeCostZero : `+₹${deliveryCharge}`}
              </span>
            </div>
          </div>

          {/* Submit / Proceed Button */}
          <div className="pt-4 flex flex-col gap-3">
            {/* Missing Info Prompt */}
            {(!customerName.trim() || mobileNumber.replace(/\D/g, '').length !== 10 || !address.trim()) && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-stone-900 border border-amber-300 dark:border-stone-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 font-telugu text-xs">
                <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>{t.missingDetailsPrompt}</span>
                </div>
                <button
                  type="button"
                  onClick={handleQuickDemoFill}
                  className="px-3 py-1.5 rounded-lg bg-[#78350F] hover:bg-[#8C4A26] text-white font-bold flex items-center gap-1 text-xs self-end sm:self-auto shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t.sampleFillBtn}</span>
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isOrderBlockedByHours || !deliveryEligibility.isEligible}
              id="proceed-to-payment-btn"
              className="w-full py-4 px-6 rounded-xl font-bold text-base sm:text-lg text-amber-50 bg-[#78350F] hover:bg-[#8C4A26] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-950/20 flex items-center justify-center gap-3 transition-all font-telugu cursor-pointer"
            >
              <span>{t.proceedPaymentBtn} (₹{totalAmount})</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {isOrderBlockedByHours && (
              <p className="text-center text-xs text-amber-800 dark:text-amber-300 font-telugu font-semibold">
                {t.hoursClosedWarning}
              </p>
            )}

            {!deliveryEligibility.isEligible && (
              <p className="text-center text-xs text-red-600 dark:text-red-400 font-telugu font-semibold">
                {t.beyondRadiusWarning}
              </p>
            )}

            {/* Strict Online Payment Only Badge */}
            <div className="p-3 rounded-xl bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 flex items-center justify-center gap-2 text-xs font-bold text-[#78350F] dark:text-amber-300 font-telugu text-center">
              <ShieldCheck className="w-4 h-4 text-[#78350F] dark:text-amber-400 flex-shrink-0" />
              <span>
                {language === 'en'
                  ? '⚠️ No Cash on Delivery. Order is placed only after verified online UPI payment.'
                  : '⚠️ క్యాష్ ఆన్ డెలివరీ లేదు. ఆన్‌లైన్ పేమెంట్ పూర్తయిన తర్వాత మాత్రమే ఆర్డర్ నమోదవుతుంది.'}
              </span>
            </div>
          </div>

        </div>

      </form>
    </div>
  );
};
