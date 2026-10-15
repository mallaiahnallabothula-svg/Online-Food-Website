-- STAGE 2G P0-B1 -- DRAFT ONLY: NEVER AUTO-APPLY IN API STARTUP.
-- Requires a separately approved backup, migration window, and feature activation.
-- Non-destructive: no ALTER/UPDATE/DELETE on existing financial tables.
BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS refund_review_cases (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  provider_payment_id TEXT UNIQUE,
  amount_paisa INTEGER NOT NULL CHECK(amount_paisa > 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK(currency = 'INR'),
  reason TEXT NOT NULL CHECK(reason IN ('CUSTOMER_REQUEST','ORDER_UNAVAILABLE','PAYMENT_EXCEPTION','OTHER')),
  status TEXT NOT NULL CHECK(status IN ('NEEDS_REVIEW','IN_PROGRESS','REFUND_REPORTED_UNVERIFIED','CLOSED_NO_REFUND')),
  reported_refund_id TEXT UNIQUE,
  initial_note TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  CHECK(status <> 'REFUND_REPORTED_UNVERIFIED' OR reported_refund_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS refund_review_events (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL REFERENCES refund_review_cases(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK(event_type IN ('CASE_CREATED','STATUS_CHANGED')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version > 0),
  created_at_utc TEXT NOT NULL,
  UNIQUE(case_id, version)
);

CREATE INDEX IF NOT EXISTS idx_refund_review_cases_status ON refund_review_cases(status, updated_at_utc);
CREATE INDEX IF NOT EXISTS idx_refund_review_events_case ON refund_review_events(case_id, version);
COMMIT;
