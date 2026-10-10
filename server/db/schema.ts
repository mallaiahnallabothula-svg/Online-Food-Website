export const DB_SCHEMA = `
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'STAFF')),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  session_token_hash TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT
);

-- Additive persistent protection shared by every Vercel instance.
-- key_hash is SHA-256 of an IP/username namespace; no raw login identifiers stored.
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  key_hash TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  window_expires_at_ms INTEGER NOT NULL,
  locked_until_ms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  public_token_hash TEXT NOT NULL UNIQUE,
  created_at_utc TEXT NOT NULL,
  created_at_ist TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  delivery_window TEXT NOT NULL,
  jowar_quantity INTEGER NOT NULL DEFAULT 0,
  chapathi_quantity INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL,
  karivepaku_grams INTEGER NOT NULL DEFAULT 0,
  avise_grams INTEGER NOT NULL DEFAULT 0,
  jowar_unit_price_paisa INTEGER NOT NULL,
  chapathi_unit_price_paisa INTEGER NOT NULL,
  subtotal_paisa INTEGER NOT NULL,
  delivery_charge_paisa INTEGER NOT NULL,
  total_amount_paisa INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_status TEXT NOT NULL CHECK(payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  order_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(order_status IN ('PENDING', 'PAID', 'CONFIRMED', 'TICKET_GENERATED')),
  ticket_text TEXT,
  ticket_generated_at TEXT,
  payment_provider TEXT NOT NULL,
  provider_order_id TEXT,
  provider_payment_id TEXT NOT NULL,
  fulfillment_status TEXT NOT NULL CHECK(fulfillment_status IN ('RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')),
  customer_name TEXT NOT NULL,
  customer_mobile TEXT NOT NULL,
  address TEXT NOT NULL,
  landmark TEXT,
  latitude REAL,
  longitude REAL,
  distance_km REAL NOT NULL,
  location_link TEXT,
  location_verified INTEGER NOT NULL DEFAULT 0,
  received_at TEXT,
  received_by TEXT,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_order_id TEXT,
  provider_payment_id TEXT UNIQUE NOT NULL,
  amount_paisa INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL,
  signature TEXT,
  raw_payload TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_order_id TEXT,
  mock_verification_token TEXT,
  amount_paisa INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  is_verified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  publication_consent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('SYSTEM', 'ADMIN', 'STAFF', 'CUSTOMER')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at_utc);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_mobile ON orders(customer_mobile);
CREATE INDEX IF NOT EXISTS idx_orders_token_hash ON orders(public_token_hash);
CREATE INDEX IF NOT EXISTS idx_orders_provider_order ON orders(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_hash ON admin_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_intents_order ON payment_intents(order_id);
CREATE INDEX IF NOT EXISTS idx_intents_provider_order ON payment_intents(provider_order_id);
`;
