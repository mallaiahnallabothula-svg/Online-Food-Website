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
    ? (lang === 'en' ? '💵 Pay on Delivery (Cash / UPI at doorstep)' : '💵 డెలివరీ వద్ద చెల్లింపు (Pay on Delivery)')
    : (lang === 'en' ? '✅ Online UPI — Payment Verified' : '✅ ఆన్‌లైన్ UPI — చెల్లింపు పూర్తయింది');

  // Compute location map URL
  let mapUrl = '';
  if (order.customer.locationLink && order.customer.locationLink.trim().length > 0) {
    mapUrl = order.customer.locationLink.trim();
  } else if (order.customer.latitude && order.customer.longitude) {
    mapUrl = `https://maps.google.com/?q=${order.customer.latitude},${order.customer.longitude}`;
  } else if (order.customer.address && order.customer.address.trim().length > 0) {
    mapUrl = `https://maps.google.com/?q=${encodeURIComponent(order.customer.address.trim() + ', Kollur')}`;
  }

  if (lang === 'en') {
    const parts: string[] = [
      '🧾 *MANA ENTI VANTA (మన ఇంటి వంట)*',
      'Authentic Village Jowar Rotis • Kolluru Village',
      'WhatsApp Order Ticket to: +91 8499865803',
      '================================',
      `🎫 *Order ID:* ${order.id}`,
      `📅 *Order Time:* ${order.createdAtIST}`,
      '',
      '*CUSTOMER & DELIVERY DETAILS:*',
      `👤 *Name:* ${order.customer.name}`,
      `📞 *Mobile Number:* +91 ${order.customer.mobile}`,
      `📍 *Full Address:* ${order.customer.address}`,
    ];

    if (order.customer.landmark && order.customer.landmark.trim().length > 0) {
      parts.push(`🏠 *Landmark:* ${order.customer.landmark.trim()}`);
    }

    if (mapUrl) {
      parts.push(`🗺️ *Location (Google Maps):* ${mapUrl}`);
    }

    if (typeof order.customer.distanceKm === 'number' && order.customer.distanceKm > 0) {
      parts.push(`📏 *Distance:* ${order.customer.distanceKm} km from Kollur`);
    }

    parts.push(
      '',
      '*ORDER ITEMS & BILLING:*',
      `🫓 *Jowar Rotis Quantity:* ${order.quantity} rotis`,
      `💵 *Price per Roti:* ₹${order.pricePerRoti}`,
      '🎁 *Complimentary Karams (Free):*',
      freeKaramSection,
      '',
      `💰 *Total Amount:* ₹${order.totalPaid}`,
      `💳 *Payment Status:* ${paymentStatusLine}`,
      `🔖 *Payment Ref / UTR:* ${order.paymentReference}`,
      '',
      `🚚 *Delivery Date:* ${order.deliveryDate}`,
      `🕕 *Delivery Window:* ${order.deliveryWindow}`,
      '================================',
      '✅ Please prepare fresh rotis and dispatch for delivery on time.'
    );

    return parts.join('\n');
  }

  // Telugu ticket
  const parts: string[] = [
    '🧾 *మన ఇంటి వంట (Mana Enti Vanta)*',
    'అచ్చమైన పల్లెటూరి జొన్న రొట్టెలు • కొల్లూరు గ్రామం',
    'వాట్సాప్ ఆర్డర్ టికెట్: +91 8499865803',
    '================================',
    `🎫 *ఆర్డర్ ID (Order ID):* ${order.id}`,
    `📅 *ఆర్డర్ సమయం:* ${order.createdAtIST}`,
    '',
    '*కస్టమర్ & డెలివరీ వివరాలు:*',
    `👤 *కస్టమర్ పేరు (Name):* ${order.customer.name}`,
    `📞 *మొబైల్ నంబర్ (Number):* +91 ${order.customer.mobile}`,
    `📍 *పూర్తి చిరునామా (Address):* ${order.customer.address}`,
  ];

  if (order.customer.landmark && order.customer.landmark.trim().length > 0) {
    parts.push(`🏠 *ల్యాండ్‌మార్క్ (Landmark):* ${order.customer.landmark.trim()}`);
  }

  if (mapUrl) {
    parts.push(`🗺️ *గూగుల్ మ్యాప్స్ లొకేషన్ (Location Link):* ${mapUrl}`);
  }

  if (typeof order.customer.distanceKm === 'number' && order.customer.distanceKm > 0) {
    parts.push(`📏 *కొల్లూరు నుండి దూరం:* ${order.customer.distanceKm} కి.మీ.`);
  }

  parts.push(
    '',
    '*ఆర్డర్ వస్తువులు & బిల్లు వివరాలు:*',
    `🫓 *జొన్న రొట్టెల సంఖ్య:* ${order.quantity} రొట్టెలు (₹${order.pricePerRoti} చొప్పున)`,
    '🎁 *ఉచిత కారాలు (Free Karams):*',
    freeKaramSection,
    '',
    `💰 *మొత్తం బిల్లు (Total Amount):* ₹${order.totalPaid}`,
    `💳 *చెల్లింపు విధానం (Payment):* ${paymentStatusLine}`,
    `🔖 *పేమెంట్ రిఫరెన్స్ / UTR:* ${order.paymentReference}`,
    '',
    `🚚 *డెలివరీ తేదీ:* ${order.deliveryDate}`,
    `🕕 *డెలివరీ సమయం:* ${order.deliveryWindow}`,
    '================================',
    '✅ దయచేసి ఈ ఆర్డర్ కోసం వేడివేడి రొట్టెలను తయారుచేసి సమయానికి డెలివరీ చేయగలరు.'
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
