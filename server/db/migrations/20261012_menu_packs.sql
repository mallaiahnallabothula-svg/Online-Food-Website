-- REVIEW ONLY. Apply only with explicit production migration approval.
-- Pause checkout and settle existing pending payments before applying.
BEGIN IMMEDIATE;
CREATE TEMP TABLE menu_migration_guard (pending_count INTEGER CHECK(pending_count=0));
INSERT INTO menu_migration_guard SELECT COUNT(*) FROM orders WHERE payment_status='PENDING' AND (id LIKE 'MENU-%' OR jowar_quantity>0 OR chapathi_quantity>0);
DROP TABLE menu_migration_guard;
CREATE TABLE order_items_expanded (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  item_id TEXT NOT NULL,
  item_name_en TEXT NOT NULL,
  item_name_te TEXT NOT NULL,
  meal_period TEXT NOT NULL CHECK(meal_period IN ('MORNING', 'EVENING')),
  sale_unit TEXT NOT NULL CHECK(sale_unit IN ('PIECE', 'PLATE', 'PACK')),
  pieces_per_unit INTEGER CHECK(pieces_per_unit IS NULL OR pieces_per_unit > 0),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price_paisa INTEGER NOT NULL CHECK(unit_price_paisa >= 0),
  line_total_paisa INTEGER NOT NULL CHECK(line_total_paisa = unit_price_paisa * quantity),
  created_at_utc TEXT NOT NULL,
  PRIMARY KEY (order_id, item_id)
);


INSERT INTO order_items_expanded SELECT * FROM order_items;
DROP TABLE order_items;
ALTER TABLE order_items_expanded RENAME TO order_items;
CREATE INDEX idx_order_items_item_id ON order_items(item_id);
CREATE TABLE IF NOT EXISTS menu_pappu_overrides (
 delivery_date TEXT PRIMARY KEY,
 variety TEXT NOT NULL CHECK(variety IN ('TOMATO','PALAKURA','THOTAKURA')),
 updated_at_utc TEXT NOT NULL
);
-- Backfill confirmed piece stock so existing paid orders count against capacity.
INSERT OR IGNORE INTO menu_stock_reservations
(order_id,item_id,delivery_date,quantity_plates,status,held_until_ms,created_at_utc,updated_at_utc)
SELECT i.order_id,i.item_id,o.delivery_date,i.quantity,'CONFIRMED',NULL,o.created_at_utc,o.created_at_utc
FROM order_items i JOIN orders o ON o.id=i.order_id
WHERE i.item_id IN ('jowar-roti','chapathi') AND o.payment_status='PAID';
-- Legacy paid roti/chapathi orders also consume the same kitchen stock.
INSERT OR IGNORE INTO menu_stock_reservations
(order_id,item_id,delivery_date,quantity_plates,status,held_until_ms,created_at_utc,updated_at_utc)
SELECT o.id,'jowar-roti',o.delivery_date,o.jowar_quantity,'CONFIRMED',NULL,o.created_at_utc,o.created_at_utc
FROM orders o WHERE o.payment_status='PAID' AND o.jowar_quantity>0
AND NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id);
INSERT OR IGNORE INTO menu_stock_reservations
(order_id,item_id,delivery_date,quantity_plates,status,held_until_ms,created_at_utc,updated_at_utc)
SELECT o.id,'chapathi',o.delivery_date,o.chapathi_quantity,'CONFIRMED',NULL,o.created_at_utc,o.created_at_utc
FROM orders o WHERE o.payment_status='PAID' AND o.chapathi_quantity>0
AND NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id);
COMMIT;
