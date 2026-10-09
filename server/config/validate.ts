import { BUSINESS_CONFIG } from './business.ts';

export function validateServerConfig(): void {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.ADMIN_INITIAL_PASSWORD && process.env.ADMIN_INITIAL_PASSWORD.length < 12) {
      throw new Error('Use at least 12 characters for the initial administrator password.');
    }
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !process.env.RAZORPAY_WEBHOOK_SECRET) {
      throw new Error('Configure Razorpay key ID, secret and webhook secret before accepting online orders.');
    }
    if (process.env.VERCEL && (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)) {
      throw new Error('Configure the persistent database before accepting orders on Vercel.');
    }
    if (process.env.VERCEL_ENV === 'production' && !process.env.RAZORPAY_KEY_ID.startsWith('rzp_live_')) {
      throw new Error('The production website requires live Razorpay keys. Use test keys only in previews.');
    }
    if (process.env.VERCEL_ENV === 'preview' && !process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_')) {
      throw new Error('The preview website requires Razorpay test keys. Live payments are only allowed in production.');
    }
  }
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
