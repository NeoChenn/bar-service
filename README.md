# Bar Ordering System

A QR-code table ordering system for a family bar. Customers scan a QR code at their table, browse the menu, and pay via Stripe Checkout from their phone — no queuing at the bar. On successful payment, the order appears live on the staff dashboard via Supabase Realtime.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Backend | Python + FastAPI |
| Database + Realtime | Supabase (PostgreSQL + Supabase Realtime) |
| Payments | Stripe Checkout (hosted) |
| Charts | Recharts |
| LLM | Claude Haiku (Anthropic) |
| Frontend deployment | Vercel |
| Backend deployment | Railway |

## How it works

### Customer flow
1. Scan a QR code at the table → `/table/:tableId`
2. Browse the menu by category, add items to cart (client-side state)
3. Optional: open the 💬 menu assistant to get personalised recommendations
4. Checkout → backend creates a Stripe Checkout session → customer pays on Stripe's hosted page
5. Stripe fires a webhook → backend verifies signature → order written to database
6. Order appears instantly on the staff dashboard via Supabase Realtime

Bar counter orders are handled traditionally — this system is for table service only.

### Staff flow
- `/staff` — live dashboard of active (pending/preparing) orders; status updates in real time
- `/history` — full order history, searchable by date range, status, and table number

### Admin flow (parents/owners)
- `/admin` — menu management: add/edit/delete items, toggle availability
- `/analytics` — revenue over time, busiest hours, top-selling items, average order value

## Project structure

```
bar-service/
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── MenuPage.jsx            # customer menu for a specific table
│       │   ├── CartPage.jsx            # cart review before checkout
│       │   ├── ConfirmationPage.jsx    # post-payment confirmation + polling
│       │   ├── StaffDashboard.jsx      # live active-order dashboard
│       │   ├── OrderHistory.jsx        # searchable full order history
│       │   ├── AdminPanel.jsx          # menu CRUD (admin only)
│       │   └── AnalyticsDashboard.jsx  # revenue + sales analytics (admin only)
│       ├── components/
│       │   ├── ProtectedRoute.jsx      # inline password prompt for staff/admin routes
│       │   └── MenuAssistant.jsx       # floating LLM chat bubble on the menu page
│       ├── context/
│       │   └── CartContext.jsx         # cart state (React Context + useReducer)
│       ├── supabaseClient.js
│       └── App.jsx
├── backend/
│   ├── main.py
│   ├── database.py                     # Supabase client singleton (service role)
│   ├── routes/
│   │   ├── orders.py                   # Stripe session, webhook, order history
│   │   ├── menu.py                     # menu CRUD
│   │   ├── tables.py                   # table lookup
│   │   ├── auth.py                     # staff/admin password verification
│   │   ├── analytics.py                # revenue + sales aggregation
│   │   └── assistant.py               # LLM menu assistant endpoint
│   ├── services/
│   │   └── stripe_service.py
│   └── models/
│       └── models.py
└── supabase/
    └── schema.sql
```

## Local setup

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
cp .env.example .env        # fill in your credentials
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env        # fill in your credentials
npm run dev
```

### Database

Run `supabase/schema.sql` in the Supabase SQL editor to create all tables and RLS policies.

## Environment variables

**`backend/.env`**
```
SUPABASE_URL=
SUPABASE_KEY=               # service role key (bypasses RLS — backend only)
STRIPE_SECRET_KEY=          # sk_test_... during development
STRIPE_WEBHOOK_SECRET=      # from Stripe dashboard webhook setup
FRONTEND_URL=http://localhost:5173
STAFF_PASSWORD=             # shared password for /staff and /history
ADMIN_PASSWORD=             # shared password for /admin and /analytics
ANTHROPIC_API_KEY=          # for the LLM menu assistant
```

**`frontend/.env`**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_KEY=          # anon key (subject to RLS)
VITE_API_URL=http://localhost:8000
```

## Routes

| Path | Access | Description |
|---|---|---|
| `/table/:tableId` | Public | Customer menu page |
| `/cart` | Public | Cart review + checkout |
| `/confirmation` | Public | Post-payment confirmation |
| `/staff` | Staff password | Live active-order dashboard |
| `/history` | Staff password | Full order history with filters |
| `/admin` | Admin password | Menu CRUD |
| `/analytics` | Admin password | Revenue + sales analytics |

## Build status

| Phase | Status |
|---|---|
| 1 — Project scaffolding | ✓ Done |
| 2 — Customer menu flow | ✓ Done |
| 3 — Stripe Checkout integration | ✓ Done |
| 4 — Staff dashboard | ✓ Done |
| 5 — Admin panel | ✓ Done |
| 6 — QR code generation | In progress |
| 7 — Analytics dashboard | ✓ Done |
| 8 — Order history / receipt view | ✓ Done |
| 9 — LLM menu assistant | ✓ Done |
| 10 — Polish and deployment | In progress |
