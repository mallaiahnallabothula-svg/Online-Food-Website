# Confirmed menu expansion (12 items)

Scope: retain existing prices for the original ten products; specify single-piece dosa/pesarattu portions; add two optional 120 g curry packs; roti/chapathi minimum 3 and daily stock 50 pieces; eight plate products 30/day; each curry 30 packs/day. Existing ₹100 food minimum and server-side session separation remain enforced. Session selection now preserves the other session's cart.

Pappu rotation uses the delivery date, with authenticated owner date overrides. Pending order creation compares the reviewed date/variety inside its write transaction, then snapshots the variety into the order item. Later overrides do not rewrite historical orders. All pappu varieties share the same product inventory. Wednesday is skipped by the existing next-window scheduler.

## Production gate — not applied

The current production order_items CHECK accepts only PIECE/PLATE. PACK requires the reviewed migration `server/db/migrations/20261012_menu_packs.sql`. Do not merge/deploy this PR ahead of a separately approved coordinated migration:

1. Pause new checkout and reconcile pending menu payments. Do not delete pending/historical orders. The migration refuses to run while any menu or legacy piece order is PENDING.
2. Back up and inspect the production database using its normal approved process.
3. Apply the migration transaction under separate explicit authorization. It preserves all item rows and adds piece reservations for already-paid itemized and legacy orders, preventing new capacity from ignoring existing sales.
4. Deploy the approved commit, verify schema/menu/owner overrides, and restore checkout only after verification.

No production database, settings, payment credentials or launch flags were changed during implementation. No real payment was made. No new delivery provider, routing, fee slabs or refund policy were introduced.

Curries use a neutral bowl placeholder until approved representative artwork/photos are available. This avoids mislabeling an existing idly image as curry.
