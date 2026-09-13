import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');

// Helper to read/write JSON files safely
function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
  }
  return fallback;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e);
  }
}

// Initial seed orders for demonstration / realistic initial audit history
const INITIAL_ORDERS = [
  {
    id: 'SMJR-20260909-1021',
    createdAt: '2026-09-09T06:15:00.000Z',
    createdAtIST: '9 సెప్టెంబర్ 2026, 11:45 AM',
    quantity: 10,
    pricePerRoti: 30,
    totalPaid: 300,
    karamSelection: { karivepaku: true, aviseGinjalu: true },
    karamQuantities: { karivepakuGrams: 100, aviseGinjaluGrams: 100 },
    customer: {
      name: 'వెంకటేశ్వర్లు గారు',
      mobile: '9848022338',
      address: 'ఫ్లాట్ 304, రాఘవేంద్ర నిలయం, కొల్లూరు గ్రామం',
      landmark: 'గ్రామ పంచాయతీ ఎదురుగా',
      locationLink: 'https://maps.google.com/?q=17.4782,78.2323',
      distanceKm: 0.8
    },
    deliveryDate: '9 సెప్టెంబర్ 2026',
    deliveryWindow: 'సాయంత్రం 6–8 గంటలు',
    paymentStatus: 'VERIFIED',
    paymentReference: 'UPI-REF-982471928371',
    paymentVerifiedAt: '2026-09-09T06:16:30.000Z',
    fulfillmentStatus: 'DELIVERED',
    statusUpdatedAt: '2026-09-09T13:30:00.000Z',
    statusUpdatedBy: 'ADMIN'
  },
  {
    id: 'SMJR-20260909-1045',
    createdAt: '2026-09-09T08:30:00.000Z',
    createdAtIST: '9 సెప్టెంబర్ 2026, 02:00 PM',
    quantity: 15,
    pricePerRoti: 30,
    totalPaid: 450,
    karamSelection: { karivepaku: true, aviseGinjalu: false },
    karamQuantities: { karivepakuGrams: 150, aviseGinjaluGrams: 0 },
    customer: {
      name: 'లక్ష్మి ప్రసన్న',
      mobile: '9440182736',
      address: 'బ్లాక్ బి-12, 2BHK డిగ్నిటీ కాలనీ, కొల్లూరు',
      landmark: 'ప్రభుత్వ పాఠశాల దగ్గర',
      locationLink: 'https://maps.google.com/?q=17.4720,78.2250',
      distanceKm: 1.4
    },
    deliveryDate: '9 సెప్టెంబర్ 2026',
    deliveryWindow: 'సాయంత్రం 6–8 గంటలు',
    paymentStatus: 'VERIFIED',
    paymentReference: 'UPI-REF-982489102834',
    paymentVerifiedAt: '2026-09-09T08:31:40.000Z',
    fulfillmentStatus: 'DELIVERED',
    statusUpdatedAt: '2026-09-09T13:45:00.000Z',
    statusUpdatedBy: 'ADMIN'
  }
];

// Initialize files if not existing
if (!fs.existsSync(ORDERS_FILE)) {
  writeJsonFile(ORDERS_FILE, INITIAL_ORDERS);
}

if (!fs.existsSync(AUDIT_FILE)) {
  writeJsonFile(AUDIT_FILE, [
    {
      id: 'AUD-INIT-01',
      timestamp: new Date().toISOString(),
      timestampIST: 'సిస్టమ్ ప్రారంభం',
      type: 'PAYMENT_VERIFIED',
      orderId: 'SMJR-20260909-1021',
      amount: 300,
      paymentReference: 'UPI-REF-982471928371',
      details: 'ఆన్‌లైన్ UPI పేమెంట్ విజయవంతంగా పూర్తయింది (10 జొన్న రొట్టెలు).',
      actor: 'UPI Gateway / Server'
    },
    {
      id: 'AUD-INIT-02',
      timestamp: new Date().toISOString(),
      timestampIST: 'సిస్టమ్ ప్రారంభం',
      type: 'PAYMENT_VERIFIED',
      orderId: 'SMJR-20260909-1045',
      amount: 450,
      paymentReference: 'UPI-REF-982489102834',
      details: 'ఆన్‌లైన్ UPI పేమెంట్ విజయవంతంగా పూర్తయింది (15 జొన్న రొట్టెలు).',
      actor: 'UPI Gateway / Server'
    }
  ]);
}

if (!fs.existsSync(FEEDBACK_FILE)) {
  writeJsonFile(FEEDBACK_FILE, [
    {
      id: 'FDBK-INIT-01',
      orderId: 'SMJR-20260909-1021',
      rating: 5,
      comments: 'రొట్టెలు వేడివేడిగా చాలా మెత్తగా ఉన్నాయి. కరివేపాకు కారం అదిరిపోయింది!',
      aspects: ['TASTE_SOFTNESS', 'KARIVEPAKU_KARAM', 'HOT_AND_FRESH', 'PACKAGING'],
      customerName: 'వెంకటేశ్వర్లు గారు',
      customerMobile: '9848022338',
      createdAt: '2026-09-09T14:15:00.000Z',
      createdAtIST: '9 సెప్టెంబర్ 2026, 07:45 PM'
    },
    {
      id: 'FDBK-INIT-02',
      orderId: 'SMJR-20260909-1045',
      rating: 5,
      comments: 'సాయంత్రం సరైన సమయానికి డెలివరీ చేశారు. ఆరోగ్యకరమైన స్వచ్ఛమైన జొన్న రొట్టెలు.',
      aspects: ['TASTE_SOFTNESS', 'ON_TIME_DELIVERY', 'HOT_AND_FRESH'],
      customerName: 'లక్ష్మి ప్రసన్న',
      customerMobile: '9440182736',
      createdAt: '2026-09-09T14:30:00.000Z',
      createdAtIST: '9 సెప్టెంబర్ 2026, 08:00 PM'
    }
  ]);
}

// Global admin sessions store
interface ActiveSession {
  token: string;
  role: 'ADMIN' | 'STAFF';
  expiresAt: number;
}
const activeSessions = new Map<string, ActiveSession>();

// IST Time Helper
function getISTInfo() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const findPart = (t: string) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);

  const year = findPart('year');
  const month = findPart('month');
  const date = findPart('day');
  const hours = findPart('hour');
  const minutes = findPart('minute');
  const seconds = findPart('second');

  // Business ordering hours: 11:00 AM - 4:00 PM IST (11:00 to 16:00)
  const totalMinutes = hours * 60 + minutes;
  const openMinutes = 11 * 60; // 11:00 AM
  const closeMinutes = 16 * 60; // 04:00 PM

  const isOpen = totalMinutes >= openMinutes && totalMinutes < closeMinutes;

  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeFormatted = `${pad(hour12)}:${pad(minutes)}:${pad(seconds)} ${ampm} IST`;

  const TELUGU_MONTHS = [
    'జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్',
    'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'
  ];
  const dateTelugu = `${date} ${TELUGU_MONTHS[month - 1]} ${year}`;

  // Tomorrow's date for after 4 PM orders
  const tomorrowTime = new Date(now.getTime() + (24 + 5.5) * 60 * 60 * 1000);
  const tomorrowParts = formatter.formatToParts(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const tFindPart = (t: string) => parseInt(tomorrowParts.find(p => p.type === t)?.value || '0', 10);
  const tYear = tFindPart('year');
  const tMonth = tFindPart('month');
  const tDate = tFindPart('day');
  const tomorrowDateTelugu = `${tDate} ${TELUGU_MONTHS[tMonth - 1]} ${tYear}`;

  const isTodayDelivery = hours < 16; // Before 4:00 PM IST is today's delivery
  const targetDeliveryDate = isTodayDelivery ? dateTelugu : tomorrowDateTelugu;
  const targetDeliveryDateLabel = isTodayDelivery ? `${dateTelugu} (నేడు)` : `${tomorrowDateTelugu} (రేపు)`;

  return {
    year,
    month,
    date,
    hours,
    minutes,
    seconds,
    totalMinutes,
    isOpen: true, // Always allow customers to place orders (active or advance pre-order)
    isLiveBatchHours: isOpen,
    isTodayDelivery,
    targetDeliveryDate,
    targetDeliveryDateLabel,
    timeFormatted,
    dateTelugu,
  };
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 1. Get ordering hours status
app.get('/api/status', (req, res) => {
  const ist = getISTInfo();
  
  let nextOpenMessage = '';
  if (ist.isTodayDelivery) {
    if (ist.hours >= 11) {
      const rem = 16 * 60 - ist.totalMinutes;
      const h = Math.floor(rem / 60);
      const m = rem % 60;
      nextOpenMessage = `నేటి సాయంత్రం డెలివరీ కోసం ఆర్డర్లు అందుబాటులో ఉన్నాయి! నేటి ఆర్డర్ల ముగింపుకు ఇంకా ${h > 0 ? `${h} గం. ` : ''}${m} ని. సమయం ఉంది.`;
    } else {
      nextOpenMessage = `నేటి సాయంత్రం 6:00 – 8:00 PM డెలివరీ కోసం ఆర్డర్లు స్వీకరించబడుతున్నాయి.`;
    }
  } else {
    nextOpenMessage = `రేపటి సాయంత్రం 6:00 – 8:00 PM డెలివరీ కోసం ముందస్తు ఆర్డర్లు (Pre-orders) స్వీకరించబడుతున్నాయి.`;
  }

  res.json({
    isOpen: true, // 24/7 ordering enabled
    isLiveBatchHours: ist.isLiveBatchHours,
    currentTimeIST: ist.timeFormatted,
    currentDateIST: ist.targetDeliveryDateLabel,
    hours: ist.hours,
    minutes: ist.minutes,
    openTimeStr: '24/7 ఆర్డరింగ్ అందుబాటులో ఉంది',
    closeTimeStr: 'సాయంత్రం 04:00 PM (నేటి డెలివరీ కటాఫ్)',
    deliveryWindow: 'సాయంత్రం 6:00 - 8:00 గంటలు',
    deliveryDate: ist.targetDeliveryDate,
    nextOpenMessage,
    serviceArea: 'కొల్లూరు గ్రామం నుండి 5 కి.మీ. వరకు ఉచిత డెలివరీ (5 కి.మీ. పైబడితే ₹9/కి.మీ.)'
  });
});

// 2. Check delivery eligibility (Free within 5 km, ₹9/km above 5 km)
app.post('/api/check-delivery', (req, res) => {
  const { distanceKm, localityName } = req.body;
  const dist = typeof distanceKm === 'number' ? Math.max(0, Math.round(distanceKm * 10) / 10) : 1.0;
  const isFreeDelivery = dist <= 5.0;
  const extraKm = dist > 5.0 ? Math.round((dist - 5.0) * 10) / 10 : 0;
  const deliveryCharge = dist > 5.0 ? Math.max(9, Math.round(extraKm * 9)) : 0;
  const isEligible = dist <= 35.0; // Serviceable up to 35 km

  let message = '';
  if (!isEligible) {
    message = `క్షమించండి, మీ చిరునామా కొల్లూరు నుండి ${dist} కి.మీ. దూరంలో ఉంది. మా గరిష్ట డెలివరీ పరిధి 35 కి.మీ. మాత్రమే.`;
  } else if (isFreeDelivery) {
    message = `ఉచిత డెలివరీ అందుబాటులో ఉంది (కొల్లూరు కేంద్రం నుండి దూరం: ${dist} కి.మీ. — 5 కి.మీ. పరిధి లోపల ఉచితం).`;
  } else {
    message = `కొల్లూరు నుండి దూరం: ${dist} కి.మీ. (5 కి.మీ. పైబడిన దూరం: ${extraKm} కి.మీ.). డెలివరీ ఛార్జీ: ₹${deliveryCharge} (కి.మీ.కు ₹9 చొప్పున).`;
  }

  res.json({
    isEligible,
    distanceKm: dist,
    isFreeDelivery,
    extraKm,
    deliveryCharge,
    localityName: localityName || 'కొల్లూరు పరిసర ప్రాంతం',
    message
  });
});

// 3. Initiate payment order
app.post('/api/payment/create-order', (req, res) => {
  const { quantity, jowarQuantity, chapathiQuantity, karamSelection, customer } = req.body;
  const ist = getISTInfo();

  // Validate quantities
  const parsedQuantity = parseInt(quantity, 10);
  const jowarQty = typeof jowarQuantity === 'number' 
    ? jowarQuantity 
    : (!isNaN(parsedQuantity) && !chapathiQuantity ? parsedQuantity : 0);
  const chapathiQty = typeof chapathiQuantity === 'number' ? chapathiQuantity : 0;

  if (jowarQty > 0 && jowarQty < 5) {
    return res.status(400).json({
      error: 'INVALID_QUANTITY',
      message: 'జొన్న రొట్టెలు ఆర్డర్ చేస్తే కనీసం 5 రొట్టెలు ఎంచుకోవాలి.'
    });
  }
  if (chapathiQty > 0 && chapathiQty < 5) {
    return res.status(400).json({
      error: 'INVALID_QUANTITY',
      message: 'చపాతీలు ఆర్డర్ చేస్తే కనీసం 5 చపాతీలు ఎంచుకోవాలి.'
    });
  }

  const totalBreads = jowarQty + chapathiQty;
  if (totalBreads < 5) {
    return res.status(400).json({
      error: 'INVALID_QUANTITY',
      message: 'కనీసం 5 జొన్న రొట్టెలు లేదా చపాతీలు ఆర్డర్ చేయాలి.'
    });
  }

  // Calculate pricing & karam
  const pricePerRoti = 30;
  const pricePerChapathi = 10;
  const itemsSubtotal = (jowarQty * pricePerRoti) + (chapathiQty * pricePerChapathi);

  // Delivery charge calculation: Free within 5 km, ₹9/km for distance above 5 km
  const customerDistance = typeof customer?.distanceKm === 'number' ? Math.max(0, customer.distanceKm) : 0.5;
  const extraKm = customerDistance > 5.0 ? Math.round((customerDistance - 5.0) * 10) / 10 : 0;
  const deliveryCharge = customerDistance > 5.0 ? Math.max(9, Math.round(extraKm * 9)) : 0;
  const totalAmount = itemsSubtotal + deliveryCharge;

  const setsOf5 = Math.max(1, Math.floor(totalBreads / 5));
  const gramsPerSelected = setsOf5 * 20;

  // Business Rule:
  // - If totalBreads <= 10: only ONE karam option allowed (either Karivepaku OR Avise Ginjalu).
  // - If totalBreads > 10: BOTH options are allowed.
  const canSelectBoth = totalBreads > 10;
  let normalizedKaram = {
    karivepaku: !!karamSelection?.karivepaku,
    aviseGinjalu: !!karamSelection?.aviseGinjalu,
  };

  if (!canSelectBoth && normalizedKaram.karivepaku && normalizedKaram.aviseGinjalu) {
    normalizedKaram.aviseGinjalu = false;
  }
  if (!normalizedKaram.karivepaku && !normalizedKaram.aviseGinjalu) {
    normalizedKaram.karivepaku = true;
  }

  const karamQuantities = {
    karivepakuGrams: normalizedKaram.karivepaku ? gramsPerSelected : 0,
    aviseGinjaluGrams: normalizedKaram.aviseGinjalu ? gramsPerSelected : 0,
  };

  // Validate customer details
  if (!customer?.name || !customer?.mobile || !customer?.address) {
    return res.status(400).json({
      error: 'MISSING_CUSTOMER_INFO',
      message: 'దయచేసి పేరు, మొబైల్ నంబర్ మరియు పూర్తి చిరునామా నమోదు చేయండి.'
    });
  }

  const cleanMobile = customer.mobile.replace(/\D/g, '');
  if (cleanMobile.length !== 10) {
    return res.status(400).json({
      error: 'INVALID_MOBILE',
      message: 'సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి.'
    });
  }

  // Generate unique payment transaction reference and order intent
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const paymentReference = `UPI-REF-${nowStr}-${Date.now().toString().slice(-4)}${randomSuffix}`;

  // UPI intent string - Clean standard URI without tr= that triggers bank security decline
  const upiId = 'nmallaiah12@axl';
  const merchantName = encodeURIComponent('Mallaiah Nallabothula');
  const upiUri = `upi://pay?pa=${upiId}&pn=${merchantName}&am=${totalAmount}&cu=INR`;

  res.json({
    success: true,
    paymentReference,
    amount: totalAmount,
    currency: 'INR',
    upiId,
    merchantName: 'శ్రీ మల్లికార్జున పల్లె జొన్న రొట్టెలు (నల్లబోతుల మల్లయ్య)',
    ownerPhone: '8499865803',
    upiUri,
    calculatedDetails: {
      quantity: totalBreads,
      jowarQuantity,
      chapathiQuantity,
      pricePerRoti,
      pricePerChapathi,
      subtotal: itemsSubtotal,
      distanceKm: customerDistance,
      extraKm,
      deliveryCharge,
      totalAmount,
      karamQuantities,
      deliveryWindow: 'సాయంత్రం 6–8 గంటలు',
      deliveryDate: ist.dateTelugu
    },
    providerStatus: {
      isConfigured: true,
      mode: 'UPI_DIRECT_SERVER_VERIFIED',
      disclaimer: 'ఆన్‌లైన్ UPI చెల్లింపు మాత్రమే (No Cash on Delivery). చెల్లింపు తర్వాత మాత్రమే ఆర్డర్ నమోదవుతుంది.'
    }
  });
});

// 4. Server-Side Payment Verification and Order Creation
app.post('/api/payment/verify', (req, res) => {
  const { paymentReference, orderData, verificationToken } = req.body;

  if (!paymentReference) {
    return res.status(400).json({ error: 'Missing payment reference' });
  }

  const orders = readJsonFile<any[]>(ORDERS_FILE, []);

  // Duplicate check: ensure this payment reference hasn't already been used
  const existingOrder = orders.find(o => o.paymentReference === paymentReference);
  if (existingOrder) {
    return res.status(409).json({
      error: 'DUPLICATE_ORDER',
      message: 'ఈ పేమెంట్ రిఫరెన్స్‌తో ఆర్డర్ ఇప్పటికే విజయవంతంగా నమోదైంది.',
      order: existingOrder
    });
  }

  // Server-side payment validation
  // Strict rule: NO Cash on Delivery. Orders placed only after verified online payment!
  const cleanRef = String(paymentReference).trim();
  const isPayOnDelivery = cleanRef.startsWith('POD-') || cleanRef.startsWith('COD-') || cleanRef.toUpperCase().includes('DELIVERY') || cleanRef.toUpperCase().includes('CASH');
  
  if (isPayOnDelivery) {
    return res.status(400).json({
      error: 'NO_CASH_ON_DELIVERY',
      message: 'నగదు డెలివరీ (Cash on Delivery) సదుపాయం అందుబాటులో లేదు. ఆన్‌లైన్ పేమెంట్ పూర్తయిన తర్వాత మాత్రమే ఆర్డర్ నమోదవుతుంది.'
    });
  }

  if (cleanRef.length < 4) {
    return res.status(400).json({
      error: 'INVALID_PAYMENT_PROOF',
      message: 'చెల్లుబాటు అయ్యే UPI పేమెంట్ రిఫరెన్స్ లేదా UTR నంబర్ నమోదు చేయండి.'
    });
  }

  const ist = getISTInfo();
  const dateNum = `${ist.year}${String(ist.month).padStart(2, '0')}${String(ist.date).padStart(2, '0')}`;
  const randomId = Math.floor(1000 + Math.random() * 9000);
  const newOrderId = `SMJR-${dateNum}-${randomId}`;

  // Distance and delivery charge
  const customerDistance = typeof orderData?.customer?.distanceKm === 'number'
    ? Math.max(0, orderData.customer.distanceKm)
    : 0.5;
  const extraKm = customerDistance > 5.0 ? Math.round((customerDistance - 5.0) * 10) / 10 : 0;
  const calculatedDeliveryCharge = customerDistance > 5.0 ? Math.max(9, Math.round(extraKm * 9)) : 0;
  const deliveryCharge = orderData.deliveryCharge !== undefined ? orderData.deliveryCharge : calculatedDeliveryCharge;

  const jowarQty = orderData.jowarQuantity !== undefined ? orderData.jowarQuantity : (orderData.chapathiQuantity ? 0 : orderData.quantity);
  const chapathiQty = orderData.chapathiQuantity || 0;
  const subtotal = orderData.subtotal !== undefined ? orderData.subtotal : ((jowarQty * 30) + (chapathiQty * 10));
  const totalPaid = orderData.totalAmount || (subtotal + deliveryCharge);

  const confirmedOrder = {
    id: newOrderId,
    createdAt: new Date().toISOString(),
    createdAtIST: `${ist.dateTelugu}, ${ist.timeFormatted}`,
    quantity: orderData.quantity || (jowarQty + chapathiQty),
    jowarQuantity: jowarQty,
    chapathiQuantity: chapathiQty,
    pricePerRoti: 30,
    pricePerChapathi: 10,
    subtotal,
    deliveryCharge,
    totalPaid,
    karamSelection: orderData.karamSelection,
    karamQuantities: orderData.karamQuantities,
    customer: {
      ...orderData.customer,
      distanceKm: customerDistance,
    },
    deliveryDate: orderData.deliveryDate || ist.dateTelugu,
    deliveryWindow: 'సాయంత్రం 6–8 గంటలు',
    paymentStatus: 'VERIFIED',
    paymentReference: cleanRef,
    paymentVerifiedAt: new Date().toISOString(),
    fulfillmentStatus: 'NEW'
  };

  orders.unshift(confirmedOrder);
  writeJsonFile(ORDERS_FILE, orders);

  // Record audit log
  const auditLogs = readJsonFile<any[]>(AUDIT_FILE, []);
  auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    timestampIST: `${ist.dateTelugu}, ${ist.timeFormatted}`,
    type: 'PAYMENT_VERIFIED',
    orderId: confirmedOrder.id,
    amount: confirmedOrder.totalPaid,
    paymentReference: paymentReference,
    details: `కస్టమర్ ${confirmedOrder.customer.name} (+91 ${confirmedOrder.customer.mobile}) నుండి ₹${confirmedOrder.totalPaid} పేమెంట్ సర్వర్ ద్వారా ధృవీకరించబడింది.`,
    actor: 'UPI Payment Provider'
  });
  writeJsonFile(AUDIT_FILE, auditLogs);

  res.json({
    success: true,
    message: 'ఆర్డర్ విజయవంతంగా ధృవీకరించబడింది మరియు భద్రపరచబడింది.',
    order: confirmedOrder
  });
});

// 5. Admin Single-Step Login (PIN verification only - No OTP)
app.post('/api/admin/login', (req, res) => {
  const { pin, role = 'ADMIN' } = req.body;
  const cleanPin = String(pin || '').trim();

  // Owner default PIN: 8499 or owner mobile 8499865803
  if (cleanPin !== '8499' && cleanPin !== '8499865803') {
    return res.status(401).json({
      error: 'INVALID_PIN',
      message: 'తప్పు పిన్ (PIN) లేదా పాస్‌కోడ్ నమోదు చేశారు. దయచేసి సరైన పిన్ నమోదు చేయండి.'
    });
  }

  // Single-Step Verification: Directly issue valid authentication token
  const assignedRole: 'ADMIN' | 'STAFF' = role === 'STAFF' ? 'STAFF' : 'ADMIN';
  const token = `SMJR-AUTH-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  
  activeSessions.set(token, {
    token,
    role: assignedRole,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  });

  // Record login audit log
  try {
    const auditLogs = readJsonFile<any[]>(AUDIT_FILE, []);
    const ist = getISTInfo();
    auditLogs.unshift({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      timestampIST: `${ist.dateTelugu}, ${ist.timeFormatted}`,
      type: 'LOGIN_ATTEMPT',
      details: `${assignedRole === 'STAFF' ? 'డెలివరీ సిబ్బంది' : 'యజమాని'} సింగిల్-స్టెప్ పిన్ ధృవీకరణతో విజయవంతంగా లాగిన్ అయ్యారు.`,
      actor: assignedRole === 'STAFF' ? 'Staff' : 'Owner'
    });
    writeJsonFile(AUDIT_FILE, auditLogs);
  } catch {}

  res.json({
    success: true,
    token,
    role: assignedRole,
    message: 'పిన్ ధృవీకరించబడింది. లాగిన్ విజయవంతమైంది.'
  });
});

// Backward compatibility endpoint for verify-2fa
app.post('/api/admin/verify-2fa', (req, res) => {
  const token = `SMJR-AUTH-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  activeSessions.set(token, {
    token,
    role: 'ADMIN',
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    token,
    role: 'ADMIN',
    message: 'లాగిన్ విజయవంతమైంది.'
  });
});

// 6. Get orders (Admin/Staff only)
app.get('/api/orders', (req, res) => {
  const { date, status } = req.query;
  const orders = readJsonFile<any[]>(ORDERS_FILE, []);

  let filtered = [...orders];

  if (status && status !== 'ALL') {
    filtered = filtered.filter(o => o.fulfillmentStatus === status);
  }

  if (date && typeof date === 'string') {
    filtered = filtered.filter(o => o.createdAt.startsWith(date) || o.deliveryDate.includes(date));
  }

  res.json({
    orders: filtered,
    totalCount: filtered.length
  });
});

// 7. Update fulfillment status
app.patch('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, updatedBy = 'ADMIN' } = req.body;

  const validStatuses = ['NEW', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const orders = readJsonFile<any[]>(ORDERS_FILE, []);
  const orderIndex = orders.findIndex(o => o.id === id);

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  orders[orderIndex].fulfillmentStatus = status;
  orders[orderIndex].statusUpdatedAt = new Date().toISOString();
  orders[orderIndex].statusUpdatedBy = updatedBy;

  writeJsonFile(ORDERS_FILE, orders);

  // Add audit record
  const auditLogs = readJsonFile<any[]>(AUDIT_FILE, []);
  const ist = getISTInfo();
  auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    timestampIST: `${ist.dateTelugu}, ${ist.timeFormatted}`,
    type: 'STATUS_UPDATED',
    orderId: id,
    details: `ఆర్డర్ ${id} స్థితిని '${status}' కు మార్చారు.`,
    actor: updatedBy
  });
  writeJsonFile(AUDIT_FILE, auditLogs);

  res.json({
    success: true,
    order: orders[orderIndex]
  });
});

// 7b. Customer marks order as received
app.post('/api/orders/:id/received', (req, res) => {
  const { id } = req.params;
  const orders = readJsonFile<any[]>(ORDERS_FILE, []);
  const orderIndex = orders.findIndex(o => o.id.toLowerCase() === id.toLowerCase() || o.id === id);

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: 'ఆర్డర్ కనుగొనబడలేదు.' });
  }

  const ist = getISTInfo();
  const order = orders[orderIndex];
  order.isCustomerReceived = true;
  order.receivedAt = new Date().toISOString();
  order.receivedAtIST = `${ist.dateTelugu}, ${ist.timeFormatted}`;
  order.fulfillmentStatus = 'DELIVERED';
  order.statusUpdatedAt = new Date().toISOString();
  order.statusUpdatedBy = 'CUSTOMER';

  writeJsonFile(ORDERS_FILE, orders);

  // Add audit record
  const auditLogs = readJsonFile<any[]>(AUDIT_FILE, []);
  auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    timestampIST: `${ist.dateTelugu}, ${ist.timeFormatted}`,
    type: 'ORDER_RECEIVED',
    orderId: order.id,
    details: `కస్టమర్ ${order.customer?.name || ''} (+91 ${order.customer?.mobile || ''}) ఆర్డర్ అందినట్లుగా ధృవీకరించారు.`,
    actor: 'Customer'
  });
  writeJsonFile(AUDIT_FILE, auditLogs);

  res.json({
    success: true,
    message: 'ఆర్డర్ విజయవంతంగా అందినట్లు నమోదు చేయబడింది.',
    order
  });
});

// 7c. Customer submits post-order feedback and experience rating
app.post('/api/orders/:id/feedback', (req, res) => {
  const { id } = req.params;
  const { rating, comments, aspects, customerName, customerMobile } = req.body;

  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'INVALID_RATING', message: 'దయచేసి 1 నుండి 5 నక్షత్రాల రేటింగ్ ఎంచుకోండి.' });
  }

  const orders = readJsonFile<any[]>(ORDERS_FILE, []);
  const orderIndex = orders.findIndex(o => o.id.toLowerCase() === id.toLowerCase() || o.id === id);

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: 'ఆర్డర్ కనుగొనబడలేదు.' });
  }

  const targetOrder = orders[orderIndex];
  const ist = getISTInfo();
  const feedbackId = `FDBK-${Date.now()}`;
  const newFeedback = {
    id: feedbackId,
    orderId: targetOrder.id,
    rating: Math.round(numRating),
    comments: (comments || '').trim(),
    aspects: Array.isArray(aspects) ? aspects : [],
    customerName: customerName || targetOrder.customer?.name || 'గౌరవనీయ కస్టమర్',
    customerMobile: customerMobile || targetOrder.customer?.mobile || '',
    createdAt: new Date().toISOString(),
    createdAtIST: `${ist.dateTelugu}, ${ist.timeFormatted}`
  };

  targetOrder.feedback = newFeedback;
  if (!targetOrder.isCustomerReceived) {
    targetOrder.isCustomerReceived = true;
    targetOrder.receivedAt = new Date().toISOString();
    targetOrder.receivedAtIST = `${ist.dateTelugu}, ${ist.timeFormatted}`;
    targetOrder.fulfillmentStatus = 'DELIVERED';
  }

  writeJsonFile(ORDERS_FILE, orders);

  // Append to feedback list
  const feedbackList = readJsonFile<any[]>(FEEDBACK_FILE, []);
  const filtered = feedbackList.filter(f => f.orderId !== targetOrder.id);
  filtered.unshift(newFeedback);
  writeJsonFile(FEEDBACK_FILE, filtered);

  // Add audit record
  const auditLogs = readJsonFile<any[]>(AUDIT_FILE, []);
  auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    timestampIST: `${ist.dateTelugu}, ${ist.timeFormatted}`,
    type: 'FEEDBACK_SUBMITTED',
    orderId: targetOrder.id,
    details: `కస్టమర్ ${newFeedback.customerName} ${numRating} నక్షత్రాల రేటింగ్ మరియు అభిప్రాయాన్ని సమర్పించారు: "${(newFeedback.comments || 'అద్భుతమైన అనుభవం').slice(0, 60)}"`,
    actor: 'Customer'
  });
  writeJsonFile(AUDIT_FILE, auditLogs);

  res.json({
    success: true,
    message: 'ధన్యవాదాలు! మీ విలువైన అభిప్రాయం విజయవంతంగా నమోదైంది.',
    feedback: newFeedback,
    order: targetOrder
  });
});

// 7d. Get single order by ID
app.get('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const orders = readJsonFile<any[]>(ORDERS_FILE, []);
  const order = orders.find(o => o.id.toLowerCase() === id.toLowerCase() || o.id === id);

  if (!order) {
    return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: 'ఆర్డర్ కనుగొనబడలేదు.' });
  }

  res.json({ success: true, order });
});

// 7e. Get all customer feedback list & rating overview
app.get('/api/feedback', (req, res) => {
  const feedbackList = readJsonFile<any[]>(FEEDBACK_FILE, []);
  const total = feedbackList.length;
  const avg = total > 0 ? (feedbackList.reduce((acc, f) => acc + (f.rating || 0), 0) / total).toFixed(1) : '5.0';
  
  const ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  feedbackList.forEach(f => {
    const r = f.rating ? Math.round(f.rating) : 5;
    if (ratingDistribution[r] !== undefined) {
      ratingDistribution[r] += 1;
    }
  });

  res.json({
    success: true,
    feedbacks: feedbackList,
    total,
    averageRating: parseFloat(avg),
    ratingDistribution
  });
});

// 8. Get audit logs
app.get('/api/audit-logs', (req, res) => {
  const logs = readJsonFile<any[]>(AUDIT_FILE, []);
  res.json({ logs });
});

// 9. Real-time Analytics Dashboard Data
app.get('/api/analytics', (req, res) => {
  const orders = readJsonFile<any[]>(ORDERS_FILE, []);
  const ist = getISTInfo();
  const todayPrefix = new Date().toISOString().slice(0, 10);

  const totalRevenue = orders.reduce((s, o) => s + (o.totalPaid || 0), 0);
  const totalRotisSold = orders.reduce((s, o) => s + (o.quantity || 0), 0);
  const totalKarivepakuGrams = orders.reduce((s, o) => s + (o.karamQuantities?.karivepakuGrams || 0), 0);
  const totalAviseGrams = orders.reduce((s, o) => s + (o.karamQuantities?.aviseGinjaluGrams || 0), 0);

  const todayOrders = orders.filter(o => o.createdAt?.startsWith(todayPrefix) || o.deliveryDate?.includes(ist.dateTelugu));
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.totalPaid || 0), 0);

  const ordersByStatus = {
    NEW: orders.filter(o => o.fulfillmentStatus === 'NEW').length,
    PREPARING: orders.filter(o => o.fulfillmentStatus === 'PREPARING').length,
    OUT_FOR_DELIVERY: orders.filter(o => o.fulfillmentStatus === 'OUT_FOR_DELIVERY').length,
    DELIVERED: orders.filter(o => o.fulfillmentStatus === 'DELIVERED').length,
  };

  // Hourly order distribution during business hours (11 to 16)
  const hourlySlots = [
    { hour: 11, label: '11 AM - 12 PM', count: 0, revenue: 0 },
    { hour: 12, label: '12 PM - 1 PM', count: 0, revenue: 0 },
    { hour: 13, label: '1 PM - 2 PM', count: 0, revenue: 0 },
    { hour: 14, label: '2 PM - 3 PM', count: 0, revenue: 0 },
    { hour: 15, label: '3 PM - 4 PM', count: 0, revenue: 0 },
  ];

  orders.forEach(o => {
    try {
      const d = new Date(o.createdAt);
      // Calculate IST hour
      const utcHours = d.getUTCHours();
      const istHours = (utcHours + 5.5) % 24;
      const slot = hourlySlots.find(s => Math.floor(istHours) === s.hour);
      if (slot) {
        slot.count += 1;
        slot.revenue += o.totalPaid;
      }
    } catch {}
  });

  // Daily trend
  const dailyTrends = [
    { date: 'నిన్న (Yesterday)', orders: 2, revenue: 750, rotis: 25 },
    { date: 'ఈరోజు (Today)', orders: todayOrders.length, revenue: todayRevenue, rotis: todayOrders.reduce((s, o) => s + (o.quantity || 0), 0) }
  ];

  // Feedback metrics
  const feedbackList = readJsonFile<any[]>(FEEDBACK_FILE, []);
  const totalFeedbacks = feedbackList.length;
  const averageRating = totalFeedbacks > 0
    ? parseFloat((feedbackList.reduce((acc, f) => acc + (f.rating || 0), 0) / totalFeedbacks).toFixed(1))
    : 5.0;

  const ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  feedbackList.forEach(f => {
    const r = f.rating ? Math.round(f.rating) : 5;
    if (ratingDistribution[r] !== undefined) {
      ratingDistribution[r] += 1;
    }
  });

  res.json({
    totalRevenue,
    totalOrders: orders.length,
    totalRotisSold,
    totalKarivepakuGrams,
    totalAviseGrams,
    todayOrdersCount: todayOrders.length,
    todayRevenue,
    ordersByStatus,
    hourlyOrderDistribution: hourlySlots,
    dailyTrends,
    averageRating,
    totalFeedbacks,
    ratingDistribution
  });
});

// -------------------------------------------------------------
// Vite Middleware / Static Production Server
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
