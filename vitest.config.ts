import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'threads',
    testTimeout: 15000,
    hookTimeout: 15000,
    env: {
      NODE_ENV: 'test',
      LOCAL_DATABASE_PATH: ':memory:',
      TURSO_DATABASE_URL: '',
      TURSO_AUTH_TOKEN: '',
      RAZORPAY_KEY_ID: '',
      RAZORPAY_KEY_SECRET: '',
      RAZORPAY_WEBHOOK_SECRET: '',
      ADMIN_INITIAL_PASSWORD: 'Isolated-test-password-only',
      VERCEL: '',
      VERCEL_ENV: '',
    },
  },
});
