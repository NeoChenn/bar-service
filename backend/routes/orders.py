import os
import stripe
from fastapi import APIRouter, HTTPException, Request, Header
from models.models import CheckoutRequest, OrderStatusUpdate

router = APIRouter()


@router.post("/checkout")
async def create_checkout(body: CheckoutRequest):
    """
    Validate the cart server-side, compute the total from DB prices (never
    from the client), then create a Stripe Checkout session and return the URL.
    """
    # TODO (Phase 3): fetch menu prices from Supabase, compute total,
    # build Stripe line_items, call stripe_service.create_checkout_session
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    """
    Receive Stripe webhook events and write confirmed orders to the DB.

    IMPORTANT: Always verify the Stripe-Signature header before processing.
    Without this check, anyone could POST fake payment events to this endpoint
    and trigger order writes for payments that never happened.
    """
    payload = await request.body()
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, webhook_secret)
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        # TODO (Phase 3): extract table_id and cart from session metadata,
        # write order + order_items to Supabase
        pass

    return {"received": True}


@router.get("/")
async def list_orders():
    """Return all orders for the staff dashboard, newest first."""
    # TODO (Phase 4)
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.patch("/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusUpdate):
    """Allow staff to update an order's status (preparing / served / cancelled)."""
    # TODO (Phase 4)
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.get("/{order_id}")
async def get_order(order_id: str):
    """
    Poll endpoint used by the frontend confirmation page to check whether
    the webhook has written the order yet. Returns 404 until it exists.
    """
    # TODO (Phase 3)
    raise HTTPException(status_code=501, detail="Not implemented yet")
