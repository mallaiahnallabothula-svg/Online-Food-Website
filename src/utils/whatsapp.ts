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
        ? `• Curry Leaf Podi: ${order.karamQuantities.karivepakuGrams}g`
        : `• కరివేపాకు కారం: ${order.karamQuantities.karivepakuGrams} గ్రా.`
    );
  }
  if (order.karamSelection.aviseGinjalu && order.karamQuantities.aviseGinjaluGrams > 0) {
    karamLines.push(
      lang === 'en'
        ? `• Flax Seeds Podi: ${order.karamQuantities.aviseGinjaluGrams}g`
        : `• అవిసె గింజల కారం: ${order.karamQuantities.aviseGinjaluGrams} గ్రా.`
    );
  }

  const freeKaramSection = karamLines.length > 0
    ? karamLines.join('\n')
    : (lang === 'en' ? 'None selected' : 'ఏమీ ఎంచుకోలేదు');

  const paymentStatusLine = order.paymentStatus === 'PAY_ON_DELIVERY'
    ? (lang === 'en' ? '💵 *Payment:* Pay on Delivery (Cash / UPI)' : '💵 *చెల్లింపు:* డెలివరీ వద్ద చెల్లింపు (Cash / UPI)')
    : (lang === 'en' ? '✅ *Payment:* Online UPI — Completed' : '✅ *చెల్లింపు:* ఆన్‌లైన్ UPI — పూర్తయింది');

  if (lang === 'en') {
    const parts: string[] = [
      '🧾 *Mana Enti Vanta (మన ఇంటి వంట)*',
      'Authentic Village Jowar Rotis • Kolluru',
      '*Order Details*',
      '',
      `🎫 *Order ID:* ${order.id}`,
      `📅 *Order Time:* ${order.createdAtIST}`,
      '',
      `👤 *Customer Name:* ${order.customer.name}`,
      `📞 *Mobile:* +91 ${order.customer.mobile}`,
      '',
      `🫓 *Jowar Rotis:* ${order.quantity}`,
      `💵 *Price per Roti:* ₹${order.pricePerRoti}`,
      '',
      '🎁 *Free Karams:*',
      freeKaramSection,
      '',
      `💰 *Total Amount:* ₹${order.totalPaid}`,
      paymentStatusLine,
      `🔖 *Payment Ref:* ${order.paymentReference}`,
      '',
      `🚚 *Delivery Date:* ${order.deliveryDate}`,
      `🕕 *Delivery Window:* ${order.deliveryWindow}`,
      `📍 *Address:* ${order.customer.address}`,
    ];

    if (order.customer.landmark && order.customer.landmark.trim().length > 0) {
      parts.push(`🏠 *Landmark:* ${order.customer.landmark.trim()}`);
    }

    if (order.customer.locationLink && order.customer.locationLink.trim().length > 0) {
      parts.push(`🗺️ *Location:* ${order.customer.locationLink.trim()}`);
    }

    return parts.join('\n');
  }

  // Build Telugu message blocks
  const parts: string[] = [
    '🧾 *మన ఇంటి వంట (Mana Enti Vanta)*',
    'అచ్చమైన పల్లెటూరి జొన్న రొట్టెలు • కొల్లూరు',
    '*ఆర్డర్ వివరాలు*',
    '',
    `🎫 *ఆర్డర్ నంబర్:* ${order.id}`,
    `📅 *ఆర్డర్ తేదీ:* ${order.createdAtIST}`,
    '',
    `👤 *కస్టమర్ పేరు:* ${order.customer.name}`,
    `📞 *మొబైల్:* +91 ${order.customer.mobile}`,
    '',
    `🫓 *జొన్న రొట్టెలు:* ${order.quantity}`,
    `💵 *ఒక్కొక్కటి:* ₹${order.pricePerRoti}`,
    '',
    '🎁 *ఉచిత కారాలు:*',
    freeKaramSection,
    '',
    `💰 *చెల్లించిన మొత్తం:* ₹${order.totalPaid}`,
    paymentStatusLine,
    `🔖 *పేమెంట్ రిఫరెన్స్:* ${order.paymentReference}`,
    '',
    `🚚 *డెలివరీ తేదీ:* ${order.deliveryDate}`,
    `🕕 *డెలివరీ సమయం:* ${order.deliveryWindow}`,
    `📍 *చిరునామా:* ${order.customer.address}`,
  ];

  // Omit empty optional fields
  if (order.customer.landmark && order.customer.landmark.trim().length > 0) {
    parts.push(`🏠 *ల్యాండ్మార్క్:* ${order.customer.landmark.trim()}`);
  }

  if (order.customer.locationLink && order.customer.locationLink.trim().length > 0) {
    parts.push(`🗺️ *లొకేషన్:* ${order.customer.locationLink.trim()}`);
  }

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
