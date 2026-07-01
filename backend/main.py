import os
from dotenv import load_dotenv

# Must be called before importing any module that reads env vars at module level
# (stripe_service.py sets stripe.api_key on import; database.py creates the
# Supabase client on import — both need the env vars already loaded).
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import orders, menu, tables, auth, analytics, assistant

app = FastAPI(title="Bar Ordering System")

# Allow requests from the frontend only — tightened in production to the
# deployed Vercel URL via the FRONTEND_URL environment variable.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(menu.router, prefix="/menu", tags=["menu"])
app.include_router(tables.router, prefix="/tables", tags=["tables"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(assistant.router, prefix="/assistant", tags=["assistant"])


@app.get("/health")
def health_check():
    """Used by Railway to confirm the service is running."""
    return {"status": "ok"}
