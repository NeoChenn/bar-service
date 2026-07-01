from fastapi import APIRouter, HTTPException
from models.models import MenuItemCreate, MenuItemUpdate
from database import supabase

router = APIRouter()


@router.get("/")
async def list_menu_items():
    """Return all available menu items. Not used by the frontend (calls Supabase directly)."""
    # TODO (Phase 6 or deployment — kept as a stub for now)
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.post("/")
async def create_menu_item(body: MenuItemCreate):
    """Admin: add a new item to the menu."""
    result = supabase.from_("menu_items").insert(body.model_dump()).execute()
    return result.data[0]


@router.patch("/{item_id}")
async def update_menu_item(item_id: str, body: MenuItemUpdate):
    """Admin: edit name, description, price, category, or availability."""
    existing = supabase.from_("menu_items").select("id").eq("id", item_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Menu item not found")

    # Only send fields that were explicitly provided — None means "not set"
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.from_("menu_items").update(updates).eq("id", item_id).execute()
    return result.data[0]


@router.delete("/{item_id}")
async def delete_menu_item(item_id: str):
    """
    Admin: delete a menu item.
    order_items.menu_item_id uses ON DELETE SET NULL so historical orders are preserved.
    """
    existing = supabase.from_("menu_items").select("id").eq("id", item_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Menu item not found")

    supabase.from_("menu_items").delete().eq("id", item_id).execute()
    return {"deleted": item_id}
