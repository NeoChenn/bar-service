# Bar Ordering System — Dev Log

A running journal of progress, decisions, and learnings. Kept for interview preparation and personal reflection.

---

## How to use this file

At the end of each build phase, add a new entry with:
- **What I built** — concrete features or progress
- **What broke / what was hard** — real problems encountered
- **What I learned** — new concepts or technologies
- **Decisions made** — why you chose one approach over another
- **What's next** — what you're tackling next

---

## Phase 0 — Planning and design
*Date: July 2026*

### Context

My parents are opening a bar in July 2026. Rather than using an off-the-shelf QR ordering solution (Square, SumUp, Toast etc.), I offered to build one — partly to help them, partly as a second portfolio project alongside Ascend. The honest tradeoff: commercial solutions would be more robust and cheaper to operate, but building it myself gives me real payment integration experience and a deployed system with real paying customers, which is a different kind of portfolio evidence than a solo project.

The core user problem: customers at seated tables shouldn't need to queue at the bar to order. Scan a QR code, browse the menu, pay from your phone, drinks arrive at the table.

Bar counter orders (walk-up customers) are handled traditionally by staff — completely outside this system. This is the Wetherspoons model: two parallel workflows coexisting, app for table service only.

### Key decisions made before writing any code

**Stripe Checkout over a custom checkout form:**
The most important technical decision in the project. Building a custom form that collects card numbers directly would require PCI-DSS compliance — a serious regulatory burden involving security audits and controls not appropriate for a student-built system handling real money. Stripe Checkout is a Stripe-hosted payment page that handles card data, PCI compliance, 3D Secure authentication, and fraud detection entirely on Stripe's side. My code never touches card numbers. This is non-negotiable for any project handling real payments.

**Order only written to DB after Stripe webhook confirms payment:**
The frontend never writes orders to the database. The flow is: cart → Stripe Checkout session → customer pays on Stripe → Stripe fires a webhook to my backend → backend verifies the webhook signature → backend writes the order. This prevents unpaid or abandoned checkouts from appearing as real orders on the staff dashboard. Getting this order of operations right matters enormously in a live payment system.

**Server-side total verification:**
`orders.total_amount` is always computed by the backend, never trusted from the client. A malicious user could tamper with a client-sent cart total. The backend recomputes the total from the actual menu prices in the database before creating the Stripe session — the amount the customer sees is always what the backend calculated, not what the frontend sent.

**Frontend fallback polling:**
Stripe webhooks can occasionally fail or arrive late. After Stripe redirects the customer back to `/confirmation`, the frontend polls the backend every 2 seconds for up to 30 seconds to confirm the order was written. This is a defensive measure so customers don't see a confusing confirmation page if the webhook is delayed.

**Supabase Realtime for staff dashboard:**
Staff need to see new orders appear instantly without refreshing. Supabase Realtime (which I already know from Ascend) subscribes to inserts on the `orders` table and pushes updates to the dashboard client. No polling, no extra infrastructure — same Supabase instance as everything else.

**No customer accounts:**
The flow is intentionally frictionless — scan, order, pay, done. Requiring customers to sign up would create drop-off and friction for what is essentially a one-time interaction per visit. No auth on the customer side at all.

**Bar counter orders kept traditional:**
After researching how Wetherspoons handles the same problem, the conclusion was clear: don't try to route bar counter orders through the app. In-person orders have no "where to deliver this" ambiguity — the customer is standing right there. Merging them into one system adds complexity with no benefit.

### Schema design decisions

**Price and name snapshots on `order_items`:**
Both `price_at_order` and `item_name` are snapshotted at checkout time onto `order_items`. Menu prices will change and menu items will be deleted over time — historical orders should never be affected by these changes. A historical order reading "2x Mojito — £8.50" should always display correctly regardless of whether the Mojito still exists on the menu or what its current price is.

**`ON DELETE SET NULL` for `menu_item_id`:**
When a menu item is deleted, `order_items.menu_item_id` is set to NULL rather than cascading the delete to order history. The order history is preserved via the name and price snapshots. This was a deliberate choice over `ON DELETE CASCADE` (which would delete historical order line items when a menu item is removed) and `ON DELETE RESTRICT` (which would prevent deleting menu items that appear in any past order).

**`ON DELETE CASCADE` for `order_items` from `orders`:**
If an order is deleted, its line items should be deleted too — they have no meaning without their parent order. Cascade is appropriate here.

**`cancelled` status included from day one:**
Added a `cancelled` status to the `orders.status` enum before building rather than retrofitting it later. Staff will occasionally need to cancel orders (customer ordered by mistake, item no longer available mid-service). Cheaper to include it in the schema from the start.

**`total_amount` on `orders`:**
A denormalised snapshot of the order total at checkout time. Could be computed from `order_items` on the fly, but snapshotting it means the staff dashboard can display totals without joining across tables, and historical totals are preserved even if prices change.

### Tech stack chosen

React + Vite (frontend), FastAPI (backend), Supabase (PostgreSQL + Realtime + Auth for admin), Stripe Checkout (payments), Vercel (frontend deployment), Railway (backend deployment). Mirrors Ascend's stack almost exactly — the only new technology is Stripe.

### What's next

- Phase 1: Project scaffolding — repo setup, Vite frontend, FastAPI backend, Supabase schema creation and RLS policies, environment variables
- Phase 2: Customer menu flow — fetch and display menu from Supabase, cart in client-side state
- Phase 3: Stripe Checkout integration — the most technically critical phase

---

## Phase 1 — Project scaffolding
*Date: July 2026*

### What I built

- Git repo initialised and pushed to GitHub (private)
- Vite + React 19 frontend with React Router wired up for all five routes: `/table/:tableId`, `/cart`, `/confirmation`, `/staff`, `/admin`
- Supabase client initialised in `supabaseClient.js`, reading credentials from Vite env vars
- FastAPI backend with the full folder structure: `routes/`, `services/`, `models/`
- Skeleton route handlers for orders (checkout, webhook, status update, poll), menu (CRUD), and tables (lookup) — all returning 501 until implemented
- Pydantic models for `CartItem`, `CheckoutRequest`, `MenuItemCreate/Update`, `OrderStatusUpdate`
- Stripe service module scaffolded (`stripe_service.py`) — session creation stubbed out
- Supabase schema SQL (`supabase/schema.sql`) with all four tables and comments explaining key design decisions
- `.env.example` files for both frontend and backend
- `.gitignore` correctly excluding `.env`, `node_modules`, `__pycache__`, `dist`

### What broke / what was hard

`npm create vite@latest frontend -- --template react` passed `react` as a positional argument rather than the template flag, scaffolding a plain TypeScript project instead of React. Had to delete it and use `npx create-vite@latest frontend --template react` directly. Minor but a good reminder that the `npm create` forwarding syntax behaves differently to `npx` with flags.

### What I learned

- The `npm create` forwarding syntax (`--`) doesn't reliably pass `--template` to the underlying package — use `npx create-vite@latest` directly instead
- FastAPI's module import structure requires `__init__.py` in each package directory, otherwise relative imports fail at startup
- Vite injects env vars at build time, not runtime — `import.meta.env.VITE_*` only works for variables prefixed with `VITE_`, and they must be present at build time for production

### Decisions made

- **Private GitHub repo from the start**: this project will eventually have Stripe keys and Supabase credentials in the environment — keeping the repo private is a basic hygiene step even though keys are gitignored.
- **Skeleton routes returning 501**: rather than leaving route files empty, each endpoint has a docstring explaining its role and a `raise HTTPException(status_code=501)` placeholder. This means the FastAPI server starts cleanly and the auto-generated `/docs` page already shows the full API surface before any logic is implemented.
- **Schema SQL in `supabase/schema.sql`**: keeping the schema as a committed SQL file means there's a source-of-truth version-controlled alongside the code, not just in the Supabase dashboard.
- **Why FastAPI exists alongside Supabase**: Supabase's auto-generated REST API handles most of the project — menu reads, order status updates, admin CRUD, and Realtime are all consumed directly by the frontend JS client. FastAPI is load-bearing for exactly three things that require a server you control: (1) creating the Stripe Checkout session, because `STRIPE_SECRET_KEY` can never be in the browser; (2) server-side total verification — recomputing the cart total from actual DB prices before creating the session, because a client-sent total can be tampered with; (3) receiving and verifying the Stripe webhook before writing the order. An alternative would be Supabase Edge Functions for these two endpoints, which would eliminate Railway entirely — worth considering once Stripe is familiar.

### What's next

Phase 2: customer menu flow — connect to Supabase, fetch `menu_items` where `available = true`, display grouped by category, build cart in client-side React state (no DB writes until payment confirmed).

---

## Phase 2 — Customer menu flow
*Date: July 2026*

### What I built
<!-- Fill this in -->

### What broke / what was hard
<!-- Fill this in -->

### What I learned
<!-- Fill this in -->

### Decisions made
<!-- Fill this in -->

### What's next
<!-- Fill this in -->

---

## Phase 3 — Stripe Checkout integration
*Date: July 2026*

### What I built
<!-- Fill this in -->

### What broke / what was hard
<!-- Stripe integration almost always has surprises — document them here -->
<!-- Webhook verification issues? Local testing with Stripe CLI? Redirect URL issues? -->

### What I learned
<!-- Fill this in — this will be the richest section given Stripe is new -->

### Decisions made
<!-- Fill this in -->

### What's next
<!-- Fill this in -->

---

## Phase 4 — Staff dashboard
*Date: July/August 2026*

### What I built
<!-- Fill this in -->

### What broke / what was hard
<!-- Supabase Realtime edge cases? Connection handling? -->

### What I learned
<!-- Fill this in -->

### Decisions made
<!-- Fill this in -->

### What's next
<!-- Fill this in -->

---

## Phase 5 — Admin panel
*Date: August 2026*

### What I built
<!-- Fill this in -->

### What broke / what was hard
<!-- Fill this in -->

### What I learned
<!-- Fill this in -->

### Decisions made
<!-- How did you protect the admin routes? -->

### What's next
<!-- Fill this in -->

---

## Phase 6 — QR codes + deployment
*Date: August 2026*

### What I built
<!-- Fill this in -->

### What broke / what was hard
<!-- Deployment always has surprises — CORS, environment variables, Railway cold starts, webhook URLs -->

### What I learned
<!-- Fill this in -->

### Decisions made
<!-- Fill this in -->

### Reflection
<!-- Once live with real customers:
- Did the system hold up under real usage?
- What broke in production that didn't break in testing?
- What would you do differently?
- What was the most technically challenging part?
- How does building for a real client differ from building a personal project?
These are all interview questions — answer them here while it's fresh -->

---

## Key technical decisions (running list)

| Decision | Alternatives considered | Why I chose this |
|---|---|---|
| Stripe Checkout over custom form | Stripe Elements, custom card form | PCI-DSS compliance — card data must never touch my server |
| Order written only after webhook | Write on redirect, write on frontend | Prevents unpaid orders appearing on staff dashboard |
| Server-side total computation | Trust client-sent total | Security — client totals can be tampered with |
| Supabase Realtime for staff dashboard | WebSockets (custom), polling | Already familiar from Ascend, right tool for "notify on row insert" |
| No customer accounts | Optional auth, required auth | Frictionless UX — scan, order, pay, done |
| Bar counter orders kept traditional | Bar counter as a virtual "table" | Wetherspoons model — simpler, proven at scale, no benefit to merging |
| ON DELETE SET NULL for menu_item_id | CASCADE, RESTRICT | Preserves order history when menu items are deleted |
| Price + name snapshots on order_items | Live joins to menu_items | Historical orders must not be affected by future menu changes |

---

## Problems solved (running list)

| Problem | Cause | Solution |
|---|---|---|
| | | |

---

*Started: July 2026*
*Target completion: August 2026*
*Status: Live at [URL once deployed]*
