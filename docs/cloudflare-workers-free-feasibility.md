# PR #13 — Cloudflare Workers Free feasibility (offline only)

**Decision: BLOCKED for production migration; staging proof required.** This PR neither deploys to Cloudflare nor changes the existing site.

## Evidence from current repository

| Area | Offline finding | Confidence |
| --- | --- | --- |
| React/Vite assets | `index.html`, static `public/` assets and Vite build exist. Cloudflare asset routing remains unconfigured. | Code inspection; Worker delivery UNVERIFIED |
| Express API | Existing `server/app.ts` constructs Express with `/api` routes. No Worker-specific fetch handler, compatibility configuration, or `wrangler` project exists. | Worker runtime UNVERIFIED |
| Persistent database | Turso libSQL schema exists. Current `server/db/index.ts` imports `@libsql/client` plus Node `fs`/`path`, falling back to local disk. A separate `@libsql/client/web` adapter can be imported in an isolated Node probe, but remote Workers connectivity, transactions, and existing data persistence are **not tested**. | BLOCKED until isolated Workers + nonproduction Turso tests |
| Razorpay webhook | Express JSON parser preserves raw `Buffer` and `/api/payment/webhook` verifies HMAC against exact bytes. Synthetic local HMAC probe shows why whitespace changes invalidate signatures. Cloudflare raw request body forwarding and gateway callback behavior are **not tested**. | Local HMAC check; Workers handling UNVERIFIED |
| Owner authentication | `server/auth/index.ts` uses `bcryptjs`, sessions, cookies and persistent DB state. Offline bcrypt test proves local comparison only; CPU usage does not establish Cloudflare runtime cost. Timers and Node compatibility need evaluation. | BLOCKED until runtime CPU/auth tests |
| Free tier feasibility | Workers Free has CPU/request and daily request limits and script-size restrictions; bcrypt + Express + database may breach runtime CPU ceilings or bundle constraints. | Cannot validate without actual Worker deployment and measured CPU |
| Existing payments/data | No payment gateway invoked; no real keys used; no production DB queried or modified; no historical orders touched. | Confirmed by limited test scope and PR diff |

## Required follow-up, separate approval

1. In a **separate staging project**, add a minimal Cloudflare Worker entrypoint and asset configuration; do not modify current Vercel entrypoints or production flags.
2. Use **isolated test-only Turso database**, no production database clone or credentials, and synthetic sample orders.
3. Prove HTTP API health, persistent Turso transactions, raw webhook request bytes/HMAC, cookies/CSRF/login, production-sized bundled assets, static routes and client refresh.
4. Measure on actual Workers Free runtime, especially owner bcrypt authentication, cold starts, payment verification, request CPU, size constraints, and error paths; use simulated Razorpay data and test mode only.
5. Only then choose Cloudflare vs another permitted free or paid-hosting alternative. Confirm platform terms and commercial suitability before delivering a client site.

## Offline test interpretation

Run `npm ci && npm run lint && npm test && npm run build`. Passing these checks validates the current **Node-based** code and synthetic probes; it **does not prove** Cloudflare Workers deployment, Free-plan limits, or a production-ready 10-item customer-to-owner payment flow. In particular, the menu preview checkout remains disabled (`NEW_MENU_LAUNCH_ENABLED=false`).

**No go-live approval implied.** Keep original site, owner UI, Razorpay, database, orders and customer links unchanged.
