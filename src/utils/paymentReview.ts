/** Owner-only read-only projection of captured payments needing manual review.
 * Never accept payment signatures, raw gateway payloads or tracking secrets.
 */
export interface PaymentReview {
  readonly id: string;
  readonly orderId: string;
  readonly providerPaymentId: string;
  readonly amountPaisa: number;
  readonly currency: 'INR';
  readonly createdAt: string;
  readonly paymentStatus: string;
  readonly orderStatus: string;
  readonly deliveryDate: string;
  readonly status: 'REVIEW_REQUIRED';
}

export interface PaymentReviewPage {
  readonly reviews: readonly PaymentReview[];
  readonly pagination: { readonly page: number; readonly limit: number; readonly total: number };
}

export function validatePaymentReviewPage(value: unknown, expectedPage: number): PaymentReviewPage {
  if (!value || typeof value !== 'object') throw new Error('Invalid payment review response');
  const record = value as Record<string, unknown>;
  const pagination = record.pagination as Record<string, unknown> | undefined;
  if (!pagination || !Number.isSafeInteger(pagination.total) || Number(pagination.total) < 0 ||
      pagination.limit !== 20 || pagination.page !== expectedPage ||
      !Array.isArray(record.reviews) || record.reviews.length > 20 ||
      record.reviews.length > Number(pagination.total)) {
    throw new Error('Invalid payment review response');
  }
  const reviews = record.reviews as unknown[];
  if (!reviews.every(item => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    return typeof row.id === 'string' && row.id.length > 0 &&
      typeof row.orderId === 'string' && /^MENU-[a-f0-9-]{36}$/i.test(row.orderId) &&
      typeof row.providerPaymentId === 'string' && /^pay_[a-zA-Z0-9]{5,64}$/.test(row.providerPaymentId) &&
      row.currency === 'INR' && row.status === 'REVIEW_REQUIRED' &&
      Number.isSafeInteger(row.amountPaisa) && Number(row.amountPaisa) > 0 &&
      typeof row.paymentStatus === 'string' &&
      ['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(row.paymentStatus) &&
      typeof row.orderStatus === 'string' &&
      ['PENDING', 'PAID', 'CONFIRMED', 'TICKET_GENERATED'].includes(row.orderStatus) &&
      typeof row.deliveryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.deliveryDate) &&
      typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt));
  })) {
    throw new Error('Invalid payment review response');
  }
  const ids = reviews.map(item => (item as PaymentReview).id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate payment review records');
  return { reviews: reviews as PaymentReview[], pagination: pagination as PaymentReviewPage['pagination'] };
}

export async function fetchPaymentReviewPage(
  page: number, signal?: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<PaymentReviewPage> {
  if (!Number.isSafeInteger(page) || page < 1 || page > 99999) throw new Error('Invalid review page');
  const res = await fetcher('/api/admin/payment-reviews?page=' + page, {
    credentials: 'include', cache: 'no-store', signal,
  });
  if (res.status === 401 || res.status === 403) throw new Error('OWNER_REVIEW_ACCESS_DENIED');
  if (!res.ok) throw new Error('Payment review feed unavailable');
  return validatePaymentReviewPage(await res.json(), page);
}

export function formatPaymentReviewAmount(amountPaisa: number): string {
  if (!Number.isSafeInteger(amountPaisa) || amountPaisa <= 0) throw new Error('Invalid review amount');
  return '₹' + (amountPaisa / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
