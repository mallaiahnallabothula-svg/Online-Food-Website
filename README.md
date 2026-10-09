# Mana Enti Vanta

Recovered Google AI Studio source: https://ai.studio/apps/5303fe9c-153c-43c5-8a8e-396d32d5f626

React/Vite PWA with an Express API, persistent orders, customer tracking, and Razorpay checkout. Existing prices are retained: jowar roti ₹30, chapathi ₹10, minimum five of each selected item. Ordering is 11 AM–4 PM IST; delivery is 6–8 PM. Complimentary karam matches the displayed menu: 20 g per complete set of five for each selected option; both options are available above ten total items.

## Local development

Use Node.js 24. Install with `npm ci`, copy `.env.example` to `.env`, then run `npm run dev`. Development uses a local SQLite database and never sends a real payment without configured Razorpay keys. The owner account is `admin`; set `ADMIN_INITIAL_PASSWORD` before the first start. Local previews bind to 127.0.0.1.

Validation: `npm run lint`, `npm test`, `npm run build:frontend`. The tests use isolated in-memory databases, synthetic customer data and mocked gateway calls. They do not contact Razorpay or a production database.

## Deploy to the existing Vercel project

`vercel.json` builds the Vite frontend and routes `/api/*` to `api/index.ts`. The function initializes the API without a port listener or local filesystem database. Keep `NODEJS_HELPERS=0` so webhook HMAC verification receives the original request bytes.

Configure these server-only variables in the intended Vercel environment:

- `TURSO_DATABASE_URL`: a persistent remote libSQL database URL.
- `TURSO_AUTH_TOKEN`: the database access token.
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`: matching Razorpay API keys.
- `RAZORPAY_WEBHOOK_SECRET`: the secret selected for the Razorpay webhook.
- `ADMIN_INITIAL_PASSWORD`: at least 12 characters, required only for first administrator initialization.
- `NODEJS_HELPERS`: `0`.
- `BUSINESS_UPI_ID`: existing business UPI ID, retained in `.env.example`.

Use a separate preview database and Razorpay test keys for a preview deployment. Production requires a `rzp_live_` key. Never prefix secrets with `VITE_`, commit actual `.env` files, or use an ephemeral local SQLite file on Vercel. Existing production orders are not present in the recovered GitHub source; connect an existing database if there is one.

In the Razorpay dashboard, configure automatic payment capture and add:

- Webhook URL: `https://online-food-website-853r.vercel.app/api/payment/webhook`
- Event: `payment.captured`
- Secret: exactly the value stored as `RAZORPAY_WEBHOOK_SECRET` in Vercel.

The frontend opens the gateway's saved order. Server verification checks the signature, captured status, gateway order, currency and exact amount before recording payment and generating the ticket. Webhook retries and client verification are idempotent. A static UPI transfer alone does not confirm an order.

Before production promotion, verify `/api/health`, `/api/status`, a Razorpay test-mode order, order tracking after refresh, owner login, receipt and saved feedback. Actual live payments require configured and activated Razorpay credentials; they have not been tested in this recovered workspace.

PWA updates continue on the same site URL after deployment. Customers can reopen/refresh their existing Home Screen app.

Official references: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel Node helpers](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration), [Turso TypeScript SDK](https://docs.turso.tech/sdk/ts/reference), [Razorpay integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).
