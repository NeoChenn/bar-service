-- Bar Ordering System — Database Schema
-- Run this in the Supabase SQL editor to set up the schema.

-- Menu items: what the bar sells
CREATE TABLE menu_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    price       NUMERIC(10, 2) NOT NULL,
    category    TEXT NOT NULL,
    available   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tables: the physical tables in the bar, each with a QR code
CREATE TABLE tables (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number TEXT NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Orders: one row per completed payment.
-- Orders are only written here AFTER the Stripe webhook confirms payment —
-- never on session creation or customer redirect.
CREATE TABLE orders (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id                 UUID REFERENCES tables(id) ON DELETE SET NULL,
    status                   TEXT NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'preparing', 'served', 'cancelled')),
    stripe_payment_intent_id TEXT,
    -- Total is computed server-side from menu prices; never trusted from the client.
    total_amount             NUMERIC(10, 2) NOT NULL,
    created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Order items: line items for each order.
-- item_name and price_at_order are snapshots taken at checkout time so that
-- historical orders are unaffected by future menu edits or deletions.
CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    -- SET NULL (not CASCADE) so deleting a menu item doesn't wipe order history.
    menu_item_id    UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name       TEXT NOT NULL,      -- snapshot of menu_items.name at order time
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    price_at_order  NUMERIC(10, 2) NOT NULL  -- snapshot of menu_items.price at order time
);

-- Enable Realtime on orders so the staff dashboard receives live inserts.
-- In Supabase dashboard: Database → Replication → enable orders table.
-- (Cannot be done via SQL — must be toggled in the Supabase dashboard UI.)

-- ── RLS policies ─────────────────────────────────────────────────────────────
-- Supabase has two layers of access control:
--   1. PostgreSQL GRANT  — does this role have any access to the table at all?
--   2. RLS policy        — which rows within the table can this role see/modify?
-- Both are required. GRANT without a policy = no rows. Policy without GRANT = error 42501.

-- menu_items and tables are publicly readable (anon key, no login required).
-- orders and order_items are never read by the anon role — only written by the
-- FastAPI backend via the service role key, which bypasses RLS entirely.

GRANT SELECT ON public.tables TO anon;
GRANT SELECT ON public.menu_items TO anon;

CREATE POLICY "Public can read tables"
    ON tables FOR SELECT USING (true);

CREATE POLICY "Public can read menu items"
    ON menu_items FOR SELECT USING (true);
