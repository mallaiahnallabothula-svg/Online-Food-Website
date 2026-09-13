/**
 * WhatsApp Order Ticket Generator
 * Follows exact specified template and omissions for empty optional fields.
 */
import { Order } from '../types';

export const OWNER_PHONE = '8499865803';
export const OWNER_PHONE_DISPLAY = '+91 8499865803';

export function buildWhatsAppTicket(order: Order, lang: 'te' | 'en' = 'te'): string {
  // Free karams string formatting
  const karamLines: string[] = [];
  if (order.karamSelection.karivepaku && order.karamQuantities.karivepakuGrams > 0) {
    karamLines.push(
      lang === 'en'
        ? `• Curry Leaf Podi (కరివేపాకు కారం): ${order.karamQuantities.karivepakuGrams}g`
        : `• కరివేపాకు కారం: ${order.karamQuantities.karivepakuGrams} గ్రా.`
    );
  }
  if (order.karamSelection.aviseGinjalu && order.karamQuantities.aviseGinjaluGrams > 0) {
    karamLines.push(
      lang === 'en'
        ? `• Flax Seeds Podi (అవిసె గింజల కారం): ${order.karamQuantities.aviseGinjaluGrams}g`
        : `• అవిసె గింజల కారం: ${order.karamQuantities.aviseGinjaluGrams} గ్రా.`
    );
  }

  const freeKaramSection = karamLines.length > 0
    ? karamLines.join('\n')
    : (lang === 'en' ? 'None selected' : 'ఏమీ ఎంచుకోలేదు');

  const paymentStatusLine = order.paymentStatus === 'PAY_ON_DELIVERY'
    ? (lang === 'en' ? '💵 Pay on Delivery' : '💵 డెలివరీ వద్ద చెల్లింపు')
    : (lang === 'en' ? '✅ Online UPI — Verified Payment (No COD)' : '✅ ఆన్‌లైన్ UPI — చెల్లింపు పూర్తయింది (క్యాష్ ఆన్ డెలివరీ లేదు)');

  // Delivery charge line
  const deliveryChargeLineEn = typeof order.deliveryCharge === 'number' && order.deliveryCharge > 0
    ? `🚚 *Delivery Charge:* ₹${order.deliveryCharge} (Above 5 km @ ₹9/km)`
    : '🚚 *Delivery:* Free (Within 5 km radius)';
  const deliveryChargeLineTe = typeof order.deliveryCharge === 'number' && order.deliveryCharge > 0
    ? `🚚 *డెలివరీ ఛార్జీ:* ₹${order.deliveryCharge} (5 కి.మీ. పైబడిన దూరానికి ₹9/కి.మీ.)`
    : '🚚 *డెలివరీ:* ఉచితం (5 కి.మీ. పరిధి లోపల)';

  // Compute location map URL
  let mapUrl = '';
  if (order.customer.locationLink && order.customer.locationLink.trim().length > 0) {
    mapUrl = order.customer.locationLink.trim();
  } else if (order.customer.latitude && order.customer.longitude) {
    mapUrl = `https://maps.google.com/?q=${order.customer.latitude},${order.customer.longitude}`;
  } else if (order.customer.address && order.customer.address.trim().length > 0) {
    mapUrl = `https://maps.google.com/?q=${encodeURIComponent(order.customer.address.trim() + ', Kollur')}`;
  }

  // Items breakdown
  const itemsLinesTe: string[] = [];
  const itemsLinesEn: string[] = [];

  const jowarQty = typeof order.jowarQuantity === 'number' ? order.jowarQuantity : (order.chapathiQuantity ? 0 : order.quantity);
  const chapathiQty = typeof order.chapathiQuantity === 'number' ? order.chapathiQuantity : 0;
  const rotiPrice = order.pricePerRoti || 30;
  const chapathiPrice = order.pricePerChapathi || 10;

  if (jowarQty > 0) {
    itemsLinesTe.push(`🫓 *జొన్న రొట్టెలు (Jowar Rotis):* ${jowarQty} రొట్టెలు (₹${rotiPrice} చొప్పున = ₹${jowarQty * rotiPrice})`);
    itemsLinesEn.push(`🫓 *Jowar Rotis:* ${jowarQty} rotis (₹${rotiPrice} each = ₹${jowarQty * rotiPrice})`);
  }
  if (chapathiQty > 0) {
    itemsLinesTe.push(`🥞 *వేడివేడి చపాతీలు (Fresh Chapathis):* ${chapathiQty} చపాతీలు (₹${chapathiPrice} చొప్పున = ₹${chapathiQty * chapathiPrice})`);
    itemsLinesEn.push(`🥞 *Fresh Chapathis:* ${chapathiQty} chapathis (₹${chapathiPrice} each = ₹${chapathiQty * chapathiPrice})`);
  }
  if (itemsLinesTe.length === 0) {
    itemsLinesTe.push(`🫓 *జొన్న రొట్టెలు:* ${order.quantity} రొట్టెలు (₹${rotiPrice} చొప్పున)`);
    itemsLinesEn.push(`🫓 *Jowar Rotis:* ${order.quantity} rotis (₹${rotiPrice} each)`);
  }

  if (lang === 'en') {
    const parts: string[] = [
      '🧾 *MANA ENTI VANTA (మన ఇంటి వంట)*',
      'Authentic Village Jowar Rotis & Chapathis • Kolluru Village',
      'WhatsApp Order Ticket to: +91 8499865803',
      '================================',
      `🎫 *Order ID:* ${order.id}`,
      `📅 *Order Placed Time:* ${order.createdAtIST}`,
      '',
      '*CUSTOMER & DELIVERY DETAILS:*',
      `👤 *Customer Name:* ${order.customer.name}`,
      `📞 *Mobile Number:* +91 ${order.customer.mobile}`,
      `📍 *Customer Address:* ${order.customer.address}`,
    ];

    if (order.customer.landmark && order.customer.landmark.trim().length > 0) {
      parts.push(`🏠 *Landmark:* ${order.customer.landmark.trim()}`);
    }

    if (mapUrl) {
      parts.push(`🗺️ *Current Location / Maps Link:* ${mapUrl}`);
    }

    if (typeof order.customer.distanceKm === 'number' && order.customer.distanceKm > 0) {
      parts.push(`📏 *Distance from Kollur Center:* ${order.customer.distanceKm} km`);
    }

    parts.push(
      '',
      '*ORDER ITEMS & QUANTITY:*',
      ...itemsLinesEn,
      '',
      '🎁 *Free Items (Complimentary Karams):*',
      freeKaramSection,
      '',
      `💰 *Total Amount:* ₹${order.totalPaid}`,
      deliveryChargeLineEn,
      `💳 *Payment Method:* ${paymentStatusLine}`,
      `🔖 *Payment Ref / UTR:* ${order.paymentReference}`,
      '',
      `🚚 *Delivery Date:* ${order.deliveryDate}`,
      `🕕 *Delivery Time:* ${order.deliveryWindow}`,
      '================================',
      '✅ Please prepare fresh rotis & chapathis and dispatch on time.'
    );

    return parts.join('\n');
  }

  // Telugu ticket
  const parts: string[] = [
    '🧾 *మన ఇంటి వంట (Mana Enti Vanta)*',
    'అచ్చమైన పల్లెటూరి జొన్న రొట్టెలు & చపాతీలు • కొల్లూరు గ్రామం',
    'యజమానికి వాట్సాప్ ఆర్డర్ టికెట్: +91 8499865803',
    '================================',
    `🎫 *ఆర్డర్ ID (Order ID):* ${order.id}`,
    `📅 *ఆర్డర్ చేసిన సమయం:* ${order.createdAtIST}`,
    '',
    '*కస్టమర్ & డెలివరీ వివరాలు:*',
    `👤 *కస్టమర్ పేరు (Customer Name):* ${order.customer.name}`,
    `📞 *మొబైల్ నంబర్ (Mobile Number):* +91 ${order.customer.mobile}`,
    `📍 *కస్టమర్ చిరునామా (Delivery Address):* ${order.customer.address}`,
  ];

  if (order.customer.landmark && order.customer.landmark.trim().length > 0) {
    parts.push(`🏠 *ల్యాండ్‌మార్క్ (Landmark):* ${order.customer.landmark.trim()}`);
  }

  if (mapUrl) {
    parts.push(`🗺️ *లైవ్ లొకేషన్ / గూగుల్ మ్యాప్స్ లింక్ (Maps Link):* ${mapUrl}`);
  }

  if (typeof order.customer.distanceKm === 'number' && order.customer.distanceKm > 0) {
    parts.push(`📏 *కొల్లూరు సెంటర్ నుండి దూరం:* ${order.customer.distanceKm} కి.మీ.`);
  }

  parts.push(
    '',
    '*ఆర్డర్ వస్తువులు & సంఖ్య (Items & Quantity):*',
    ...itemsLinesTe,
    '',
    '🎁 *ఉచిత వస్తువులు (Free Karams):*',
    freeKaramSection,
    '',
    `💰 *మొత్తం బిల్లు (Total Amount):* ₹${order.totalPaid}`,
    deliveryChargeLineTe,
    `💳 *చెల్లింపు విధానం (Payment Method):* ${paymentStatusLine}`,
    `🔖 *పేమెంట్ రిఫరెన్స్ / UTR:* ${order.paymentReference}`,
    '',
    `🚚 *డెలివరీ తేదీ (Delivery Date):* ${order.deliveryDate}`,
    `🕕 *డెలివరీ సమయం (Delivery Time):* ${order.deliveryWindow}`,
    '================================',
    '✅ దయచేసి ఈ ఆర్డర్ కోసం తాజా వేడివేడి రొట్టెలు, చపాతీలను తయారుచేసి సమయానికి డెలివరీ చేయగలరు.'
  );

  return parts.join('\n');
}

/**
 * Generate full WhatsApp web / mobile click link to open chat with owner
 */
export function getWhatsAppUrl(order: Order, lang: 'te' | 'en' = 'te'): string {
  const ticket = buildWhatsAppTicket(order, lang);
  const encodedText = encodeURIComponent(ticket);
  return `https://wa.me/91${OWNER_PHONE}?text=${encodedText}`;
}
