export type Language = 'te' | 'en';

export interface Translations {
  // Brand
  brandName: string;
  brandTagline: string;
  brandSubtext: string;
  villageLocation: string;

  // Language switcher
  languageLabel: string;
  selectLanguagePrompt: string;

  // Header & Navigation
  ordersOpenStatus: string;
  ordersClosedStatus: string;
  trackFeedbackBtn: string;
  androidAppBtn: string;
  callOwnerBtn: string;
  orderPageBtn: string;

  // Hero Section
  badgeTraditional: string;
  heroDescription: string;
  featurePriceTitle: string;
  featurePriceSub: string;
  featureKaramTitle: string;
  featureKaramSub: string;
  featureDeliveryTitle: string;
  featureDeliverySub: string;
  featureTimeTitle: string;
  featureTimeSub: string;
  orderNowBtn: string;
  securePaymentNote: string;

  // Menu Highlights
  highlightsTitle: string;
  highlightsSubtitle: string;
  pureIngredientsTitle: string;
  pureIngredientsDesc: string;
  freshlyMadeTitle: string;
  freshlyMadeDesc: string;
  healthyNutritiousTitle: string;
  healthyNutritiousDesc: string;
  hygienicKitchenTitle: string;
  hygienicKitchenDesc: string;
  freshBatchBadge: string;
  villageCraftBadge: string;

  // Ordering Hours Banner
  orderingHoursTitle: string;
  ordersAcceptingTitle: string;
  ordersPausedTitle: string;
  currentIstLabel: string;
  before4pmLabel: string;
  before4pmDesc: string;
  after4pmLabel: string;
  after4pmDesc: string;

  // Order Form - Section 1: Quantity
  selectQuantityTitle: string;
  selectQuantitySubtitle: string;
  rotisUnit: string;
  subtotalLabel: string;
  freeKollurDeliveryBadge: string;

  // Order Form - Section 2: Karam
  freeKaramsSectionTitle: string;
  bothKaramsAllowedBadge: string;
  singleKaramAllowedBadge: string;
  bothKaramsNotice: string;
  singleKaramNotice: string;
  bothKaramsBannerTitle: string;
  selectBothKaramsBtn: string;
  eachKaramFreeGrams: string;
  gramsUnit: string;
  freeGramsSuffix: string;
  totalGramsSuffix: string;
  singleKaramBannerTitle: string;
  singleKaramBannerDesc: string;
  singleKaramBannerTip: string;
  karivepakuTitle: string;
  karivepakuDesc: string;
  aviseTitle: string;
  aviseDesc: string;
  optionA: string;
  optionB: string;
  notSelected: string;

  // Order Form - Section 3: Customer Details & 5km Radius
  customerDetailsSectionTitle: string;
  customerDetailsSectionSub: string;
  sampleFillBtn: string;
  sampleFillTitle: string;
  customerNameLabel: string;
  customerNamePlaceholder: string;
  customerMobileLabel: string;
  deliveryAreaLabel: string;
  detectGpsBtn: string;
  detectingGps: string;
  freeDeliveryTag: string;
  outside5kmTag: string;
  addressLabel: string;
  addressPlaceholder: string;
  landmarkLabel: string;
  landmarkPlaceholder: string;
  gpsLocationCardTitle: string;
  gpsLocationCardSub: string;
  clickToReceiveLocation: string;
  locationReceiving: string;
  gpsSuccessNotice: string;
  checkOnMap: string;
  refresh: string;
  autoLocationHint: string;
  hideManualLink: string;
  showManualLink: string;
  deliveryDateLabel: string;
  deliveryTimeWindowLabel: string;
  deliveryWindowTime: string;

  // Order Form - Errors & Validation
  errorCheckPrompt: string;
  errCustomerName: string;
  errMobileEmpty: string;
  errMobileDigits: string;
  errAddress: string;
  errDistance: string;
  errKaram: string;

  // Order Form - Section 4: Review & Checkout
  orderReviewTitle: string;
  orderReviewSub: string;
  totalPayableLabel: string;
  rotisSubtotalLine: string;
  freeCostZero: string;
  homeDeliveryLine: string;
  missingDetailsPrompt: string;
  proceedPaymentBtn: string;
  hoursClosedWarning: string;
  beyondRadiusWarning: string;
  paymentOptionsNote: string;

  // Payment Modal
  selectPaymentMethod: string;
  onlineUpiTab: string;
  podTab: string;
  amountToPay: string;
  rotisFreeDeliverySub: string;
  phonePeAlertTitle: string;
  phonePeAlertDesc: string;
  phonePeSolution: string;
  easyMobileHeader: string;
  successRate100: string;
  mobileNumberLabel: string;
  recipientName: string;
  copyNumber: string;
  numberCopied: string;
  copyUpiBtn: string;
  orScanQr: string;
  downloadQr: string;
  utrLabel: string;
  utrPlaceholder: string;
  confirmUpiBtn: string;
  confirmPodBtn: string;
  verifyingPayment: string;
  submittingOrder: string;
  podNoticeText: string;

  // Order Confirmation
  orderConfirmedTitle: string;
  orderConfirmedSubtitlePod: string;
  orderConfirmedSubtitleUpi: string;
  orderNumberLabel: string;
  orderDetailsTitle: string;
  paidStatus: string;
  payAtDeliveryStatus: string;
  deliveryDateCol: string;
  freeKaramsIncluded: string;
  deliveryAddressHeader: string;
  sendToWhatsAppBtn: string;
  copyTicketBtn: string;
  ticketCopiedBtn: string;
  orderAgainBtn: string;

  // Order Tracking & Post-Order Feedback
  myOrderStatusTitle: string;
  orderStatusSub: string;
  searchByOrderId: string;
  searchBtn: string;
  searchingBtn: string;
  recentOrdersTitle: string;
  orderNotFound: string;
  orderReceivedMarkBtn: string;
  orderReceivedSuccess: string;
  orderReceivedPrompt: string;
  deliveryStatusLabel: string;
  statusDelivered: string;
  statusOutForDelivery: string;
  statusPreparing: string;
  statusNew: string;
  feedbackHeader: string;
  feedbackSubmittedTitle: string;
  feedbackSubmittedThanks: string;
  rateYourExperience: string;
  selectStarRatingError: string;
  customerReviewPlaceholder: string;
  feedbackNameLabel: string;
  submitFeedbackBtn: string;
  submittingFeedbackBtn: string;
  closeBtn: string;

  // Android Install Modal & Banner
  pwaInstallBadge: string;
  pwaBannerHeadline: string;
  pwaBannerDesc: string;
  pwaFreeBadge: string;
  installAppBtn: string;
  noPlayStoreNeeded: string;
  freeAndSafe: string;
  installDownloadNowBtn: string;
  howToInstallTitle: string;
  chromeStep1: string;
  chromeStep2: string;
  chromeStep3: string;
  iosNotice: string;
  openInChromeBtn: string;

  // Footer
  footerRights: string;
  footerFreeDelivery: string;
  ownerPortalLink: string;
  footerTimings: string;
}

export const translations: Record<Language, Translations> = {
  te: {
    // Brand
    brandName: 'మన ఇంటి వంట',
    brandTagline: 'అచ్చమైన పల్లెటూరి రుచులు — స్వచ్ఛమైన ఆరోగ్యం',
    brandSubtext: 'ప్రతి రోజూ వేడివేడి జొన్న రొట్టెలు & సాంప్రదాయ కారాలు',
    villageLocation: 'కొల్లూరు గ్రామం',

    // Language switcher
    languageLabel: 'భాష',
    selectLanguagePrompt: 'భాషను ఎంచుకోండి',

    // Header & Navigation
    ordersOpenStatus: 'ఆర్డర్లు అందుబాటులో ఉన్నాయి (11 AM - 4 PM)',
    ordersClosedStatus: 'నేటి డెలివరీ ఆర్డర్లు ముగిశాయి',
    trackFeedbackBtn: 'ఆర్డర్ ఫీడ్‌బ్యాక్',
    androidAppBtn: 'Android యాప్',
    callOwnerBtn: 'కాల్ చేయండి',
    orderPageBtn: 'ఆర్డరింగ్ పేజీ',

    // Hero Section
    badgeTraditional: 'స్వచ్ఛమైన గ్రామీణ సంప్రదాయ ఆహారం',
    heroDescription: 'రోజూ సాయంత్రం పొయ్యి మీద తాజాగా కాల్చిన మెత్తటి పల్లె జొన్న రొట్టెలు. ప్రతి రొట్టె కేవలం ₹30 మాత్రమే. ప్రతి పూర్తి 5 రొట్టెలకు 20 గ్రా. ఉచిత పల్లెటూరి కారం (కరివేపాకు కారం లేదా అవిసె గింజల కారం).',
    featurePriceTitle: 'ధర: ఒక్కొక్కటి ₹30',
    featurePriceSub: 'కనీస ఆర్డర్: 5 రొట్టెలు',
    featureKaramTitle: 'ఉచిత కారాలు',
    featureKaramSub: 'ప్రతి 5 రొట్టెలకు 20 గ్రా. ఉచితం',
    featureDeliveryTitle: 'ఉచిత డెలివరీ',
    featureDeliverySub: 'కొల్లూరు నుండి 5 కి.మీ. పరిధిలో',
    featureTimeTitle: 'డెలివరీ సమయం',
    featureTimeSub: 'సాయంత్రం 6:00 – 8:00 గంటలు',
    orderNowBtn: 'ఇప్పుడే ఆర్డర్ చేయండి',
    securePaymentNote: 'ఆన్‌లైన్ UPI లేదా డెలివరీ వద్ద చెల్లింపు అందుబాటులో ఉంది.',

    // Menu Highlights
    highlightsTitle: 'మన ఇంటి వంట విశిష్టతలు',
    highlightsSubtitle: 'ఎలాంటి రసాయనాలు లేని పక్కా సహజ సిద్ధమైన గ్రామీణ రుచి',
    pureIngredientsTitle: '100% స్వచ్ఛమైన జొన్న పిండి',
    pureIngredientsDesc: 'ఎటువంటి మైదా, గోధుమ పిండి లేదా ప్రిజర్వేటివ్‌లు కలపకుండా రోజూ రుబ్బిన స్వచ్ఛమైన జొన్నలతో తయారుచేస్తాము.',
    freshlyMadeTitle: 'ఆర్డర్ పైనే వేడివేడిగా',
    freshlyMadeDesc: 'మీ ఆర్డర్ ఆధారంగా సాయంత్రం వేళ అప్పటికప్పుడు వేడి పెనంపై సిద్ధం చేసి డెలివరీకి పంపుతాము.',
    healthyNutritiousTitle: 'షుగర్, బీపీ వారికి అమృతం',
    healthyNutritiousDesc: 'పీచు పదార్థం, ప్రోటీన్లు సమృద్ధిగా ఉండే సంపూర్ణ ఆరోగ్యాన్నిచ్చే సహజ ఆహారం.',
    hygienicKitchenTitle: 'అమ్మ చేతి పరిశుభ్రత',
    hygienicKitchenDesc: 'పల్లెటూరి ఇంటి వాతావరణంలో సంపూర్ణ శుభ్రతతో, స్వచ్ఛమైన తాగునీటితో రొట్టెలను తయారుచేస్తాము.',
    freshBatchBadge: 'నేటి తాజా బ్యాచ్',
    villageCraftBadge: '100% పల్లెటూరి సంప్రదాయం',

    // Ordering Hours Banner
    orderingHoursTitle: 'ఆర్డరింగ్ సమయాలు',
    ordersAcceptingTitle: 'ఆర్డర్లు స్వీకరించబడుతున్నాయి (రోజంతా ఆర్డర్ చేయవచ్చు)',
    ordersPausedTitle: 'ఆర్డర్ల స్వీకరణ ప్రస్తుతం నిలిపివేయబడింది',
    currentIstLabel: 'ప్రస్తుత IST సమయం:',
    before4pmLabel: 'సాయంత్రం 4:00 PM లోపు:',
    before4pmDesc: 'నేటి సాయంత్రం 6:00 – 8:00 PM కి డెలివరీ',
    after4pmLabel: 'సాయంత్రం 4:00 PM దాటితే:',
    after4pmDesc: 'రేపటి సాయంత్రం 6:00 – 8:00 PM కి డెలివరీ',

    // Order Form - Section 1: Quantity
    selectQuantityTitle: 'జొన్న రొట్టెల సంఖ్య ఎంచుకోండి',
    selectQuantitySubtitle: 'తాజా మధ్యస్థ పరిమాణపు జొన్న రొట్టె | ఒక్కొక్కటి ₹30 (కనీసం 5 రొట్టెలు)',
    rotisUnit: 'రొట్టెలు',
    subtotalLabel: 'రొట్టెల ఉపమొత్తం:',
    freeKollurDeliveryBadge: '✓ కొల్లూరు పరిధిలో ఉచిత డెలివరీ',

    // Order Form - Section 2: Karam
    freeKaramsSectionTitle: 'ఉచిత సాంప్రదాయ కారాలు',
    bothKaramsAllowedBadge: '🎉 రెండు కారాలూ ఎంచుకోవచ్చు! (10+ రొట్టెలు)',
    singleKaramAllowedBadge: 'ఏదైనా ఒకటి మాత్రమే (10 రొట్టెల వరకు)',
    bothKaramsNotice: 'మీరు 10 కంటే ఎక్కువ రొట్టెలు ఆర్డర్ చేస్తున్నారు! కరివేపాకు మరియు అవిసె గింజల కారం రెండింటినీ ఉచితంగా ఎంచుకోవచ్చు.',
    singleKaramNotice: '10 రొట్టెల వరకు ఒక కారం మాత్రమే (కరివేపాకు లేదా అవిసె గింజల కారం) ఉచితంగా ఎంచుకోవచ్చు.',
    bothKaramsBannerTitle: '🎉 10 రొట్టెల కంటే ఎక్కువ ఆర్డర్ చేస్తున్నారు - రెండు కారాలూ ఉచితం!',
    selectBothKaramsBtn: 'రెండు కారాలనూ ఎంచుకోండి',
    eachKaramFreeGrams: 'మీరు ఎంచుకున్న ప్రతి కారం:',
    gramsUnit: 'గ్రాములు',
    freeGramsSuffix: 'ఉచితం',
    totalGramsSuffix: 'రెండూ కలిపి మొత్తం',
    singleKaramBannerTitle: 'ఒక కారం మాత్రమే ఉచితం (కరివేపాకు లేదా అవిసె గింజల కారం)',
    singleKaramBannerDesc: 'మీరు {quantity} రొట్టెలు ఎంచుకున్నారు. కావున ఏదైనా ఒక కారాన్ని మాత్రమే ఎంచుకోవచ్చు ({grams} గ్రాములు ఉచితం).',
    singleKaramBannerTip: '💡 సలహా: 10 కంటే ఎక్కువ రొట్టెలు ఆర్డర్ చేస్తే రెండు కారాలనూ ఉచితంగా పొందవచ్చు!',
    karivepakuTitle: 'కరివేపాకు కారం',
    karivepakuDesc: 'స్వచ్ఛమైన తాజా కరివేపాకు, ఎండుమిర్చి, వెల్లుల్లితో రోట్లో దంచినట్లు సిద్ధం చేసిన కారం',
    aviseTitle: 'అవిసె గింజల కారం',
    aviseDesc: 'వేయించిన నాణ్యమైన అవిసె గింజలు, ఎండుమిర్చిల సంప్రదాయ ఘుమఘుమలాడే కారం',
    optionA: 'ఆప్షన్ A',
    optionB: 'ఆప్షన్ B',
    notSelected: 'ఎంపిక కాలేదు',

    // Order Form - Section 3: Customer Details & 5km Radius
    customerDetailsSectionTitle: 'కస్టమర్ వివరాలు & డెలివరీ చిరునామా',
    customerDetailsSectionSub: 'కొల్లూరు గ్రామం నుండి 5 కి.మీ. పరిధిలో ఉచిత హోమ్ డెలివరీ',
    sampleFillBtn: 'నమూనా వివరాలు నింపండి',
    sampleFillTitle: 'టెస్ట్ చేయడానికి ఒకే క్లిక్‌తో నమూనా వివరాలను నింపండి',
    customerNameLabel: 'కస్టమర్ పూర్తి పేరు',
    customerNamePlaceholder: 'ఉదాహరణ: సురేష్ కుమార్',
    customerMobileLabel: 'మొబైల్ సంఖ్య (10 అంకెలు)',
    deliveryAreaLabel: 'డెలివరీ ప్రాంతం (కొల్లూరు 5 కి.మీ. పరిధి)',
    detectGpsBtn: 'నా ప్రస్తుత GPS లొకేషన్ గుర్తించండి',
    detectingGps: 'గుర్తిస్తోంది...',
    freeDeliveryTag: 'ఉచిత డెలివరీ',
    outside5kmTag: '5 కి.మీ. దాటింది',
    addressLabel: 'పూర్తి చిరునామా (ఫ్లాట్ / ఇంటి నంబర్, వీధి, కాలనీ)',
    addressPlaceholder: 'ఉదాహరణ: ఫ్లాట్ 202, శ్రీ సాయి రెసిడెన్సీ, మెయిన్ రోడ్, కొల్లూరు',
    landmarkLabel: 'ల్యాండ్మార్క్ (గుడి, పాఠశాల లేదా అపార్ట్‌మెంట్ పేరు)',
    landmarkPlaceholder: 'ఉదా: గ్రామ పంచాయతీ దగ్గర లేదా రామాలయం ఎదురుగా',
    gpsLocationCardTitle: 'ఖచ్చితమైన డెలివరీ లొకేషన్ లింక్',
    gpsLocationCardSub: 'లింక్ వెతకడం లేదా కాపీ చేయనవసరం లేదు — ఒకే క్లిక్‌తో మీ లొకేషన్ పొందండి',
    clickToReceiveLocation: '📍 క్లిక్ చేసి లొకేషన్ పొందండి',
    locationReceiving: 'లొకేషన్ స్వీకరిస్తోంది...',
    gpsSuccessNotice: 'GPS లొకేషన్ లింక్ విజయవంతంగా స్వీకరించబడింది!',
    checkOnMap: 'మ్యాప్‌లో సరిచూడండి',
    refresh: 'రీఫ్రెష్',
    autoLocationHint: '💡 పై బటన్ నొక్కగానే మీ ఫోన్ లేదా బ్రౌజర్ నుండి ఖచ్చితమైన Google Maps లొకేషన్ లింక్ స్వయంచాలకంగా ఇక్కడ నమోదవుతుంది.',
    hideManualLink: '− మాన్యువల్ లింక్ బాక్స్ దాచండి',
    showManualLink: '+ లేదా లింక్ మాన్యువల్ గా పేస్ట్ చేయండి',
    deliveryDateLabel: 'డెలివరీ తేదీ:',
    deliveryTimeWindowLabel: 'డెలివరీ సమయం:',
    deliveryWindowTime: 'సాయంత్రం 6:00 – 8:00 గంటలు',

    // Order Form - Errors & Validation
    errorCheckPrompt: 'దయచేసి క్రింది వివరాలను సరిచూసుకోండి:',
    errCustomerName: 'దయచేసి మీ పూర్తి పేరు నమోదు చేయండి.',
    errMobileEmpty: 'దయచేసి మొబైల్ నంబర్ నమోదు చేయండి.',
    errMobileDigits: 'సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి (ఉదా: 8499865803).',
    errAddress: 'దయచేసి పూర్తి డెలివరీ చిరునామా (ఇంటి నం, కాలనీ) నమోదు చేయండి.',
    errDistance: 'కొల్లూరు గ్రామం నుండి 5 కి.మీ. పరిధి దాటింది. ఉచిత డెలివరీ కేవలం 5 కి.మీ. లోపలే సాధ్యం.',
    errKaram: 'దయచేసి కనీసం ఒక ఉచిత కారాన్ని ఎంచుకోండి (కరివేపాకు లేదా అవిసె గింజల కారం).',

    // Order Form - Section 4: Review & Checkout
    orderReviewTitle: 'ఆర్డర్ సమీక్ష',
    orderReviewSub: '{quantity} జొన్న రొట్టెలు + ఉచిత కారాలు',
    totalPayableLabel: 'మొత్తం చెల్లించవలసినది:',
    rotisSubtotalLine: 'జొన్న రొట్టెలు',
    freeCostZero: 'ఉచితం (₹0)',
    homeDeliveryLine: 'హోమ్ డెలివరీ (కొల్లూరు 5 కి.మీ. పరిధి):',
    missingDetailsPrompt: 'ఆర్డర్ చేయడానికి పైన పేరు, మొబైల్ నంబర్ మరియు చిరునామా నమోదు చేయండి.',
    proceedPaymentBtn: 'చెల్లింపుకు కొనసాగించండి',
    hoursClosedWarning: '⚠️ ఆర్డర్ల సమయం (11:00 AM – 4:00 PM IST) ముగిసినందున చెకౌట్ డిసేబుల్ చేయబడింది.',
    beyondRadiusWarning: '⚠️ దయచేసి కొల్లూరు గ్రామం నుండి 5 కి.మీ. పరిధిలోని చిరునామాను ఎంచుకోండి.',
    paymentOptionsNote: 'సురక్షిత UPI చెల్లింపు లేదా డెలివరీ సమయంలో చెల్లింపు అందుబాటులో ఉంది.',

    // Payment Modal
    selectPaymentMethod: 'చెల్లింపు విధానం ఎంచుకోండి',
    onlineUpiTab: 'ఆన్‌లైన్ UPI (PhonePe / GPay / QR)',
    podTab: 'డెలివరీ వద్ద చెల్లింపు',
    amountToPay: 'చెల్లించవలసిన మొత్తం:',
    rotisFreeDeliverySub: '{quantity} రొట్టెలు × ₹30 (ఉచిత కారాలు & డెలివరీ)',
    phonePeAlertTitle: 'PhonePe లేదా GPay లో సమస్య ఎదురైందా?',
    phonePeAlertDesc: 'కొన్ని బ్యాంకులు వెబ్ లింక్‌లను భద్రతా కారణాలతో నిరోధిస్తాయి. సులభంగా క్రింది మొబైల్ నంబర్‌కు నేరుగా చెల్లించవచ్చు.',
    phonePeSolution: 'మీ PhonePe/GPay లో "To Mobile Number" ఎంచుకుని క్రింది 8499865803 నంబర్‌కు ₹{amount} పంపవచ్చు.',
    easyMobileHeader: 'అత్యంత సులభం — మొబైల్ నంబర్ ద్వారా పంపండి:',
    successRate100: '100% సక్సెస్',
    mobileNumberLabel: 'PhonePe / GPay మొబైల్ నంబర్:',
    recipientName: 'పేరు: నల్లబోతుల మల్లయ్య',
    copyNumber: 'నంబర్ కాపీ చేయండి',
    numberCopied: 'నంబర్ కాపీ అయింది!',
    copyUpiBtn: 'UPI ID కాపీ',
    orScanQr: 'లేదా QR కోడ్ స్కాన్ చేసి చెల్లించండి (₹{amount}):',
    downloadQr: 'QR కోడ్ డౌన్‌లోడ్ చేయండి',
    utrLabel: 'UPI లావాదేవీ UTR / Ref నంబర్ (ఐచ్ఛికం):',
    utrPlaceholder: 'ఉదా: 425319871234',
    confirmUpiBtn: 'నేను చెల్లించాను — ఆర్డర్ కన్ఫర్మ్ చేయండి',
    confirmPodBtn: 'డెలివరీ వద్ద చెల్లింపుతో ఆర్డర్ కన్ఫర్మ్ చేయండి',
    verifyingPayment: 'ధృవీకరిస్తోంది...',
    submittingOrder: 'నమోదు చేస్తోంది...',
    podNoticeText: 'తాజా రొట్టెలు మీ ఇంటికి చేరిన తర్వాత నగదు లేదా డెలివరీ బాయ్ వద్ద UPI ద్వారా చెల్లించవచ్చు.',

    // Order Confirmation
    orderConfirmedTitle: 'ధన్యవాదాలు! మీ ఆర్డర్ విజయవంతంగా నమోదైంది',
    orderConfirmedSubtitlePod: 'డెలివరీ సమయంలో చెల్లింపు. మీ ఆర్డర్ మా కిచెన్‌లో నమోదు చేయబడింది.',
    orderConfirmedSubtitleUpi: 'ఆన్‌లైన్ UPI చెల్లింపు ధృవీకరించబడింది. మీ ఆర్డర్ మా కిచెన్‌లో నమోదు చేయబడింది.',
    orderNumberLabel: 'ఆర్డర్ నంబర్:',
    orderDetailsTitle: 'ఆర్డర్ వివరాలు',
    paidStatus: '(చెల్లించబడింది)',
    payAtDeliveryStatus: '(డెలివరీ వద్ద చెల్లించాలి)',
    deliveryDateCol: 'డెలివరీ సమయం:',
    freeKaramsIncluded: '🎁 ఉచిత కారాలు:',
    deliveryAddressHeader: '📍 డెలివరీ చిరునామా & కస్టమర్ వివరాలు:',
    sendToWhatsAppBtn: 'WhatsApp లో ఆర్డర్ వివరాలు పంపండి',
    copyTicketBtn: 'ఆర్డర్ వివరాలు కాపీ చేయండి',
    ticketCopiedBtn: 'ఆర్డర్ వివరాలు కాపీ అయ్యాయి!',
    orderAgainBtn: 'మరొక కొత్త ఆర్డర్ చేయండి',

    // Order Tracking & Post-Order Feedback
    myOrderStatusTitle: 'నా ఆర్డర్ స్థితి & ఫీడ్‌బ్యాక్',
    orderStatusSub: 'ఆర్డర్ డెలివరీ నిర్ధారణ & రేటింగ్',
    searchByOrderId: 'ఆర్డర్ నంబర్ ద్వారా వెతకండి:',
    searchBtn: 'వెతకండి',
    searchingBtn: 'వెతుకుతోంది...',
    recentOrdersTitle: 'ఈ పరికరంలో చేసిన తాజా ఆర్డర్లు:',
    orderNotFound: 'ఆర్డర్ కనుగొనబడలేదు.',
    orderReceivedMarkBtn: '📦 ఆర్డర్ అందిందిగా మార్క్ చేయండి',
    orderReceivedSuccess: 'ఆర్డర్ స్వీకరించబడింది',
    orderReceivedPrompt: 'మీ చేతికి వేడివేడి జొన్న రొట్టెల ఆర్డర్ అందిన తర్వాత క్రింది బటన్ నొక్కండి.',
    deliveryStatusLabel: 'డెలివరీ స్థితి:',
    statusDelivered: 'డెలివరీ పూర్తయింది',
    statusOutForDelivery: 'డెలివరీలో ఉంది',
    statusPreparing: 'తయారవుతోంది',
    statusNew: 'నమోదైంది',
    feedbackHeader: 'ఆర్డర్ డెలివరీ & కస్టమర్ ఫీడ్‌బ్యాక్',
    feedbackSubmittedTitle: 'ధన్యవాదాలు! మీ అభిప్రాయం సమర్పించబడింది',
    feedbackSubmittedThanks: 'మీ రేటింగ్ మరియు అమూల్యమైన అభిప్రాయానికి ధన్యవాదాలు!',
    rateYourExperience: 'మీ అనుభవానికి రేటింగ్ ఇవ్వండి:',
    selectStarRatingError: 'దయచేసి నక్షత్రాల రేటింగ్ ఎంచుకోండి.',
    customerReviewPlaceholder: 'రొట్టెల రుచి, కారం లేదా డెలివరీ గురించి మీ అభిప్రాయం రాయండి...',
    feedbackNameLabel: 'మీ పేరు (ఐచ్ఛికం):',
    submitFeedbackBtn: 'ఫీడ్‌బ్యాక్ సమర్పించండి',
    submittingFeedbackBtn: 'సమర్పిస్తోంది...',
    closeBtn: 'మూసివేయండి',

    // Android Install Modal & Banner
    pwaInstallBadge: 'ఆండ్రాయిడ్ యాప్',
    pwaBannerHeadline: 'మన ఇంటి వంట - Android యాప్ అందుబాటులో ఉంది!',
    pwaBannerDesc: 'మీ ఫోన్ హోమ్ స్క్రీన్‌పై డౌన్‌లోడ్ చేసుకొని సులభంగా జొన్న రొట్టెలు ఆర్డర్ చేయండి',
    pwaFreeBadge: '100% ఉచిత డౌన్‌లోడ్',
    installAppBtn: 'యాప్ ఇన్‌స్టాల్',
    noPlayStoreNeeded: 'ప్లేస్టోర్ అవసరం లేదు (Direct)',
    freeAndSafe: '100% ఉచితం & సురక్షితం',
    installDownloadNowBtn: 'ఇప్పుడే యాప్ ఇన్‌స్టాల్ / డౌన్‌లోడ్ చేయండి',
    howToInstallTitle: 'బ్రౌజర్ నుండి ఎలా ఇన్‌స్టాల్ చేయాలి?',
    chromeStep1: 'బ్రౌజర్ మెను (మూడు చుక్కలు ⋮) నొక్కండి',
    chromeStep2: '"Install app" లేదా "Add to Home screen" ఎంచుకోండి',
    chromeStep3: 'ధృవీకరించండి — యాప్ మీ మొబైల్ హోమ్ స్క్రీన్‌లో కనిపిస్తుంది',
    iosNotice: 'ఐఫోన్ (iOS) లో: Safari లో Share బటన్ నొక్కి "Add to Home Screen" ఎంచుకోండి.',
    openInChromeBtn: 'Chrome బ్రౌజర్‌లో తెరవండి',

    // Footer
    footerRights: 'మన ఇంటి వంట — అన్ని హక్కులు ప్రత్యేకించబడ్డాయి.',
    footerFreeDelivery: 'కొల్లూరు గ్రామం నుండి 5 కి.మీ. పరిధిలో ఉచిత డెలివరీ.',
    ownerPortalLink: 'యజమాని పోర్టల్',
    footerTimings: 'ఆర్డర్లు: 11:00 AM – 4:00 PM | డెలివరీ: 6:00 – 8:00 PM',
  },

  en: {
    // Brand
    brandName: 'Mana Enti Vanta',
    brandTagline: 'Authentic Homemade Village Flavors — Pure & Healthy',
    brandSubtext: 'Daily Fresh Hot Jowar Rotis & Traditional Village Podis',
    villageLocation: 'Kolluru Village',

    // Language switcher
    languageLabel: 'Language',
    selectLanguagePrompt: 'Choose Language',

    // Header & Navigation
    ordersOpenStatus: 'Orders Open (11:00 AM - 4:00 PM)',
    ordersClosedStatus: 'Orders Closed for Today',
    trackFeedbackBtn: 'Order Feedback',
    androidAppBtn: 'Android App',
    callOwnerBtn: 'Call',
    orderPageBtn: 'Order Page',

    // Hero Section
    badgeTraditional: '100% Traditional Village Cuisine',
    heroDescription: 'Authentic sorghum (jowar) rotis freshly roasted on hot tawa every evening. Just ₹30 per roti. Complimentary homemade dry podi (Curry Leaf / Flax Seeds Karam) with every 5 rotis.',
    featurePriceTitle: 'Price: ₹30 each',
    featurePriceSub: 'Minimum order: 5 rotis',
    featureKaramTitle: 'Free Dry Podis',
    featureKaramSub: '20g free per 5 rotis',
    featureDeliveryTitle: 'Free Delivery',
    featureDeliverySub: 'Within 5 km of Kolluru',
    featureTimeTitle: 'Delivery Time',
    featureTimeSub: 'Evening 6:00 PM – 8:00 PM',
    orderNowBtn: 'Order Now',
    securePaymentNote: 'Secure UPI or Pay on Delivery available.',

    // Menu Highlights
    highlightsTitle: 'Why Choose Mana Enti Vanta?',
    highlightsSubtitle: 'Chemical-free, zero maida, pure traditional village nutrition',
    pureIngredientsTitle: '100% Pure Sorghum (Jowar)',
    pureIngredientsDesc: 'Prepared from freshly milled premium jowar with zero maida, wheat, or artificial preservatives.',
    freshlyMadeTitle: 'Freshly Made on Order',
    freshlyMadeDesc: 'Every batch is prepared fresh on the hot tawa just before evening delivery.',
    healthyNutritiousTitle: 'Diabetic & Heart Friendly',
    healthyNutritiousDesc: 'High dietary fiber, rich plant proteins, and low glycemic index for complete holistic health.',
    hygienicKitchenTitle: 'Hygienic Home Kitchen',
    hygienicKitchenDesc: 'Crafted in a clean rural home kitchen with purified water and utmost care.',
    freshBatchBadge: "Today's Fresh Batch",
    villageCraftBadge: '100% Traditional Village Craft',

    // Ordering Hours Banner
    orderingHoursTitle: 'Ordering Hours',
    ordersAcceptingTitle: 'Accepting Orders (24/7 Ordering Available)',
    ordersPausedTitle: 'Orders Currently Paused',
    currentIstLabel: 'Current IST:',
    before4pmLabel: 'Before 4:00 PM:',
    before4pmDesc: "Today's Evening 6:00 – 8:00 PM Delivery",
    after4pmLabel: 'After 4:00 PM:',
    after4pmDesc: "Tomorrow's Evening 6:00 – 8:00 PM Delivery",

    // Order Form - Section 1: Quantity
    selectQuantityTitle: 'Select Number of Jowar Rotis',
    selectQuantitySubtitle: 'Fresh medium-sized jowar roti | ₹30 each (Minimum 5 rotis)',
    rotisUnit: 'Rotis',
    subtotalLabel: 'Rotis Subtotal:',
    freeKollurDeliveryBadge: '✓ Free delivery within Kolluru radius',

    // Order Form - Section 2: Karam
    freeKaramsSectionTitle: 'Complimentary Traditional Podis',
    bothKaramsAllowedBadge: '🎉 You can choose both podis! (10+ rotis)',
    singleKaramAllowedBadge: 'Choose one only (Up to 10 rotis)',
    bothKaramsNotice: 'You are ordering more than 10 rotis! You can choose both Curry Leaf & Flax Seeds podis for free.',
    singleKaramNotice: 'Up to 10 rotis, choose one complimentary podi (Curry Leaf or Flax Seeds).',
    bothKaramsBannerTitle: '🎉 Ordering more than 10 rotis - Both podis are free!',
    selectBothKaramsBtn: 'Select Both Podis',
    eachKaramFreeGrams: 'Each selected podi:',
    gramsUnit: 'grams',
    freeGramsSuffix: 'Free',
    totalGramsSuffix: 'Together total',
    singleKaramBannerTitle: 'Only one complimentary podi included (Curry Leaf or Flax Seeds)',
    singleKaramBannerDesc: 'You selected {quantity} rotis. You can choose one complimentary podi ({grams}g free).',
    singleKaramBannerTip: '💡 Tip: Order more than 10 rotis (11+) to get both podis for free!',
    karivepakuTitle: 'Curry Leaf Podi',
    karivepakuDesc: 'Crushed with fresh curry leaves, dried red chillies, garlic & roasted lentils',
    aviseTitle: 'Flax Seeds Podi',
    aviseDesc: 'Roasted premium flax seeds with red chillies, spices & healthy Omega-3',
    optionA: 'Option A',
    optionB: 'Option B',
    notSelected: 'Not selected',

    // Order Form - Section 3: Customer Details & 5km Radius
    customerDetailsSectionTitle: 'Customer & Delivery Address',
    customerDetailsSectionSub: 'Free home delivery within 5 km radius of Kolluru village',
    sampleFillBtn: 'Fill Sample Details',
    sampleFillTitle: 'Fill sample details for quick testing with one click',
    customerNameLabel: 'Customer Full Name',
    customerNamePlaceholder: 'e.g., Suresh Kumar',
    customerMobileLabel: 'Mobile Number (10 digits)',
    deliveryAreaLabel: 'Delivery Area (Kolluru 5 km Radius)',
    detectGpsBtn: 'Detect My Current GPS Location',
    detectingGps: 'Detecting...',
    freeDeliveryTag: 'Free Delivery',
    outside5kmTag: 'Beyond 5 km',
    addressLabel: 'Complete Address (Flat / House No, Street, Colony)',
    addressPlaceholder: 'e.g., Flat 202, Sri Sai Residency, Main Road, Kolluru',
    landmarkLabel: 'Nearby Landmark (Temple, School or Apartment)',
    landmarkPlaceholder: 'e.g., Near Gram Panchayat or Opposite Rama Temple',
    gpsLocationCardTitle: 'Accurate Delivery Location Link',
    gpsLocationCardSub: 'No need to search or copy — receive live GPS location in one tap',
    clickToReceiveLocation: '📍 Tap to Share Location',
    locationReceiving: 'Receiving location...',
    gpsSuccessNotice: 'GPS location link successfully received!',
    checkOnMap: 'View on Map',
    refresh: 'Refresh',
    autoLocationHint: '💡 Tapping the button above will automatically capture your precise Google Maps location link.',
    hideManualLink: '− Hide manual link input',
    showManualLink: '+ Or paste maps link manually',
    deliveryDateLabel: 'Delivery Date:',
    deliveryTimeWindowLabel: 'Delivery Window:',
    deliveryWindowTime: 'Evening 6:00 – 8:00 PM',

    // Order Form - Errors & Validation
    errorCheckPrompt: 'Please correct the following fields:',
    errCustomerName: 'Please enter your full name.',
    errMobileEmpty: 'Please enter mobile number.',
    errMobileDigits: 'Please enter a valid 10-digit mobile number (e.g., 8499865803).',
    errAddress: 'Please enter complete delivery address (House No, Colony).',
    errDistance: 'Address is beyond 5 km from Kolluru village. Free delivery is only within 5 km.',
    errKaram: 'Please select at least one complimentary podi (Curry Leaf or Flax Seeds).',

    // Order Form - Section 4: Review & Checkout
    orderReviewTitle: 'Order Summary',
    orderReviewSub: '{quantity} Jowar Rotis + Complimentary Podis',
    totalPayableLabel: 'Total Payable Amount:',
    rotisSubtotalLine: 'Jowar Rotis',
    freeCostZero: 'Free (₹0)',
    homeDeliveryLine: 'Home Delivery (Within 5 km):',
    missingDetailsPrompt: 'Please enter name, mobile number and address above to proceed.',
    proceedPaymentBtn: 'Proceed to Payment',
    hoursClosedWarning: '⚠️ Ordering is currently paused outside schedule (11:00 AM – 4:00 PM IST).',
    beyondRadiusWarning: '⚠️ Please select an address within 5 km of Kolluru village.',
    paymentOptionsNote: 'Secure UPI payment or Pay on Delivery is available.',

    // Payment Modal
    selectPaymentMethod: 'Select Payment Method',
    onlineUpiTab: 'Online UPI (PhonePe / GPay / QR)',
    podTab: 'Pay on Delivery (Cash / UPI)',
    amountToPay: 'Total Payable Amount:',
    rotisFreeDeliverySub: '{quantity} Rotis × ₹30 (Free Podis & Delivery)',
    phonePeAlertTitle: 'Did PhonePe or GPay show a security decline?',
    phonePeAlertDesc: 'Some banks decline automatic app links. You can safely send directly to the owner mobile number below.',
    phonePeSolution: 'In PhonePe or GPay, choose "To Mobile Number" and send ₹{amount} to 8499865803.',
    easyMobileHeader: 'Easiest Method — Pay to Mobile Number:',
    successRate100: '100% Success',
    mobileNumberLabel: 'PhonePe / GPay Mobile Number:',
    recipientName: 'Name: Nallabothula Mallaiah',
    copyNumber: 'Copy Mobile Number',
    numberCopied: 'Number Copied!',
    copyUpiBtn: 'Copy UPI ID',
    orScanQr: 'Or Scan QR Code to Pay (₹{amount}):',
    downloadQr: 'Download QR Code',
    utrLabel: 'UPI Transaction UTR / Ref (Optional):',
    utrPlaceholder: 'e.g., 425319871234',
    confirmUpiBtn: 'I Have Paid — Confirm Order',
    confirmPodBtn: 'Confirm Order with Pay on Delivery',
    verifyingPayment: 'Verifying...',
    submittingOrder: 'Submitting...',
    podNoticeText: 'Pay cash or scan UPI with our delivery partner when fresh hot rotis arrive at your doorstep.',

    // Order Confirmation
    orderConfirmedTitle: 'Thank You! Your Order is Confirmed',
    orderConfirmedSubtitlePod: 'Pay on Delivery. Your order has been scheduled in our village kitchen.',
    orderConfirmedSubtitleUpi: 'Online payment confirmed. Your order has been scheduled in our village kitchen.',
    orderNumberLabel: 'Order ID:',
    orderDetailsTitle: 'Order Summary',
    paidStatus: '(Paid)',
    payAtDeliveryStatus: '(Pay on Delivery)',
    deliveryDateCol: 'Delivery Window:',
    freeKaramsIncluded: '🎁 Complimentary Podis Included:',
    deliveryAddressHeader: '📍 Delivery Address & Customer Details:',
    sendToWhatsAppBtn: 'Send Order Details via WhatsApp',
    copyTicketBtn: 'Copy Order Details',
    ticketCopiedBtn: 'Order details copied!',
    orderAgainBtn: 'Place Another Order',

    // Order Tracking & Post-Order Feedback
    myOrderStatusTitle: 'My Order Status & Feedback',
    orderStatusSub: 'Delivery confirmation and customer rating',
    searchByOrderId: 'Search by Order ID:',
    searchBtn: 'Search',
    searchingBtn: 'Searching...',
    recentOrdersTitle: 'Recent Orders on this Device:',
    orderNotFound: 'Order not found.',
    orderReceivedMarkBtn: '📦 Mark Order as Received',
    orderReceivedSuccess: 'Order Received',
    orderReceivedPrompt: 'Tap below once your hot jowar rotis have arrived at your doorstep.',
    deliveryStatusLabel: 'Delivery Status:',
    statusDelivered: 'Delivered',
    statusOutForDelivery: 'Out for Delivery',
    statusPreparing: 'Preparing',
    statusNew: 'Order Placed',
    feedbackHeader: 'Order Delivery & Customer Feedback',
    feedbackSubmittedTitle: 'Thank You! Your Feedback Has Been Submitted',
    feedbackSubmittedThanks: 'Thank you for your rating and valuable review!',
    rateYourExperience: 'Rate Your Experience:',
    selectStarRatingError: 'Please select a star rating.',
    customerReviewPlaceholder: 'Share your feedback on taste, podis, or delivery...',
    feedbackNameLabel: 'Your Name (Optional):',
    submitFeedbackBtn: 'Submit Feedback',
    submittingFeedbackBtn: 'Submitting...',
    closeBtn: 'Close',

    // Android Install Modal & Banner
    pwaInstallBadge: 'Android App',
    pwaBannerHeadline: 'Mana Enti Vanta - Android App Available!',
    pwaBannerDesc: 'Install to your phone home screen to order fresh jowar rotis anytime',
    pwaFreeBadge: '100% Free Download',
    installAppBtn: 'Install App',
    noPlayStoreNeeded: 'No Play Store needed (Direct)',
    freeAndSafe: '100% Free & Safe',
    installDownloadNowBtn: 'Install / Download App Now',
    howToInstallTitle: 'How to Install from Browser?',
    chromeStep1: 'Tap browser menu (three dots ⋮)',
    chromeStep2: 'Select "Install app" or "Add to Home screen"',
    chromeStep3: 'Confirm — the app icon will appear on your phone home screen',
    iosNotice: 'On iPhone (iOS): Tap the Safari Share button and select "Add to Home Screen".',
    openInChromeBtn: 'Open in Chrome Browser',

    // Footer
    footerRights: 'Mana Enti Vanta — All rights reserved.',
    footerFreeDelivery: 'Free delivery within 5 km of Kolluru village.',
    ownerPortalLink: 'Owner Portal',
    footerTimings: 'Orders: 11:00 AM – 4:00 PM | Delivery: 6:00 – 8:00 PM',
  }
};
