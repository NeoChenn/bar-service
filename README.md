# Bar Ordering System

A QR-code table ordering system for a family bar. Customers scan a QR code at their table, browse the menu, and pay via Stripe Checkout from their phone — no queuing at the bar. On successful payment, the order appears live on the staff dashboard via Supabase Realtime.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Backend | Python + FastAPI |
| Database + Realtime | Supabase (PostgreSQL + Supabase Realtime) |
| Payments | Stripe Checkout (hosted) |
| Frontend deployment | Vercel |
| Backend deployment | Railway |

## How it works

1. Customer scans a QR code at their table → lands on `/table/:tableId`
2. Browses the menu, adds items to a cart (client-side state only)
3. Clicks checkout → backend creates a Stripe Checkout session → customer pays on Stripe's hosted page
4. Stripe fires a webhook → backend verifies the signature → order is written to the database
5. Order appears instantly on the staff dashboard via Supabase Realtime

Bar counter orders are handled traditionally — this system is for table service only.

## Project structure

```
bar-service/
├── frontend/               # React + Vite
│   └── src/
│       ├── pages/
│       │   ├── MenuPage.jsx          # customer menu for a specific table
│       │   ├── CartPage.jsx          # cart review before checkout
│       │   ├── ConfirmationPage.jsx  # post-payment confirmation
│       │   ├── StaffDashboard.jsx    # live order dashboard
│       │   └── AdminPanel.jsx        # menu management (parents)
│       ├── supabaseClient.js
│       └── App.jsx
├── backend/                # FastAPI
│   ├── main.py
│   ├── routes/
│   │   ├── orders.py       # Stripe session creation + webhook handler
│   │   ├── menu.py         # menu CRUD for admin panel
│   │   └── tables.py       # table lookup
│   ├── services/
│   │   └── stripe_service.py
│   └── models/
│       └── models.py       # Pydantic request/response models
└── supabase/
    └── schema.sql          # database schema
```

## Local setup

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
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

Run `supabase/schema.sql` in the Supabase SQL editor to create all four tables.

## Environment variables

**`backend/.env`**
```
SUPABASE_URL=
SUPABASE_KEY=
STRIPE_SECRET_KEY=        # sk_test_... during development
STRIPE_WEBHOOK_SECRET=    # from Stripe dashboard webhook setup
FRONTEND_URL=http://localhost:5173
```

**`frontend/.env`**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=   # pk_test_... during development
VITE_API_URL=http://localhost:8000
```

## Build status

| Phase | Status |
|---|---|
| 1 — Project scaffolding | ✓ Done |
| 2 — Customer menu flow | In progress |
| 3 — Stripe Checkout integration | — |
| 4 — Staff dashboard | — |
| 5 — Admin panel | — |
| 6 — QR codes + deployment | — |
