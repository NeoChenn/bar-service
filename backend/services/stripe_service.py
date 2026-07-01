import os
import json
import stripe
from typing import Any

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


def create_checkout_session(
    line_items: list[dict],
    table_id: str,
    cart_snapshot: list[dict],
    success_url: str,
    cancel_url: str,
) -> Any:
    """
    Create a Stripe Checkout session for the given line items.

    cart_snapshot is serialised into session metadata so the webhook handler
    can reconstruct the order without re-querying the DB. The prices in the
    snapshot were computed server-side and can be trusted.

    success_url must contain {CHECKOUT_SESSION_ID} — Stripe substitutes the
    real session ID before redirecting, which the confirmation page uses to poll.
    """
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=line_items,
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "table_id": table_id,
            "cart": json.dumps(cart_snapshot),
        },
    )
    return session
