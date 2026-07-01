from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/{table_id}")
async def get_table(table_id: str):
    """
    Validate that a table exists before showing the customer menu.
    Called when the customer scans a QR code at /table/{table_id}.
    Returns 404 for unknown table IDs so we can show a friendly error.
    """
    # TODO (Phase 2)
    raise HTTPException(status_code=501, detail="Not implemented yet")
