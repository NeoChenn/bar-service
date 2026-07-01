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

### What I learned

- **FastAPI needs `__init__.py` in every package directory**: Without them, Python doesn't treat the folders as packages and relative imports fail at startup.
up
### Decisions made

- **Private GitHub repo from the start**: this project will eventually have Stripe keys and Supabase credentials in the environment — keeping the repo private is a basic hygiene step even though keys are gitignored.
- **Skeleton routes returning 501**: rather than leaving route files empty, each endpoint has a docstring explaining its role and a `raise HTTPException(status_code=501)` placeholder. This means the FastAPI server starts cleanly and the auto-generated `/docs` page already shows the full API surface before any logic is implemented.
- **Schema SQL in `supabase/schema.sql`**: keeping the schema as a committed SQL file gives you four things the Supabase dashboard alone doesn't: (1) **version control** — you can look at any past commit and see exactly what the DB looked like at that point, which matters when debugging a production bug introduced by a schema change; (2) **reproducibility** — setting up a second Supabase project (staging environment, disaster recovery, wiping and starting fresh) is one SQL file, not clicking through the dashboard trying to remember every column and constraint; (3) **single source of truth** — the dashboard is a GUI on top of the database and can be accidentally modified; the SQL file is the canonical definition you can always compare against; (4) **a foundation for migrations** — once the system is live with real data you can't drop and recreate tables, you'll need ALTER TABLE statements. Having the original schema committed gives you a clear baseline to reason from when writing those migrations.
- **Why FastAPI exists alongside Supabase**: Supabase's auto-generated REST API handles most of the project — menu reads, order status updates, admin CRUD, and Realtime are all consumed directly by the frontend JS client. FastAPI is load-bearing for exactly three things that require a server you control: (1) creating the Stripe Checkout session, because `STRIPE_SECRET_KEY` can never be in the browser; (2) server-side total verification — recomputing the cart total from actual DB prices before creating the session, because a client-sent total can be tampered with; (3) receiving and verifying the Stripe webhook before writing the order. An alternative would be Supabase Edge Functions for these two endpoints, which would eliminate Railway entirely — worth considering once Stripe is familiar.

### What's next

Phase 2: customer menu flow — connect to Supabase, fetch `menu_items` where `available = true`, display grouped by category, build cart in client-side React state (no DB writes until payment confirmed).

---

## Phase 2 — Customer menu flow
*Date: July 2026*

### What I built

- `CartContext.jsx` — shared cart state using React Context + useReducer, persisted to `localStorage` so the cart survives page refreshes. State shape: `{ tableId, items: [{ id, name, price, quantity }] }`. Actions: `SET_TABLE`, `ADD_ITEM`, `UPDATE_QUANTITY`, `REMOVE_ITEM`, `CLEAR_CART` (stubbed for Phase 3). `total` is derived and passed down through context.
- `MenuPage.jsx` — on mount, runs table validation and menu fetch in parallel using `Promise.all`. If the table UUID from the URL doesn't exist in the DB, renders an error and stops — bad QR codes go nowhere. Menu items grouped by category client-side with a `reduce`. Each item shows an "Add" button when qty is 0, or inline −/+ controls once in the cart. Sticky "View order (N items) →" bar appears at the bottom when the cart is non-empty.
- `CartPage.jsx` — reads entirely from CartContext (no Supabase calls). Shows each item with −/+ controls, a × remove button, per-line totals, and a running order total. "← Back to menu" links back to `/table/:tableId` using the tableId stored in context. Checkout button is rendered but disabled — Phase 3 will wire it up.
- `App.jsx` — wrapped with `<CartProvider>` so cart state is available across all routes.

### What I learned

- **React Context + useReducer is the right tool for shared client-side state of this scale**: the cart needs to be readable and writable from multiple pages (MenuPage adds items, CartPage adjusts them). Context avoids prop drilling without reaching for an external library. `useReducer` is preferable to `useState` here because all cart mutations are discrete, named actions — easier to reason about and extend (e.g. `CLEAR_CART` for Phase 3 was added now at no cost).
- **`localStorage` persistence needs a lazy initialiser, not a `useEffect`**: if you initialise state with `useReducer(reducer, { tableId: null, items: [] })` and then rehydrate from `localStorage` in a `useEffect`, there's a render flash where the cart appears empty before the effect runs. Using the third argument of `useReducer` (the initialiser function) loads from `localStorage` synchronously before the first render — no flash.
- **`Promise.all` for parallel Supabase queries**: table validation and menu fetch are independent — running them sequentially would double the load time for no reason. `Promise.all` fires both simultaneously and waits for both to resolve.
- **Data reads go directly from React to Supabase — no FastAPI involved**: the FastAPI backend has nothing to do in Phase 2. Menu reads and table lookups go through the Supabase JS client. FastAPI only enters the picture in Phase 3 for Stripe session creation and webhook handling.
- **How `useReducer` works**: `useReducer` is a stricter alternative to `useState`. Instead of setting state directly, you dispatch a named action object (`{ type: 'ADD_ITEM', item: ... }`) and a reducer function decides what the new state looks like: `(currentState, action) => newState`. The reducer is a pure function — same inputs always produce the same output, no side effects. Crucially, it never mutates state directly; it always returns a new object (using spread `{ ...state, ... }`), because React needs a new reference to know something changed and trigger a re-render.
- **The reducer is the single source of truth for what can happen to the cart**: every possible cart mutation has a named case in the switch statement. This makes it easy to audit — if you want to know "what can change the cart?", you read the reducer. Compare this to `useState` scattered across components, where mutations could happen anywhere.
- **Supabase has two separate layers of access control — both are required**: (1) a PostgreSQL `GRANT` determines whether a role can touch a table at all; (2) an RLS policy determines which rows within that table the role can see. A policy without a grant gives error `42501` (permission denied). A grant without a policy means the role can see every row. You need both. Older Supabase projects auto-granted `SELECT` to the `anon` role on every new table; newer projects don't — you have to be explicit, which is the safer default.
- **The publishable key and the `anon` PostgreSQL role are two different things that work together**: the publishable key (formerly called the anon key — same thing, just rebranded) is what goes in `.env` and is sent in the `Authorization` header on every frontend request. When Supabase receives a request with that key, it executes the query as the `anon` PostgreSQL role inside the database. That's the connection between them. The service role key works the same way but maps to the `service_role` PostgreSQL role, which bypasses RLS entirely — which is why the FastAPI backend will use it in Phase 3 to write orders without needing any insert policies.
- **CORS is a browser-only enforcement mechanism**: it only fires when JavaScript in a browser makes a fetch request to a different origin (different protocol, domain, or port). It will matter in Phase 3 when the React frontend (`localhost:5173`) calls the FastAPI backend (`localhost:8000`) — that's why `main.py` already has `CORSMiddleware` configured. It doesn't apply to server-to-server calls, which is why Stripe can POST to the FastAPI webhook without any CORS headers. Supabase handles CORS for its own API — we never had to configure it.


### Decisions made

- **Cart state lives in Context, not URL or server**: the cart is intentionally ephemeral and per-session. There are no customer accounts, so there's no user ID to attach it to. Context + localStorage is the right scope — lightweight, no auth required, survives refreshes.
- **`CLEAR_CART` action stubbed now**: the checkout flow (Phase 3) needs to clear the cart after a successful payment. Rather than adding the action later and hunting for where it should live, it's defined in the reducer now. Cheap to include, annoying to retrofit.
- **Checkout button disabled rather than absent**: rendering a disabled "Proceed to checkout" button in CartPage (rather than omitting it entirely) makes the UI feel complete and sets the right expectation for Phase 3. The `title` attribute explains it's coming soon.
- **`SET_TABLE` dispatched on every MenuPage load**: even if the tableId is already in localStorage, we re-dispatch `SET_TABLE` on mount. This handles the case where a customer scans a different table's QR code in the same browser session — the cart updates to the new table rather than silently using a stale one.

### What's next

Phase 3: Stripe Checkout integration — the most technically critical phase. Implement the FastAPI `/orders/checkout` endpoint (server-side total verification, Stripe session creation), the `/orders/webhook` handler (signature verification, writing `orders` + `order_items` to DB), and wire up the checkout button in CartPage. Also implement the ConfirmationPage polling loop.

---

## Phase 3 — Stripe Checkout integration
*Date: July 2026*

### What I built

- `backend/database.py` — Supabase Python client singleton initialised with the service role key, imported wherever the backend needs to read/write the DB
- `POST /orders/checkout` — receives cart from frontend, fetches current prices from Supabase (never trusts client-sent prices), validates every item is available, builds Stripe `line_items` with amounts in pence, stores a cart snapshot in Stripe session metadata, returns the Stripe Checkout session URL
- `POST /orders/webhook` — verifies the `Stripe-Signature` header, handles `checkout.session.completed`, checks for duplicate session (idempotency), writes `orders` and `order_items` rows to Supabase using the snapshotted cart from metadata
- `GET /orders/by-session/{session_id}` — poll endpoint for the confirmation page; returns 404 until the webhook has written the order, then returns the order with its items
- `CartPage.jsx` — checkout button now POSTs to `/orders/checkout`, redirects to Stripe's hosted page with `window.location.href`, handles loading and error states
- `ConfirmationPage.jsx` — on mount clears the cart and polls the backend every 2 seconds for up to 30 seconds; shows a confirmed order summary on success, a graceful fallback message on timeout (webhook delayed but payment succeeded), and an error state if no session ID is in the URL
- Fixed `main.py` to call `load_dotenv()` before importing routes — it was called after, meaning `stripe_service.py` and `database.py` would read `None` for all env vars at startup
- Updated `schema.sql`: renamed `stripe_payment_intent_id` → `stripe_session_id` (the session ID is what Stripe puts in the redirect URL and what's available on the webhook event)

### What broke / what was hard

- **`load_dotenv()` was called after route imports in `main.py`**: `stripe_service.py` sets `stripe.api_key = os.getenv("STRIPE_SECRET_KEY")` at module level, and `database.py` creates the Supabase client at module level. Both happen when the routes are imported — before `load_dotenv()` had run. The fix was to move `load_dotenv()` to the very top of `main.py`, before any imports that depend on env vars.


### What I learned

**The core Stripe Checkout flow:**
Rather than building a custom checkout form, Stripe Checkout is a Stripe-hosted payment page that handles card data, PCI compliance, 3D Secure authentication, and fraud detection entirely on Stripe's side. My code never touches card numbers. The flow is: backend creates a Checkout Session → frontend redirects the customer to Stripe's hosted page → customer pays → Stripe redirects back to my success URL → Stripe fires a webhook to my backend → backend verifies the webhook and writes the order to the database.

- **Why orders are only written after the webhook, not on redirect**: the redirect back to `/confirmation` happens immediately after payment — but the webhook is the reliable confirmation that payment actually succeeded. Writing the order on redirect would risk creating orders for abandoned or failed payments. The webhook is the source of truth.
- **Webhook signature verification**: every webhook must be verified using the webhook secret before processing. Without verification, anyone could POST a fake "payment succeeded" payload to `/orders/webhook` and get free orders. Stripe signs every webhook event — the backend uses `stripe.Webhook.construct_event()` to verify the signature before touching any data. The raw request body must be used for this — if FastAPI parses the body as JSON first, the bytes change and the signature check always fails.
- **The two different Stripe secrets**: `STRIPE_SECRET_KEY` (`sk_test_...`) is the API key used to create sessions and make API calls. `STRIPE_WEBHOOK_SECRET` (`whsec_...`) is used specifically to verify webhook signatures. These are completely different and serve different purposes.
- **Server-side total computation**: the frontend sends only item IDs and quantities — never prices. The backend fetches current prices from Supabase, computes the total, and creates the Stripe session with that amount. A malicious user could tamper with a client-sent total, so prices must always come from the database.
- **Amounts are in the smallest currency unit**: Stripe amounts are always in pence (GBP) or cents (USD) — never floats. £8.50 = `850`. Passing `8.50` directly would charge £0.0850. Always multiply by 100 when sending to Stripe, divide by 100 when reading `amount_total` back.
- **The metadata trick**: Stripe doesn't store your order data — only payment data. The `metadata` field on a Checkout Session is a key-value store you attach when creating the session (`table_id`, cart items etc.) that Stripe passes back in the webhook payload. This is how the webhook handler knows what order to write to the database without re-querying for prices (which could have changed between session creation and webhook delivery).
- **Frontend fallback polling**: webhooks can occasionally fail or arrive late. After Stripe redirects to `/confirmation`, the frontend polls the backend every 2 seconds for up to 30 seconds to confirm the order was written — a defensive fallback so customers don't see a confusing confirmation page if the webhook is delayed.
- **Webhook idempotency**: Stripe retries webhooks that don't receive a 2xx response for up to 72 hours. If the handler runs twice for the same event, it must not write duplicate orders. The fix: check if an order with the same `stripe_session_id` already exists before inserting, and return 200 immediately if it does.
- **`{CHECKOUT_SESSION_ID}` is a Stripe template literal in success URLs**: setting `success_url = ".../confirmation?session_id={CHECKOUT_SESSION_ID}"` causes Stripe to substitute the real session ID before redirecting. This is how the confirmation page knows which session to poll for.
- **Python virtual environments and `load_dotenv()` ordering**: Python packages must be explicitly installed into a virtual environment (`pip install -r requirements.txt`). And `load_dotenv()` must be called before any module-level code that reads env vars — Python runs module-level code at import time, so any module importing before `load_dotenv()` runs will get `None` for all env vars.

### Decisions made

- **Cart snapshot in metadata over re-fetching prices in the webhook**: the webhook could re-query Supabase for prices, but that adds a DB round-trip and introduces a race condition (what if a price changed between checkout and webhook?). Snapshotting the server-computed prices into metadata is simpler, faster, and guarantees the order records exactly what the customer paid for.
- **`stripe_session_id` instead of `stripe_payment_intent_id` on the orders table**: the session ID is the natural key here — it's what Stripe puts in the redirect URL and what's on the webhook event without any extra API calls. The payment intent ID is also available but not needed for any current use case.
- **Confirmation page clears the cart on mount, not after polling confirms**: payment was already confirmed by Stripe before redirecting to `/confirmation` (Stripe only redirects on success). Waiting for the webhook poll to clear the cart would leave it populated during the "Confirming your order..." screen, which is confusing. Clearing immediately is correct.
- **`GET /orders/by-session/{session_id}` as a separate endpoint from `GET /orders/{order_id}`**: the confirmation page only knows the Stripe session ID (from the URL), not the internal order UUID. Keeping them as separate endpoints is cleaner than trying to detect which type of ID was passed. `/{order_id}` stays as a UUID lookup for the staff dashboard (Phase 4).

### What's next

Phase 4: staff dashboard — Supabase Realtime subscription on the `orders` table so new orders appear live, order status updates (pending → preparing → served / cancelled), implement `GET /orders/` and `PATCH /orders/{order_id}/status` in the backend.

---

## Phase 4 — Staff dashboard
*Date: July 2026*

### What I built

- `GET /orders/` — returns all orders joined with `order_items` and `tables(table_number)`, newest first, using the Supabase nested select syntax
- `PATCH /orders/{order_id}/status` — validates the order exists (404 if not), updates status, returns the updated row. `OrderStatusUpdate` Pydantic model tightened from `str` to `Literal["preparing", "served", "cancelled"]` so FastAPI rejects invalid values before they reach the DB
- `StaffDashboard.jsx` — on mount fetches all orders from `GET /orders/`, subscribes to Supabase Realtime INSERT events on `orders`, re-fetches on each new insert to get the complete joined data. Status update buttons call `PATCH /orders/{id}/status` and update local state optimistically. Colour-coded status badges (amber/blue/green/grey). Action buttons only shown for non-terminal states
- Schema updated: `GRANT ALL` on all tables to `service_role`, `GRANT SELECT` on `orders` and `order_items` to `anon`

### What broke / what was hard

- **`StripeObject` is not a plain dict**: the Stripe Python SDK's `construct_event()` returns a `StripeObject`, not a regular Python dict. Calling `.get()` on it raises `AttributeError: get` because `StripeObject.__getattr__` tries to look up `"get"` as a key, not as a method. `dict(StripeObject)` also fails — it tries numeric indices and hits `KeyError: 0`. The fix: once the signature is verified, parse the raw `payload` bytes as a plain JSON dict with `json.loads(payload)` and use that instead of the StripeObject.
- **Supabase `service_role` still needs PostgreSQL GRANTs**: the service role key bypasses RLS (row-level security policies) but not PostgreSQL table-level permissions, which are a separate access control layer. The backend was getting `permission denied for table orders` (error 42501) even with the service role key. Fix: `GRANT ALL ON public.<table> TO service_role` for each table. I had assumed the service role had blanket access — it bypasses RLS, but table-level GRANTs are still enforced.

**Supabase Realtime:**

**What it is:**
Supabase Realtime is a WebSocket-based service built on top of PostgreSQL's logical 
replication. When rows are inserted or updated in the database, Supabase detects the 
change via the Write-Ahead Log (WAL) and pushes it to subscribed clients in milliseconds 
— no polling needed.

**Why it uses logical replication:**
PostgreSQL's WAL is a sequential log of every database change, originally designed for 
keeping replica servers in sync. Supabase taps into this stream for a different purpose — 
forwarding change events to connected WebSocket clients in real time. No physical copy of 
the data is made; Supabase just reads the stream and forwards relevant events.

**How it works in the staff dashboard:**
On mount, the dashboard fetches all existing orders from Supabase. It then subscribes to 
postgres_changes events on the orders table — INSERT for new orders appearing live, UPDATE 
for status changes (pending → preparing → served). The subscription is cleaned up on 
component unmount via supabase.removeChannel(channel) to prevent memory leaks, same 
principle as unsubscribing from auth state changes in Ascend.

**The key pattern:**
Fetch existing data first, then subscribe for future changes. The subscription only captures 
changes that happen after subscribing — it does not retroactively deliver existing rows.

**RLS and Realtime:**
Realtime respects RLS policies. If a user doesn't have SELECT permission on a table, they 
won't receive realtime events for it either. Staff need a shared authenticated login with 
full SELECT access to the orders table since there are no per-customer accounts.

**Realtime payload doesn't include joined data** 
when a new `orders` row is inserted, the Realtime payload only contains the `orders` row — no `order_items`, no `table_number`. Rather than trying to patch the local state from the partial payload, the dashboard re-fetches `GET /orders/` on each INSERT event to get the fully joined data. Simpler and more correct.

### What I learned

- **Supabase has two separate access control layers**: (1) PostgreSQL GRANT — table-level permissions that apply to all roles including `service_role`; (2) RLS policies — row-level filters that `service_role` bypasses but `anon` must satisfy. Both layers are independent. The service role key bypassing RLS does not mean it bypasses GRANT. This is the same two-layer system as Phase 2, but now it bit us on the backend side too.
- **Supabase Realtime gives you INSERT rows, not joins**: the Realtime payload mirrors the raw database row — no foreign key resolution, no nested relations. If you need joined data (order items, table number) when a new row arrives, you have to fetch it separately. Re-fetching the full list is the simplest approach for small datasets.
- **`StripeObject` vs plain dict**: the Stripe Python SDK wraps API responses in `StripeObject`, which supports bracket access (`obj["key"]`) and attribute access (`obj.key`) but not `.get()`. Once you've verified the webhook signature, it's cleaner to work with `json.loads(raw_payload)` as a plain dict than to fight the SDK's object model.
- **`Literal` type in Pydantic**: using `Literal["preparing", "served", "cancelled"]` instead of `str` gives you automatic validation — FastAPI returns a 422 with a clear error message if an invalid status is posted, without writing any validation logic yourself. It also mirrors the `CHECK` constraint on the DB column, so the two layers of validation agree.

### Decisions made

- **Re-fetch full list on Realtime INSERT rather than appending the payload**: the Realtime payload only has the `orders` row, so appending it would show an order card with no items and no table number. Re-fetching `GET /orders/` is one extra network call but gives complete, correct data immediately.
- **`pending` excluded from `OrderStatusUpdate`**: orders enter the `pending` state only via the Stripe webhook — staff should never be able to set an order back to pending. Excluding it from the `Literal` type enforces this at the API level, not just the UI.

### What's next

Phase 5: admin panel — menu CRUD (add/edit/delete items, availability toggle), password-protected for parents.

---

## Phase 5 — Admin panel
*Date: July 2026*

### What I built

- `POST /auth/verify` FastAPI endpoint — receives `{ password, role }`, checks against `STAFF_PASSWORD` / `ADMIN_PASSWORD` env vars, returns the role on match or 401. Password lives only in the backend env, never in the frontend bundle.
- `POST /menu/`, `PATCH /menu/{id}`, `DELETE /menu/{id}` — full menu CRUD. PATCH uses partial updates (only non-None fields sent to Supabase). DELETE checks existence first and returns a clear 404 if the item doesn't exist. Historical orders are unaffected — `order_items.menu_item_id` uses `ON DELETE SET NULL`.
- `ProtectedRoute.jsx` — wraps `/staff` and `/admin`. Checks `sessionStorage` for `bar_role`; if missing, renders an inline password prompt on the page itself (no redirect, no separate login page). Posts to `/auth/verify`, on success sets sessionStorage and renders children. Sign-out clears sessionStorage.
- `AdminPanel.jsx` — fetches menu directly from Supabase (anon already has SELECT), groups by category. Add item form doubles as an edit form (pre-populated when "Edit" is clicked). Availability toggle and delete with confirm dialog. Re-fetches after every write.

### What broke / what was hard

Nothing broke in this phase — it was mostly straightforward CRUD. The main design challenge was the auth approach (see decisions made).

### What I learned

- **`sessionStorage` vs `localStorage`**: `sessionStorage` clears when the tab or browser is closed; `localStorage` persists across sessions. For a shared staff tablet, `sessionStorage` is the right call — staff don't need to re-enter the password mid-shift, but the next person who opens the browser can't access the dashboard without entering it again.
- **Partial updates in Pydantic**: `MenuItemUpdate` has all Optional fields, but sending all of them (including `None`) to Supabase would overwrite existing values with nulls. The fix: `{k: v for k, v in body.model_dump().items() if v is not None}` — only send fields that were explicitly set. This lets the admin change just a price without touching the name or category.
- **`model_dump()` replaces `.dict()`**: in Pydantic v2 (used by FastAPI now), `.dict()` is deprecated. The correct method is `.model_dump()`. Same result, different name.

### Decisions made

- **Simple password auth over Supabase Auth**: the threat model is preventing casual access (a customer stumbling onto `/staff`), not protecting high-value secrets. A shared password checked server-side is appropriate. Supabase Auth would require email accounts, a login page, and session management — all overhead that adds friction for staff and complexity for no real security gain in a family bar context.
- **Inline password prompt, not a redirect**: redirecting unauthed users to `/login` would create a separate login page that looks like a public account system — confusing for customers who find it. Showing a minimal "Staff access — enter password" prompt inline on the page makes it clear it's not a public login.
- **sessionStorage over localStorage for auth state**: desired behaviour for a shared staff tablet is that closing the browser clears the session. localStorage would persist until explicitly signed out, which is a risk if a staff member forgets to sign out. sessionStorage resets naturally on browser close.
- **Admin panel reads from Supabase directly, writes via FastAPI**: anon already has SELECT on `menu_items` (from Phase 2), so there's no reason to proxy reads through FastAPI. Writes go through FastAPI because they need the service role key (which can't be in the frontend) and it keeps write logic server-side.

### What's next

Phase 6: QR code generation (one per table, encodes `/table/:id` URL, printable) and deployment to Vercel + Railway with production environment variables and the live Stripe keys.

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

## Phase 7 — Analytics dashboard
*Date: July 2026*

### What I built

- `GET /analytics/summary?days=N` FastAPI endpoint — returns all four metrics in one response: revenue bucketed by day/week/month, order count by hour of day (busiest hours), top 10 items by quantity and by revenue, and average order value. `days=0` means all time; any positive value filters to the last N days.
- `backend/routes/analytics.py` — aggregates entirely in Python using `collections.defaultdict`. Two Supabase queries (orders, then order_items for those order IDs), then grouping and sorting in Python.
- `AnalyticsDashboard.jsx` — four metric sections rendered with Recharts: a `LineChart` for revenue over time (with daily/weekly/monthly toggle that switches between pre-fetched arrays client-side), a `BarChart` for busiest hours (always all 24 hours, zero-filled), two horizontal `BarChart`s for top items (by quantity and by revenue). Period selector (Last 7 days / 30 days / 3 months / Last year / All time) triggers a re-fetch via `useEffect([days])`.
- Recharts installed (`npm install recharts`, 39 packages).
- `/analytics` route added to `App.jsx`, wrapped with `<ProtectedRoute role="admin">`.



### What I learned

- **Python-side aggregation over SQL functions**: At the scale of a small bar (~10MB/year of order data), fetching all matching orders and aggregating in Python is simpler and equally performant compared to writing and maintaining PostgreSQL functions. The tradeoff — slightly more data transferred over the network — is irrelevant at this scale. SQL functions would be the right choice at larger scale where pushing computation to the database reduces network overhead meaningfully.

- **Recharts**: A React charting library built on D3. Charts are composed from individual imported components — `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`. Key concepts:
  - `ResponsiveContainer` is non-optional — without it charts render at a fixed pixel width that breaks on mobile. `width="100%"` with a fixed pixel height is the standard pattern.
  - `dataKey` tells each axis, line, or bar which field in the data array to read from.
  - `tickFormatter` on `XAxis` formats axis labels (e.g. converting hour integer 14 to "14:00").
  - `layout="vertical"` on `BarChart` flips the axes — better for horizontal bars where the category labels (item names) are long strings that don't fit on the X axis.
  - `Tooltip` handles hover popups automatically, customisable with `formatter` for units like £.

### Decisions made

- **`status != 'cancelled'` rather than `status = 'served'`**: payment is confirmed at the point the Stripe webhook fires and the order is written to the DB. Pending and preparing orders represent real revenue that is almost certainly going to be fulfilled. Excluding them would undercount revenue during an active service. Only cancelled orders (which were explicitly rejected) should be excluded.
- **Single endpoint, all metrics**: all four metrics are computed in one request so the frontend doesn't need to coordinate multiple fetches. The period filter (`days`) applies to all metrics consistently — no risk of the revenue chart and top-items chart showing data from different time windows.
- **Revenue bucketing is a client-side toggle, not a re-fetch**: all three revenue arrays (daily, weekly, monthly) are returned in the single response. Switching between them in the UI is instant — no loading state, no network round-trip. This works because all three are cheap to compute on the same dataset.
- **`days=0` as "all time" sentinel**: rather than an optional parameter that could be `null` or absent, `0` is an explicit value meaning "no date cutoff". Simpler to pass in a query string and reason about.

### What's next

Phase 8: order history / receipt view — searchable list of past orders for staff (by date, table number, or status), with a full item breakdown on click. Useful for dispute resolution and reviewing past service.

---

## Phase 8 — Order history / receipt view
*Date: July 2026*

### What I built

- `GET /orders/history` FastAPI endpoint with four optional query params: `start_date`, `end_date`, `status`, `table_number`. All can be combined freely. Returns all matching orders with items and table number joined, newest first.
- `OrderHistory.jsx` — filter form at the top (date range, status dropdown, table number), Apply and Clear buttons, and a list of order cards below. Each card shows table number, timestamp, colour-coded status badge, the full item list with per-line subtotals (quantity × price\_at\_order), and the order total. Items are always rendered inline — no expand/collapse.
- `/history` route in `App.jsx`, staff-protected via `ProtectedRoute`.

### What broke / what was hard

- **FastAPI route ordering**: `GET /history` must be declared before `GET /{order_id}` in `orders.py`. FastAPI matches routes top-to-bottom — a parameterised route like `/{order_id}` captures any string segment, so placing `/history` after it means "history" gets matched as an order ID and the handler returns a 404. Static path segments must always come before parameterised ones in the same router.
- **Supabase can't filter on joined fields**: `table_number` lives on the `tables` table, joined into the result via `select("..., tables(table_number)")`. Supabase's chained ORM API only filters on columns of the base table. To filter by table number, the fix is a separate preliminary query to resolve `table_number → table_id`, then filter the orders query on `table_id` — a native column on `orders`.

### What I learned

- **FastAPI route ordering matters**: FastAPI matches routes in declaration order. Parameterised routes (`/{id}`) are greedy — they capture any value at that path position. Any specific, static sub-paths (like `/history`, `/by-session/{id}`) must be declared before parameterised catch-alls at the same level, or they will never be reached. This is different from Express.js, which is also order-sensitive, but it's easy to forget in FastAPI where route definitions are spread across files.
- **Supabase PostgREST filters only operate on the base table**: when you `.select("*, tables(table_number)")`, the `tables(table_number)` part is a nested resource resolved at the PostgREST layer — it's not a column you can filter on with `.eq()`. To filter by a value on a related table, resolve it to the FK column on the base table first (one extra query), then filter on that FK. For high-traffic endpoints this could be optimised with a DB view or raw SQL, but at this scale the extra query is fine.
- **`useEffect` with an object dependency — reference equality**: React's `useEffect` uses `Object.is` to compare dependency values between renders. Primitive values (strings, numbers) are compared by value; objects are compared by reference. Setting `setAppliedFilters({ ... })` always creates a new object reference, so the effect always fires when Apply is clicked — even if the filter values haven't changed. This is intentional behaviour: Apply should always re-fetch, not diff against the previous values.

### Decisions made

- **Apply button rather than auto-fetch**: date inputs fire `onChange` on every keystroke. Auto-fetching on change would send a request per character typed — noisy and unnecessary. An explicit Apply button gives the user control over when the fetch fires, which is also more natural for a date range where both fields usually need to be set before the result is meaningful.
- **`appliedFilters` object as the single `useEffect` dependency**: separates "what the user is currently typing in the form" from "what was last submitted". The effect only runs when Apply or Clear is pressed. This also makes Clear clean: reset the form state and set `appliedFilters` back to `{}` — the effect fires and re-fetches with no params.
- **Separate `/history` route rather than filters on the live dashboard**: the staff dashboard is intentionally minimal — a glanceable at-a-glance view during active service. Adding a date-range filter UI to it would clutter the page. A dedicated `/history` route keeps each view focused on one job.

### What's next

Phase 9: LLM menu assistant — conversational assistant embedded in the menu page, system prompt generated server-side from the live Supabase menu, Claude Haiku model.

---

## Phase 9 — LLM menu assistant
*Date: TBD*

### What I built

- `backend/routes/assistant.py` — `POST /assistant/` endpoint. Fetches all available menu items from Supabase, builds a dynamic system prompt, calls `claude-haiku-4-5` with the conversation history (capped at last 10 messages), and returns the assistant reply.
- `build_system_prompt()` — formats the live menu into a readable list injected into the system prompt, alongside behavioral rules (stay on-menu, never confirm allergens, match customer's language).
- `Message` and `AssistantRequest` Pydantic models for the request body.
- `frontend/src/components/MenuAssistant.jsx` — floating chat bubble (`position: fixed; bottom: 80px; right: 24px`) on the menu page. Clicking the 💬 button expands a 320×420 chat panel with: a header, an allergen disclaimer strip, a scrollable message history (auto-scrolls to latest), and an input form. User messages appear immediately in the UI before the API call completes.
- `MenuPage.jsx` updated to import and render `<MenuAssistant />`.
- `anthropic` added to `requirements.txt`.

### What broke / what was hard

- **Supabase returns NUMERIC as a Python `Decimal`**: `item['price']` comes back as a `Decimal` object, not a `float`. Calling `f"£{item['price']:.2f}"` in the system prompt raises `TypeError`. Fixed with an explicit `float()` cast: `f"£{float(item['price']):.2f}"`.
- **Chat bubble position**: initially placed at `bottom: 24px`, which overlapped the sticky cart bar (`position: sticky; bottom: 0`) when items were in the cart. Moved to `bottom: 80px` to clear it.

### What I learned

- **The system prompt**: a special message sent to the LLM before the conversation starts that defines the assistant's role, knowledge, and constraints. Unlike fine-tuning, it doesn't change the model — it primes it with instructions and domain context that apply to this specific conversation. The model treats it as authoritative. For this project, it contains the full live menu and rules about how to behave.

- **The Claude API is stateless — conversation history must be sent on every request**: Claude has no memory between calls. Every request must include the full conversation history so the model has context for the current message. The history is a list of alternating user/assistant messages. The frontend maintains this list in React state, appending each new message as the conversation progresses, and sends the full list on each turn.

- **History capping**: sending the full conversation forever grows the token count (and cost) linearly. Capping at the last 10 messages keeps costs predictable. The full history is still held in React state for display — only the recent window is sent to the API. For a menu recommendation conversation, 10 messages is more than enough context.

- **Dynamic system prompt from DB**: the menu is fetched fresh on every `/assistant/` request. If a menu item is marked unavailable mid-evening, the very next customer message gets a system prompt that excludes it — no cache invalidation, no staleness. This is only practical because the Supabase query is fast and the menu is small.

- **`useRef` for scroll-to-bottom**: React doesn't provide a built-in way to scroll a list container to its bottom when new items arrive. The pattern: attach a `ref` to an empty `<div>` at the end of the messages list, then call `ref.current?.scrollIntoView({ behavior: 'smooth' })` in a `useEffect` that runs whenever `messages` changes.

- **`position: fixed` for floating UI**: fixed-position elements are removed from the document flow entirely — they don't affect surrounding layout and don't scroll with the page. The chat bubble sits above everything regardless of scroll position. The tradeoff is that you have to account for other fixed/sticky elements manually (hence the `bottom: 80px` offset for the cart bar).

### Decisions made

- **System prompt built server-side from live DB, not hardcoded**: the menu is injected at request time from Supabase. Sending the menu from the frontend would let a customer modify it before sending — a trivial prompt injection. Fetching server-side means the model always has the real menu and customers can't influence what it knows.
- **History capped at 10 messages server-side**: the full history stays in React state for display, but only the last 10 messages go to Claude. This bounds token cost per request regardless of conversation length. 10 messages is sufficient context for a menu recommendation flow.
- **`claude-haiku-4-5` for cost efficiency**: the task is recommendation from a structured menu, not complex reasoning. Haiku handles it well and keeps cost at fractions of a penny per conversation — appropriate for a high-volume customer-facing feature.
- **Floating bubble rather than inline chat**: embedding the chat inline would push menu content down and disrupt browsing. A fixed floating bubble is a pattern customers recognise from support widgets — discoverable without being intrusive, and closeable without leaving the page.
- **Allergen disclaimer in both the UI and the system prompt**: the UI strip ensures every customer sees it the moment they open the panel, regardless of what they ask. The system prompt rule ensures the model reinforces it whenever allergens come up in conversation. Belt and braces.

### What's next

Phase 6: QR code generation — one unique QR code per table, each encoding the `/table/:id` URL for that table. Printable format for laminating at tables.

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
| Dynamic system prompt for LLM assistant | Hardcode menu in prompt, send menu from frontend | Menu fetched server-side and injected at request time — prevents client tampering and keeps context fresh from DB |
| Recharts for analytics visualisation | Chart.js, D3, Victory | Recharts is React-native (components, not imperative canvas) and has sensible defaults for the charts needed here |
| Order history kept permanently | Auto-delete after N days | Business value for dispute resolution and trend analysis outweighs storage cost (~10MB/year at this bar's scale) |

---

## Problems solved (running list)

| Problem | Cause | Solution |
|---|---|---|
| | | |

---

*Started: July 2026*
*Target completion: August 2026*
*Status: Live at [URL once deployed]*
