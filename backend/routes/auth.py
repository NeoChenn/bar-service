import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal

router = APIRouter()


class VerifyRequest(BaseModel):
    password: str
    role: Literal["staff", "admin"]


@router.post("/verify")
async def verify_password(body: VerifyRequest):
    """
    Check a staff or admin password against the env vars.
    The password never reaches the frontend — it's verified here and the
    browser stores only a role string in sessionStorage.
    """
    if body.role == "staff":
        expected = os.getenv("STAFF_PASSWORD")
    else:
        expected = os.getenv("ADMIN_PASSWORD")

    if not expected or body.password != expected:
        raise HTTPException(status_code=401, detail="Incorrect password")

    return {"role": body.role}
