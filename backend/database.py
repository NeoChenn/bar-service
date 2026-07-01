import os
from supabase import create_client

# Service role key — bypasses RLS entirely, required for backend writes.
# This key must never be exposed to the frontend or committed to the repo.
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY"),
)
