export const MENU_EXPANSION_SCHEMA = `CREATE TABLE IF NOT EXISTS menu_pappu_overrides (
 delivery_date TEXT PRIMARY KEY,
 variety TEXT NOT NULL CHECK(variety IN ('TOMATO','PALAKURA','THOTAKURA')),
 updated_at_utc TEXT NOT NULL
);`;
