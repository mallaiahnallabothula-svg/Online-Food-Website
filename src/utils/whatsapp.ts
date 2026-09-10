/**
 * WhatsApp Order Ticket Generator
 * Follows exact specified template and omissions for empty optional fields.
 */
import { Order } from '../types';

export const OWNER_PHONE = '8499865803';
export const OWNER_PHONE_DISPLAY = '+91 8499865803';

export function buildWhatsAppTicket(order: Order): string {
  // Free karams string formatting
  const karamLines: string[] = [];
  if (order.karamSelection.karivepaku && order.karamQuantities.karivepakuGrams > 0) {
    karamLines.push(`• కరివేపాకు కారం: ${order.karamQuantities.karivepakuGrams} గ్రా.`);
  }
  if (order.karamSelection.aviseGinjalu && order.karamQuantities.aviseGinjaluGrams > 0) {
    karamLines.push(`• అవిసె గింజల కారం: ${order.karamQuantities.aviseGinjaluGrams} గ్రా.`);
  }

  const freeKaramSection = karamLines.length > 0
    ? karamLines.join('\n')
    : 'ఏమీ ఎంచుకోలేదు';

  // Build the message blocks
  const parts: string[] = [
    '🧾 *శ్రీ మల్లికార్జున జొన్న రొట్టెలు*',
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
    '✅ *చెల్లింపు:* UPI — పూర్తయింది',
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
export function getWhatsAppUrl(order: Order): string {
  const ticket = buildWhatsAppTicket(order);
  const encodedText = encodeURIComponent(ticket);
  return `https://wa.me/91${OWNER_PHONE}?text=${encodedText}`;
}
