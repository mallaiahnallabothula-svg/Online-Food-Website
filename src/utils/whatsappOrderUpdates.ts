import type { Order } from '../types';

/** Generates a WhatsApp draft; never sends or changes order/payment status. */
export interface WhatsAppOrderUpdate {
  readonly label: string;
  readonly message: string;
  readonly url: string;
}

const statusLabels = {
  RECEIVED: { en: 'Order confirmed', te: 'ఆర్డర్ ధృవీకరించబడింది' },
  PREPARING: { en: 'Preparing', te: 'తయారవుతోంది' },
  OUT_FOR_DELIVERY: { en: 'Out for delivery', te: 'డెలివరీలో ఉంది' },
  DELIVERED: { en: 'Delivered', te: 'డెలివరీ పూర్తయింది' },
} as const;

function safeText(value: unknown, max = 100): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max)
    : '';
}

/** Accepts Indian mobiles without double +91 prefixes. */
export function normalizeWhatsAppMobile(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.replace(/[ \t()\-]/g, '');
  const match = /^(?:\+91|91)?([6-9]\d{9})$/.exec(compact);
  return match?.[1] ? '91' + match[1] : null;
}

function confirmedDeliveryText(order: Order, te: boolean): string {
  const date = safeText(order.deliveryDate, 20);
  const window = safeText(order.deliveryWindow, 35);
  // Never insert a hard-coded morning/evening time.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}[-–]\d{2}:\d{2}$/.test(window)) return '';
  return te
    ? 'డెలివరీ: ' + date + ' · ' + window + ' IST.'
    : 'Delivery: ' + date + ' · ' + window + ' IST.';
}

export function createWhatsAppOrderUpdate(order: Order, language: string): WhatsAppOrderUpdate | null {
  // Only payment-verified, non-cancelled orders may generate positive updates.
  if (order.paymentStatus !== 'PAID' || order.fulfillmentStatus === 'CANCELLED') return null;
  const status = order.fulfillmentStatus;
  if (!(status in statusLabels)) return null;

  const mobile = normalizeWhatsAppMobile(order.customerMobile)
    ?? normalizeWhatsAppMobile(order.customer?.mobile);
  if (!mobile) return null;

  const id = safeText(order.id, 80);
  if (!id) return null;
  const name = safeText(order.customerName || order.customer?.name, 80);
  const te = language === 'te';
  const salutation = te
    ? 'నమస్కారం' + (name ? ' ' + name + ' గారు' : '') + ','
    : 'Hello' + (name ? ' ' + name : '') + ',';
  const subject = te
    ? 'మీ మన ఇంటి వంట ఆర్డర్ (' + id + ')'
    : 'Your Mana Enti Vanta order (' + id + ')';
  const updates = {
    RECEIVED: te ? 'ధృవీకరించబడింది.' : 'is confirmed.',
    PREPARING: te ? 'ఇప్పుడు తయారవుతోంది.' : 'is being prepared.',
    OUT_FOR_DELIVERY: te ? 'డెలివరీ కోసం బయలుదేరింది.' : 'is out for delivery.',
    DELIVERED: te ? 'డెలివరీ పూర్తయినట్లు నమోదు చేయబడింది.' : 'has been marked delivered.',
  } as const;
  const delivery = status === 'DELIVERED' ? '' : confirmedDeliveryText(order, te);
  const message = [
    salutation,
    subject + ' ' + updates[status],
    delivery,
    te ? 'ధన్యవాదాలు!' : 'Thank you!',
  ].filter(Boolean).join('\n');
  return {
    label: statusLabels[status][te ? 'te' : 'en'],
    message,
    url: 'https://wa.me/' + mobile + '?text=' + encodeURIComponent(message),
  };
}
