from fastapi import APIRouter, HTTPException
from models.models import MenuItemCreate, MenuItemUpdate

router = APIRouter()


@router.get("/")
async def list_menu_items():
    """Return all available menu items, grouped by category for the customer menu."""
    # TODO (Phase 2)
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.post("/")
async def create_menu_item(body: MenuItemCreate):
    """Admin: add a new item to the menu."""
    # TODO (Phase 5)
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.patch("/{item_id}")
async def update_menu_item(item_id: str, body: MenuItemUpdate):
    """Admin: edit name, description, price, category, or availability."""
    # TODO (Phase 5)
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.delete("/{item_id}")
async def delete_menu_item(item_id: str):
    """
    Admin: delete a menu item.
    order_items.menu_item_id is SET NULL on delete so historical orders are preserved.
    """
    # TODO (Phase 5)
    raise HTTPException(status_code=501, detail="Not implemented yet")
