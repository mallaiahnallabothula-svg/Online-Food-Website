-- Mannu's Smart Menu V1: MANUAL REVIEWED MIGRATION ONLY.
-- NEVER add to the runtime DB_SCHEMA or auto-run during startup.
-- Apply only after separately approved backup, migration and release window.
-- Existing orders, payments, inventory limits and historical rows are untouched.
BEGIN IMMEDIATE;
CREATE TABLE IF NOT EXISTS smart_menu_days (
  delivery_date TEXT PRIMARY KEY NOT NULL,
  holiday_closed INTEGER NOT NULL DEFAULT 0 CHECK(holiday_closed IN (0,1)),
  holiday_reason TEXT NOT NULL DEFAULT '',
  morning_cutoff_ist TEXT,
  evening_cutoff_ist TEXT,
  curry_name TEXT NOT NULL DEFAULT '',
  curry_name_te TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS smart_menu_item_pauses (
  delivery_date TEXT NOT NULL,
  item_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN ('PAUSED','INGREDIENT_SHORTAGE')),
  updated_at_utc TEXT NOT NULL,
  PRIMARY KEY(delivery_date,item_id)
);
CREATE INDEX IF NOT EXISTS idx_smart_menu_pauses_date ON smart_menu_item_pauses(delivery_date);
COMMIT;
