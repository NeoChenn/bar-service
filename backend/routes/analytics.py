from fastapi import APIRouter, Query
from database import supabase
from collections import defaultdict
from datetime import datetime, timedelta, timezone

router = APIRouter()


@router.get("/summary")
async def get_analytics_summary(days: int = Query(default=30, ge=0)):
    """
    Return all analytics metrics for the admin dashboard in a single response.

    days=0 means all time (no date cutoff). Any positive value limits to the
    last N days. Cancelled orders are excluded; pending, preparing and served
    all count because payment is already confirmed at order creation time.
    """
    query = supabase.from_("orders") \
        .select("id, total_amount, created_at") \
        .neq("status", "cancelled")

    if days > 0:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        query = query.gte("created_at", cutoff)

    orders_res = query.execute()
    orders = orders_res.data

    order_ids = [o["id"] for o in orders]
    if order_ids:
        items_res = supabase.from_("order_items") \
            .select("item_name, quantity, price_at_order") \
            .in_("order_id", order_ids) \
            .execute()
        items = items_res.data
    else:
        items = []

    # Bucket revenue by day, ISO week, and calendar month
    rev_day, rev_week, rev_month = defaultdict(float), defaultdict(float), defaultdict(float)
    hour_counts: defaultdict[int, int] = defaultdict(int)

    for o in orders:
        dt = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00"))
        rev_day[dt.strftime("%Y-%m-%d")] += float(o["total_amount"])
        iso = dt.isocalendar()
        rev_week[f"{iso[0]}-W{iso[1]:02d}"] += float(o["total_amount"])
        rev_month[dt.strftime("%Y-%m")] += float(o["total_amount"])
        hour_counts[dt.hour] += 1

    # Aggregate by item_name snapshot — menu_item_id may be NULL for deleted items
    item_qty: defaultdict[str, int] = defaultdict(int)
    item_rev: defaultdict[str, float] = defaultdict(float)
    for it in items:
        item_qty[it["item_name"]] += it["quantity"]
        item_rev[it["item_name"]] += it["quantity"] * float(it["price_at_order"])

    avg = round(sum(float(o["total_amount"]) for o in orders) / len(orders), 2) if orders else 0

    return {
        "revenue_by_day":   [{"date":  k, "revenue": round(v, 2)} for k, v in sorted(rev_day.items())],
        "revenue_by_week":  [{"week":  k, "revenue": round(v, 2)} for k, v in sorted(rev_week.items())],
        "revenue_by_month": [{"month": k, "revenue": round(v, 2)} for k, v in sorted(rev_month.items())],
        # Zero-fill all 24 hours so the chart always renders a complete day
        "busiest_hours": [{"hour": h, "order_count": hour_counts.get(h, 0)} for h in range(24)],
        "top_items_by_quantity": [
            {"item_name": n, "total_quantity": q}
            for n, q in sorted(item_qty.items(), key=lambda x: -x[1])[:10]
        ],
        "top_items_by_revenue": [
            {"item_name": n, "total_revenue": round(r, 2)}
            for n, r in sorted(item_rev.items(), key=lambda x: -x[1])[:10]
        ],
        "average_order_value": avg,
    }
