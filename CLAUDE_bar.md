# Bar Ordering System — Claude Code Context

## Project overview

A QR-code table ordering system for a family bar. Customers scan a QR code at their table, browse the menu, add items to a cart, and pay via Stripe Checkout — all from their phone without leaving their seat. On successful payment, the order is written to the database and appears live on the staff dashboard via Supabase Realtime. Staff manage order status through preparation to service. Parents manage the menu via a separate admin panel.

Bar counter orders (customers ordering in person at the bar) are handled traditionally by staff — completely outside this system. No customer accounts — the flow is frictionless: scan, order, pay, done.

This is a real production system that will be used by a live business and real paying customers. Reliability and correctness (especially around payments) are more important than features.

## My background

- First year CS student at UCL
- Comfortable with Python and React — built Ascend (full-stack AI web app) over the summer
- Familiar with FastAPI, Supabase (auth, database, storage, realtime), and deployment on Vercel/Railway
- New to Stripe — will use Stripe Checkout (hosted payment page) for simplicity and PCI compliance
- Strong understanding of database schema design, RLS, and foreign key relationships from Ascend

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) |
| Backend | Python + FastAPI |
| Database + Realtime | Supabase (PostgreSQL + Supabase Realtime) |
| Payments | Stripe Checkout (hosted) |
| Frontend deployment | Vercel |
| Backend deployment | Railway |

## Project structure (planned)

```
bar-ordering/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── MenuPage.jsx          # customer-facing menu for a specific table
│   │   │   ├── CartPage.jsx          # cart review before checkout
│   │   │   ├── ConfirmationPage.jsx  # post-payment success screen
│   │   │   ├── StaffDashboard.jsx    # live order dashboard for staff
│   │   │   └── AdminPanel.jsx        # menu management for parents
│   │   ├── components/
│   │   ├── supabaseClient.js
│   │   └── App.jsx
├── backend/
│   ├── main.py                       # FastAPI app
│   ├── routes/
│   │   ├── orders.py                 # create Stripe session, handle webhook
│   │   ├── menu.py                   # CRUD endpoints for admin panel
│   │   └── tables.py                 # table lookup
│   ├── services/
│   │   └── stripe_service.py         # Stripe Checkout session creation
│   └── models/
│       └── models.py                 # Pydantic models
└── CLAUDE.md
```

## User flows

### Customer flow
1. Scan QR code at table → lands on `/table/{table_id}` menu page
2. Browse menu by category, add items to cart (client-side state only, nothing in DB yet)
3. Review cart, adjust quantities
4. Click checkout → backend creates Stripe Checkout session → customer redirected to Stripe hosted page
5. Customer pays on Stripe → redirected back to `/confirmation`
6. Stripe webhook fires → backend verifies payment → writes `orders` + `order_items` to DB
7. Order appears live on staff dashboard via Supabase Realtime

### Staff flow
1. Staff open dashboard on a shared device
2. New orders appear live (Supabase Realtime subscription on `orders` table)
3. Each order shows table number, items ordered, time placed, total
4. Staff updates status: pending → preparing → served (or cancelled)

### Admin flow
1. Parents log in to `/admin` with a shared Supabase account
2. Add / edit / delete menu items — name, description, price, category
3. Toggle item availability on/off (sold out without deleting)
4. Adjust prices as needed
5. Changes reflect immediately on customer-facing menu

## Database schema

**`menu_items`**
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `name` TEXT NOT NULL
- `description` TEXT
- `price` NUMERIC NOT NULL
- `category` TEXT NOT NULL
- `available` BOOLEAN NOT NULL DEFAULT true
- `created_at` TIMESTAMPTZ DEFAULT NOW()

**`tables`**
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `table_number` TEXT NOT NULL
- `created_at` TIMESTAMPTZ DEFAULT NOW()

**`orders`**
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `table_id` UUID REFERENCES tables(id) ON DELETE SET NULL
- `status` TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'served', 'cancelled'))
- `stripe_payment_intent_id` TEXT
- `total_amount` NUMERIC NOT NULL  -- computed server-side, never trusted from client
- `created_at` TIMESTAMPTZ DEFAULT NOW()

**`order_items`**
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `order_id` UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL
- `menu_item_id` UUID REFERENCES menu_items(id) ON DELETE SET NULL  -- nullable
- `item_name` TEXT NOT NULL  -- snapshot: preserves name even if menu item is deleted
- `quantity` INTEGER NOT NULL
- `price_at_order` NUMERIC NOT NULL  -- snapshot: preserves price even if menu price changes

## Key technical decisions

**Stripe Checkout (hosted page) over custom checkout form:**
Stripe Checkout means Stripe handles card data entry, PCI compliance, 3D Secure, and fraud detection. Building a custom checkout form that collects card numbers directly would require PCI-DSS compliance — not appropriate for this project. Never build your own card collection form.

**Order only written to DB after Stripe webhook confirms payment:**
The frontend never writes orders directly. Flow: Stripe Checkout session created → customer pays → Stripe fires webhook to `/webhook` endpoint → backend verifies event signature → backend writes `orders` + `order_items`. This prevents unpaid orders appearing on the staff dashboard.

**Server-side total verification:**
`orders.total_amount` is always computed by the backend from the cart items — never trusted from the client. Backend recomputes: sum of (quantity × price) for each item, verified against the Stripe session amount before confirming.

**Frontend fallback polling:**
Webhooks can occasionally fail or arrive late. After Stripe redirects back to `/confirmation`, the frontend polls the backend briefly (e.g. every 2 seconds for up to 30 seconds) to confirm the order was written, as a fallback.

**Supabase Realtime for staff dashboard:**
Staff dashboard subscribes to inserts on the `orders` table via Supabase Realtime. New orders appear instantly with no polling needed.

**Price and name snapshots on order_items:**
`price_at_order` and `item_name` snapshotted at checkout time. Historical orders never affected by future menu changes or deletions. `menu_item_id` uses ON DELETE SET NULL so deleting a menu item doesn't cascade to order history.

**Stripe test mode for development:**
All development uses Stripe test mode with test API keys and fake card numbers. Production keys only added once business is formally registered. Code is identical between test and live — only environment variables change.

## Out of scope

- Bar counter orders — handled traditionally by staff, outside this system
- Customer accounts / login — frictionless flow, no signup required
- Real-time menu updates pushed to open customer sessions
- Order history for customers
- Analytics dashboard (potential future addition)
- Refund UI (handled directly via Stripe dashboard by parents)

## Coding guidelines

**General:**
- This is a real system for a live business — prioritise correctness and reliability over speed
- Write clean, readable code with clear comments explaining non-obvious decisions
- Keep functions small and single-purpose
- Use meaningful variable names

**Payment-critical code:**
- Always verify Stripe webhook signatures before processing — never trust unverified webhook payloads
- Always compute totals server-side — never trust client-sent amounts
- Write defensive code around payment flows — assume webhooks can fail or arrive out of order

**When I ask for help:**
- Explain reasoning and non-obvious decisions as comments alongside code
- If I ask for something large, break it into small steps
- Flag any security-relevant decisions explicitly — especially around payments

**Frontend (React):**
- Functional components only, use hooks
- Keep components small and focused
- Use React Router for navigation

**Backend (FastAPI):**
- Separate routes, services, and models clearly
- Add docstrings to all functions
- Return clear, descriptive error messages with appropriate HTTP status codes
- Validate all inputs with Pydantic models

**Python:**
- Type hints on all functions
- Follow PEP 8

## Environment variables needed

**Backend (.env):**
```
SUPABASE_URL=
SUPABASE_KEY=
STRIPE_SECRET_KEY=        # test key during development: sk_test_...
STRIPE_WEBHOOK_SECRET=    # from Stripe dashboard webhook setup
FRONTEND_URL=             # for CORS and Stripe redirect URLs
```

**Frontend (.env):**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=   # pk_test_... during development
```

## Current build status

**Phase 3 complete.** Full payment flow is working end-to-end: Stripe Checkout session creation with server-side price verification, webhook handler with signature verification and idempotency, order + order_items written to Supabase on confirmed payment, confirmation page with fallback polling. Ready to start Phase 4 (staff dashboard).

## Build phases

1. ~~Project scaffolding — repo, Vite frontend, FastAPI backend, Supabase schema, environment setup~~ ✓
2. ~~Customer menu flow — fetch menu from Supabase, display by category, cart (client-side state)~~ ✓
3. ~~Stripe Checkout integration — session creation, webhook handler, order written to DB on payment~~ ✓
4. Staff dashboard — Supabase Realtime subscription, order status updates
4. Staff dashboard — Supabase Realtime subscription, order status updates
5. Admin panel — menu CRUD, availability toggle, protected by Supabase auth
6. QR code generation — one per table
7. Polish and deployment — Vercel + Railway, swap to production Stripe keys once business registered
