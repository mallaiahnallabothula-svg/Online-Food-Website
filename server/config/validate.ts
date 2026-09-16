import { BUSINESS_CONFIG } from './business.ts';

export function validateServerConfig(): void {
  // 1. Business configuration validation
  if (!BUSINESS_CONFIG.brand.upiId || !BUSINESS_CONFIG.brand.upiId.includes('@')) {
    console.warn('[CONFIG] Warning: Authoritative BUSINESS_UPI_ID is not configured with a valid VPA format.');
  } else {
    console.log(`[CONFIG] Authoritative UPI ID initialized: ${BUSINESS_CONFIG.brand.upiId}`);
  }

  // 2. Payment Gateway Configuration (Non-fatal graceful check)
  const hasRazorpay = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  if (hasRazorpay) {
    console.log('[CONFIG] Razorpay payment gateway credentials loaded.');
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      console.warn('[CONFIG] Warning: RAZORPAY_WEBHOOK_SECRET is not set; external webhooks will fail verification.');
    }
  } else {
    console.log('[CONFIG] Notice: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set. Server ready in direct UPI QR / test payment mode.');
  }
}

