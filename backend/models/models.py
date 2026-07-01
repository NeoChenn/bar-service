from pydantic import BaseModel, UUID4
from typing import Optional, Literal
from datetime import datetime


# ── Cart / checkout request ───────────────────────────────────────────────────

class CartItem(BaseModel):
    menu_item_id: UUID4
    quantity: int


class CheckoutRequest(BaseModel):
    table_id: UUID4
    items: list[CartItem]


# ── Menu ─────────────────────────────────────────────────────────────────────

class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category: str
    available: bool = True


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    available: Optional[bool] = None


class MenuItem(BaseModel):
    id: UUID4
    name: str
    description: Optional[str]
    price: float
    category: str
    available: bool
    created_at: datetime


# ── Orders ────────────────────────────────────────────────────────────────────

class OrderStatusUpdate(BaseModel):
    # pending is excluded — orders start pending via the webhook, staff can't set it
    status: Literal["preparing", "served", "cancelled"]
