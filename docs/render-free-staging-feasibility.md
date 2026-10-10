# PR #14 — Render Free staging feasibility and production-readiness audit

**Scope:** Read-only source assessment and isolated localhost HTTP checks. **No Render service, deploy, database connection, Razorpay request, environment variable or production code change.**

## Existing Node/Render fit
- The production npm scripts are `npm run build` (Vite frontend + Node esbuild bundle) and `npm start` (`node dist/server.cjs`).
- `server.ts` listens on `process.env.PORT || 3000`, binding `0.0.0.0` in production, and serves the built `dist/` SPA through Express. These patterns are Render-compatible **in principle**, but the compiled bundle startup, installed dependencies and Render routing remain **unverified**.
- A test adds isolated loopback HTTP checks for `GET /api/health`, unknown API path, and signed synthetic non-captured webhook. Local results cannot establish Render runtime behavior, webhook delivery from Razorpay, or public URL accessibility.

## Launch blockers and safety risks
1. **Critical: order persistence.** In `server/db/index.ts` the absence of `TURSO_DATABASE_URL` on Render causes **local SQLite fallback**, because the persistent-DB guard is only `if (process.env.VERCEL)`. Free Render instances have an ephemeral filesystem: orders/admin sessions could disappear after a restart or redeploy. A future separately approved PR must fail closed on Render production without a persistent remote DB and confirm isolated staging Turso connectivity. **Never connect staging to production Turso.**
2. **Critical: environment isolation.** `server/config/validate.ts` validates Razorpay test keys for Vercel previews and live keys for Vercel production, **not Render environments**. A future change must explicitly prevent real payments in staging and require the intended live configuration for authorized launch. No secrets should be copied into PR or logs.
3. **Critical: end-to-end new menu not ready.** `NEW_MENU_LAUNCH_ENABLED=false` and the 10-item UI checkout is intentionally disabled. Neither hosting migration nor the legacy payment routes make the new menu customer-ready.
4. **Webhook compatibility.** Existing Express body parser captures raw bytes in `req.rawBody`; `/api/payment/webhook` uses HMAC and rejects altered bytes. The PR checks this behavior with a synthetic **ignored** event, not a captured payment; must repeat with Razorpay Test Mode after staging is approved.
5. **Owner portal.** Login uses persistent `admin_sessions`, hashed passwords and cookie/CSRF checks; startup `initDb()` can create an initial admin. Test only against an isolated nonproduction DB. Verify sign-in, logout, cookie security, audit logs and order status changes end to end.
6. **Render Free limitations.** Idle spin-down, cold starts, monthly quotas and no production uptime SLA make a real-money customer launch unreliable; sleeping service may delay webhook acknowledgement or first visits. Payment gateway retry and failure recovery require explicit testing before owner launch approval.
7. **Build/start caveat.** Running Node bundle under `NODE_ENV=production` may reveal development dependency/bundle module issues. This PR does not perform a Render build or claim startup is proven.

## Required later steps (new scoped approval)
- Stage separately, with isolated Turso test database and Razorpay **test keys only**. Apply safe startup/env guards before deployment.
- Prove `npm ci`, `npm run lint`, `npm test`, `npm run build`, **actual** `npm start`, `/api/health`, `/api/status`, SPA refresh, owner login and customer tracking in staging.
- Verify duplicate/missing/tampered payment webhook handling, successful and failed synthetic payments, stock reservation/expiry/refunds, and restart persistence. Confirm Razorpay callback endpoint response during idle/cold start.
- Finish 10-item cart + owner integrations and do end-to-end acceptance tests. Do not activate menu or accept live money until separate explicit go-live approval.

**Decision:** Existing Node server is a plausible Render staging candidate, **not launch-ready**. Passing offline PR CI is necessary but not a production deployment or runtime verification.

**No production deployment, payment, DB change, customer UI or current customer order modification was authorized by this PR.**
