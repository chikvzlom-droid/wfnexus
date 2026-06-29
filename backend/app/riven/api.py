from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, Query

from app.riven.models import RIVEN_PROPERTIES, estimate_riven_price
from app.riven.schemas import RivenPriceOut, RivenPriceRequest

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/riven", tags=["riven"])


@router.get("/properties")
async def list_riven_properties():
    return [{"name": k, **v} for k, v in RIVEN_PROPERTIES.items()]


@router.post("/estimate", response_model=RivenPriceOut)
async def estimate_riven(body: RivenPriceRequest):
    if not body.stats:
        raise HTTPException(400, "At least 2 stats required")
    valid = set(RIVEN_PROPERTIES.keys())
    for s in body.stats:
        if s not in valid:
            raise HTTPException(400, f"Unknown stat: {s}. Valid: {', '.join(sorted(valid))}")
    valid_disp = {"strong", "above_average", "average", "below_average", "weak"}
    if body.disposition not in valid_disp:
        raise HTTPException(400, f"Invalid disposition. Valid: {', '.join(valid_disp)}")

    result = estimate_riven_price(
        weapon_base_price=body.weapon_base_price,
        stats=body.stats,
        has_negative=body.has_negative,
        disposition=body.disposition,
    )
    return RivenPriceOut(weapon_name=body.weapon_name, **result)
