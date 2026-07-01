import os
import stripe
from typing import Any

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


def create_checkout_session(
    line_items: list[dict],
    table_id: str,
    success_url: str,
    cancel_url: str,
) -> Any:
    """
    Create a Stripe Checkout session for the given line items.

    Metadata carries table_id and the verified cart so the webhook handler
    can write the order without re-fetching prices from the DB.
    """
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=line_items,
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"table_id": table_id},
    )
    return session
