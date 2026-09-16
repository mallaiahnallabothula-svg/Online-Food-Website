/**
 * Server-Side Ticket Generation Service
 * Generates official Mana Enti Vanta WhatsApp Order Ticket
 * Authoritative generation triggers immediately upon payment confirmation.
 */

export const OWNER_PHONE = '8499865803';
export const OWNER_PHONE_DISPLAY = '+91 8499865803';

export interface OrderForTicket {
  id: string;
  createdAtIst?: string;
  deliveryDate: string;
  deliveryWindow: string;
  jowarQuantity: number;
  chapathiQuantity: number;
  jowarUnitPrice: number;
  chapathiUnitPrice: number;
  subtotal: number;
  deliveryCharge: number;
  totalAmount: number;
  karivepakuGrams: number;
  aviseGrams: number;
  customerName: string;
  customerMobile: string;
  address: string;
  landmark?: string;
  distanceKm: number;
  locationLink?: string;
  latitude?: number;
  longitude?: number;
  providerPaymentId: string;
  paymentProvider?: string;
}

export function generateServerOrderTicket(order: OrderForTicket, lang: 'te' | 'en' = 'te'): string {
  const karamLines: string[] = [];

  if (order.karivepakuGrams > 0) {
    karamLines.push(
      lang === 'en'
        ? `• Curry Leaf Podi (కరివేపాకు కారం): ${order.karivepakuGrams}g`
        : `• కరివేపాకు కారం: ${order.karivepakuGrams} గ్రా.`
    );
  }
  if (order.aviseGrams > 0) {
    karamLines.push(
      lang === 'en'
        ? `• Flax Seeds Podi (అవిసె గింజల కారం): ${order.aviseGrams}g`
        : `• అవిసె గింజల కారం: ${order.aviseGrams} గ్రా.`
    );
  }

  const freeKaramSection = karamLines.length > 0
    ? karamLines.join('\n')
    : (lang === 'en' ? 'None' : 'ఏమీ ఎంచుకోలేదు');

  const paymentStatusLine = (lang === 'en'
    ? '✅ Online UPI — Verified Payment (No COD)'
    : '✅ ఆన్‌లైన్ UPI — చెల్లింపు పూర్తయింది (క్యాష్ ఆన్ డెలివరీ లేదు)');

  const deliveryChargeLineEn = order.deliveryCharge > 0
    ? `🚚 *Delivery Charge:* ₹${order.deliveryCharge} (Above 5 km @ ₹9/km)`
    : '🚚 *Delivery:* Free (Within 5 km radius)';
  const deliveryChargeLineTe = order.deliveryCharge > 0
    ? `🚚 *డెలివరీ ఛార్జీ:* ₹${order.deliveryCharge} (5 కి.మీ. పైబడిన దూరానికి ₹9/కి.మీ.)`
    : '🚚 *డెలివరీ:* ఉచితం (5 కి.మీ. పరిధి లోపల)';

  let mapUrl = '';
  if (order.locationLink && order.locationLink.trim().length > 0) {
    mapUrl = order.locationLink.trim();
  } else if (order.latitude && order.longitude) {
    mapUrl = `https://maps.google.com/?q=${order.latitude},${order.longitude}`;
  } else if (order.address && order.address.trim().length > 0) {
    mapUrl = `https://maps.google.com/?q=${encodeURIComponent(order.address.trim() + ', Kollur')}`;
  }

  const itemsLinesTe: string[] = [];
  const itemsLinesEn: string[] = [];

  if (order.jowarQuantity > 0) {
    const jowarTotal = order.jowarQuantity * order.jowarUnitPrice;
    itemsLinesTe.push(`🫓 *జొన్న రొట్టెలు (Jowar Rotis):* ${order.jowarQuantity} రొట్టెలు (₹${order.jowarUnitPrice} చొప్పున = ₹${jowarTotal})`);
    itemsLinesEn.push(`🫓 *Jowar Rotis:* ${order.jowarQuantity} rotis (₹${order.jowarUnitPrice} each = ₹${jowarTotal})`);
  }
  if (order.chapathiQuantity > 0) {
    const chapTotal = order.chapathiQuantity * order.chapathiUnitPrice;
    itemsLinesTe.push(`🥞 *వేడివేడి చపాతీలు (Fresh Chapathis):* ${order.chapathiQuantity} చపాతీలు (₹${order.chapathiUnitPrice} చొప్పున = ₹${chapTotal})`);
    itemsLinesEn.push(`🥞 *Fresh Chapathis:* ${order.chapathiQuantity} chapathis (₹${order.chapathiUnitPrice} each = ₹${chapTotal})`);
  }

  if (lang === 'en') {
    const parts: string[] = [
      '🧾 *MANA ENTI VANTA (మన ఇంటి వంట)*',
      'Authentic Village Jowar Rotis & Chapathis • Kolluru Village',
      'WhatsApp Order Ticket to: +91 8499865803',
      '================================',
      `🎫 *Order ID:* ${order.id}`,
      `📅 *Order Placed Time:* ${order.createdAtIst || ''}`,
      '',
      '*CUSTOMER & DELIVERY DETAILS:*',
      `👤 *Customer Name:* ${order.customerName}`,
      `📞 *Mobile Number:* +91 ${order.customerMobile}`,
      `📍 *Customer Address:* ${order.address}`,
    ];

    if (order.landmark && order.landmark.trim().length > 0) {
      parts.push(`🏠 *Landmark:* ${order.landmark.trim()}`);
    }
    if (mapUrl) {
      parts.push(`🗺️ *Current Location / Maps Link:* ${mapUrl}`);
    }
    if (order.distanceKm > 0) {
      parts.push(`📏 *Distance from Kollur Center:* ${order.distanceKm} km`);
    }

    parts.push(
      '',
      '*ORDER ITEMS & QUANTITY:*',
      ...itemsLinesEn,
      '',
      '🎁 *Free Items (Complimentary Karams):*',
      freeKaramSection,
      '',
      `💰 *Total Amount:* ₹${order.totalAmount}`,
      deliveryChargeLineEn,
      `💳 *Payment Method:* ${paymentStatusLine}`,
      `🔖 *Payment Ref / UTR:* ${order.providerPaymentId}`,
      '',
      `🚚 *Delivery Date:* ${order.deliveryDate}`,
      `🕕 *Delivery Time:* ${order.deliveryWindow || '6:00 PM - 8:00 PM'}`,
      '================================',
      '✅ Please prepare fresh rotis & chapathis and dispatch on time.'
    );

    return parts.join('\n');
  }

  // Telugu format
  const parts: string[] = [
    '🧾 *మన ఇంటి వంట (Mana Enti Vanta)*',
    'అచ్చమైన పల్లెటూరి జొన్న రొట్టెలు & చపాతీలు • కొల్లూరు గ్రామం',
    'యజమానికి వాట్సాప్ ఆర్డర్ టికెట్: +91 8499865803',
    '================================',
    `🎫 *ఆర్డర్ ID (Order ID):* ${order.id}`,
    `📅 *ఆర్డర్ చేసిన సమయం:* ${order.createdAtIst || ''}`,
    '',
    '*కస్టమర్ & డెలివరీ వివరాలు:*',
    `👤 *కస్టమర్ పేరు (Customer Name):* ${order.customerName}`,
    `📞 *మొబైల్ నంబర్ (Mobile Number):* +91 ${order.customerMobile}`,
    `📍 *కస్టమర్ చిరునామా (Delivery Address):* ${order.address}`,
  ];

  if (order.landmark && order.landmark.trim().length > 0) {
    parts.push(`🏠 *ల్యాండ్‌మార్క్ (Landmark):* ${order.landmark.trim()}`);
  }
  if (mapUrl) {
    parts.push(`🗺️ *లైవ్ లొకేషన్ / గూగుల్ మ్యాప్స్ లింక్ (Maps Link):* ${mapUrl}`);
  }
  if (order.distanceKm > 0) {
    parts.push(`📏 *కొల్లూరు సెంటర్ నుండి దూరం:* ${order.distanceKm} కి.మీ.`);
  }

  parts.push(
    '',
    '*ఆర్డర్ వస్తువులు & సంఖ్య (Items & Quantity):*',
    ...itemsLinesTe,
    '',
    '🎁 *ఉచిత వస్తువులు (Free Karams):*',
    freeKaramSection,
    '',
    `💰 *మొత్తం బిల్లు (Total Amount):* ₹${order.totalAmount}`,
    deliveryChargeLineTe,
    `💳 *చెల్లింపు విధానం (Payment Method):* ${paymentStatusLine}`,
    `🔖 *పేమెంట్ రిఫరెన్స్ / UTR:* ${order.providerPaymentId}`,
    '',
    `🚚 *డెలివరీ తేదీ (Delivery Date):* ${order.deliveryDate}`,
    `🕕 *డెలివరీ సమయం (Delivery Time):* ${order.deliveryWindow || '6:00 PM - 8:00 PM'}`,
    '================================',
    '✅ దయచేసి ఈ ఆర్డర్ కోసం తాజా వేడివేడి రొట్టెలు, చపాతీలను తయారుచేసి సమయానికి డెలివరీ చేయగలరు.'
  );

  return parts.join('\n');
}
