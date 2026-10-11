# Stage 2: inactive menu integration

The public 10-item menu remains a local preview. `NEW_MENU_LAUNCH_ENABLED=false` is unchanged. The existing two-item checkout and all production schema files are unchanged.

The app mounts `/api/menu/checkout` with **no dependencies**, returning 404 before any database or payment operation. Neither environment variables nor changing the launch constant enables this harness. Only isolated tests explicitly inject the database, clock, encryption key and mock gateway transport; NODE_ENV must also be test and credentials must be TEST credentials. No environment credentials are read by this router.

The customer preview has an explicit test-only checkout seam. Its session freezes the request and random idempotency key, retries lost preparation responses against the existing durable claim service, reuses the bound gateway intent, and retries verification with the same receipt. An ambiguous payment popup never automatically opens another payment. Payment confirmation requires a private token, signature and a server-fetched captured INR receipt. REVIEW_REQUIRED never becomes an order confirmation.

Owner list and customer tracking responses add saved item snapshots for MENU orders. Existing authentication and private tracking tokens remain required. Legacy orders skip new-menu table queries and keep their existing response fields and display. The shared item list shows saved quantities, units and prices.

## Verification

Isolated HTTP tests exercise the frontend session through Express, in-memory libSQL, mocked TEST gateway, settlement, private customer tracking and authenticated owner listing. Component tests exercise the preview connection and payment status UI. Existing price, stock, idempotency, payment and legacy regression tests remain in the suite.

## Stage 3 — separate approval required

- Review and approve durable production schema readiness, including idempotency persistence; this PR does not migrate anything.
- Replace the isolated harness with an explicitly approved production adapter, real location acquisition and payment SDK lifecycle; retain fail-closed behavior.
- Review browser reload/reconciliation recovery, payment webhook routing and operational manual-review handling before enabling ordering.
- Configure and verify provider credentials and deployment settings through authorized access.
- Perform final security/payment/stock/legacy acceptance checks before any launch flag change.

No claim of live 10-item ordering, real payment acceptance or production readiness is made by this PR. Merge requires separate approval.
