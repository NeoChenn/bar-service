import os
import json
import stripe
from fastapi import APIRouter, HTTPException, Request, Header, Query
from models.models import CheckoutRequest, OrderStatusUpdate
from database import supabase
from services import stripe_service

router = APIRouter()


@router.post("/checkout")
async def create_checkout(body: CheckoutRequest):
    """
    Validate the cart server-side, compute the total from DB prices (never
    from the client), then create a Stripe Checkout session and return the URL.
    """
    item_ids = [str(item.menu_item_id) for item in body.items]

    # Fetch current prices from DB — the client's prices are never trusted
    result = supabase.from_("menu_items") \
        .select("id, name, price, available") \
        .in_("id", item_ids) \
        .execute()

    db_items = {str(row["id"]): row for row in result.data}

    # Validate every item exists and is still available
    for cart_item in body.items:
        item_id = str(cart_item.menu_item_id)
        if item_id not in db_items:
            raise HTTPException(status_code=400, detail=f"Menu item {item_id} not found")
        if not db_items[item_id]["available"]:
            raise HTTPException(
                status_code=400,
                detail=f"'{db_items[item_id]['name']}' is no longer available",
            )

    # Build Stripe line_items and a cart snapshot using server-side prices
    line_items = []
    cart_snapshot = []

    for cart_item in body.items:
        db_item = db_items[str(cart_item.menu_item_id)]
        price = float(db_item["price"])

        line_items.append({
            "price_data": {
                "currency": "gbp",
                "unit_amount": int(price * 100),  # Stripe works in pence
                "product_data": {"name": db_item["name"]},
            },
            "quantity": cart_item.quantity,
        })

        cart_snapshot.append({
            "menu_item_id": str(cart_item.menu_item_id),
            "name": db_item["name"],
            "price": price,
            "quantity": cart_item.quantity,
        })

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    session = stripe_service.create_checkout_session(
        line_items=line_items,
        table_id=str(body.table_id),
        cart_snapshot=cart_snapshot,
        # {CHECKOUT_SESSION_ID} is a Stripe template — replaced with the real
        # session ID before the customer is redirected back to our site.
        success_url=f"{frontend_url}/confirmation?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{frontend_url}/table/{body.table_id}",
    )

    return {"session_url": session.url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    """
    Receive Stripe webhook events and write confirmed orders to the DB.

    IMPORTANT: Always verify the Stripe-Signature header before processing.
    Without this check, anyone could POST a fake payment event and trigger
    order writes for payments that never happened.

    The raw request body must be used for signature verification — if FastAPI
    parses the body first, the bytes change and the signature check always fails.
    """
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, os.getenv("STRIPE_WEBHOOK_SECRET")
        )
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    if event["type"] == "checkout.session.completed":
        # construct_event() returns StripeObjects which don't support .get().
        # Since the signature is already verified, parse the raw payload as a
        # plain dict — safe and avoids the StripeObject API entirely.
        event_dict = json.loads(payload)
        session = event_dict["data"]["object"]
        session_id = session["id"]

        # Idempotency: Stripe retries webhooks that don't receive a 2xx response.
        # If we already wrote this order, return 200 immediately rather than
        # inserting a duplicate.
        existing = supabase.from_("orders") \
            .select("id") \
            .eq("stripe_session_id", session_id) \
            .execute()
        if existing.data:
            return {"received": True}

        metadata = session.get("metadata", {})
        table_id = metadata.get("table_id")
        cart = json.loads(metadata.get("cart", "[]"))
        # amount_total is in pence — convert to pounds to match our schema
        total_amount = session["amount_total"] / 100

        # Write the order row
        order_result = supabase.from_("orders").insert({
            "table_id": table_id,
            "status": "pending",
            "stripe_session_id": session_id,
            "total_amount": total_amount,
        }).execute()

        if not order_result.data:
            # Return 500 so Stripe retries the webhook
            raise HTTPException(status_code=500, detail="Failed to write order")

        order_id = order_result.data[0]["id"]

        # Write order items with snapshotted name and price so historical
        # orders are unaffected by future menu changes or deletions.
        order_items = [
            {
                "order_id": order_id,
                "menu_item_id": item["menu_item_id"],
                "item_name": item["name"],
                "quantity": item["quantity"],
                "price_at_order": item["price"],
            }
            for item in cart
        ]

        supabase.from_("order_items").insert(order_items).execute()

    return {"received": True}


@router.get("/by-session/{session_id}")
async def get_order_by_session(session_id: str):
    """
    Poll endpoint for the confirmation page. Returns 404 until the webhook
    has written the order, then returns the order with its items.
    """
    result = supabase.from_("orders") \
        .select("*, order_items(*)") \
        .eq("stripe_session_id", session_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found yet")

    return result.data[0]


@router.get("/")
async def list_orders():
    """Return active orders (pending/preparing) for the staff dashboard, newest first."""
    result = supabase.from_("orders") \
        .select("*, order_items(*), tables(table_number)") \
        .in_("status", ["pending", "preparing"]) \
        .order("created_at", desc=True) \
        .execute()
    return result.data


@router.patch("/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusUpdate):
    """
    Allow staff to advance an order's status (preparing / served / cancelled).
    pending is not an allowed target — orders enter that state via the webhook only.
    """
    existing = supabase.from_("orders").select("id").eq("id", order_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Order not found")

    result = supabase.from_("orders") \
        .update({"status": body.status}) \
        .eq("id", order_id) \
        .execute()
    return result.data[0]


@router.get("/history")
async def list_order_history(
    start_date:   str | None = Query(default=None),
    end_date:     str | None = Query(default=None),
    status:       str | None = Query(default=None),
    table_number: str | None = Query(default=None),
):
    """
    Return all orders for the staff history view, newest first.
    All filters are optional and can be combined freely.
    table_number is resolved to a table_id first because Supabase's
    chained API cannot filter on joined/foreign-key fields directly.
    """
    query = supabase.from_("orders") \
        .select("*, order_items(*), tables(table_number)") \
        .order("created_at", desc=True)

    if start_date:
        query = query.gte("created_at", f"{start_date}T00:00:00+00:00")
    if end_date:
        query = query.lte("created_at", f"{end_date}T23:59:59+00:00")
    if status:
        query = query.eq("status", status)
    if table_number:
        table_res = supabase.from_("tables").select("id") \
            .eq("table_number", table_number).execute()
        if not table_res.data:
            return []
        query = query.eq("table_id", table_res.data[0]["id"])

    result = query.execute()
    return result.data


@router.get("/{order_id}")
async def get_order(order_id: str):
    """Return a single order by its UUID — used by the staff dashboard."""
    # TODO (Phase 4)
    raise HTTPException(status_code=501, detail="Not implemented yet")
