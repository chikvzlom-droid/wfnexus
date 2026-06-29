from __future__ import annotations

import re

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.fuzzy import fuzzy_search
from app.inventory.models import InventoryItem
from app.inventory.schemas import (
    AppraisalItem,
    AppraisalOut,
    BulkImportRequest,
    BulkImportResult,
    InventoryItemCreate,
    InventoryItemOut,
    InventoryItemUpdate,
    PaginatedInventory,
)
from app.market.models import Item, PriceSnapshot

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/inventory", tags=["inventory"])


@router.get("", response_model=PaginatedInventory)
async def list_inventory(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    q: str | None = Query(None),
    location: str | None = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    query = select(InventoryItem).options(selectinload(InventoryItem.item))

    if q:
        query = query.where(InventoryItem.item_name.ilike(f"%{q}%"))
    if location:
        query = query.where(InventoryItem.location == location)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0

    sort_col = getattr(InventoryItem, sort_by, InventoryItem.created_at)
    order_fn = sort_col.desc if sort_order == "desc" else sort_col.asc
    query = query.order_by(order_fn()).offset((page - 1) * limit).limit(limit)

    items = (await db.execute(query)).scalars().all()
    return PaginatedInventory(
        results=[InventoryItemOut.model_validate(i) for i in items],
        total=total,
        page=page,
        total_pages=max(1, (total + limit - 1) // limit),
    )


@router.get("/{item_id}", response_model=InventoryItemOut)
async def get_inventory_item(item_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(404, "Inventory item not found")
    return item


@router.post("", response_model=InventoryItemOut, status_code=201)
async def create_inventory_item(body: InventoryItemCreate, db: AsyncSession = Depends(get_db)):
    item = InventoryItem(**body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{item_id}", response_model=InventoryItemOut)
async def update_inventory_item(item_id: int, body: InventoryItemUpdate, db: AsyncSession = Depends(get_db)):
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(404, "Inventory item not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
async def delete_inventory_item(item_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(404, "Inventory item not found")
    await db.delete(item)
    await db.commit()


@router.post("/bulk-import", response_model=BulkImportResult, status_code=201)
async def bulk_import(body: BulkImportRequest, db: AsyncSession = Depends(get_db)):
    lines = [l.strip() for l in body.text.split("\n") if l.strip()]
    created = 0
    failed = []

    all_items = (await db.execute(select(Item).limit(2000))).scalars().all()
    name_map = {i.name.lower(): i for i in all_items}

    line_re = re.compile(r"^(.+?)(?:\s+x(\d+))?\s*$", re.IGNORECASE)

    for line in lines:
        m = line_re.match(line)
        if not m:
            failed.append(line)
            continue
        raw_name = m.group(1).strip()
        qty = int(m.group(2)) if m.group(2) else 1
        if not raw_name:
            failed.append(line)
            continue

        exact = name_map.get(raw_name.lower())
        if exact:
            inv = InventoryItem(item_id=exact.id, item_name=exact.name, quantity=qty, location=body.location)
            db.add(inv)
            created += 1
            continue

        candidates = [i.name for i in all_items]
        scored = fuzzy_search(raw_name, candidates, 1)
        if scored and scored[0][1] >= 60:
            matched = name_map[scored[0][0].lower()]
            inv = InventoryItem(item_id=matched.id, item_name=matched.name, quantity=qty, location=body.location)
            db.add(inv)
            created += 1
        else:
            inv = InventoryItem(item_name=raw_name, quantity=qty, location=body.location)
            db.add(inv)
            created += 1

    await db.commit()
    return BulkImportResult(created=created, failed=failed)


@router.get("/appraisal", response_model=AppraisalOut)
async def get_appraisal(db: AsyncSession = Depends(get_db)):
    items = (await db.execute(
        select(InventoryItem).options(selectinload(InventoryItem.item))
    )).scalars().all()

    if not items:
        return AppraisalOut(total_estimated_value=0, total_potential_profit=0, total_items=0, items=[])

    subq = select(
        PriceSnapshot.item_id,
        func.max(PriceSnapshot.recorded_at).label("max_ts"),
    ).group_by(PriceSnapshot.item_id).subquery()

    snap_rows = (await db.execute(
        select(PriceSnapshot)
        .join(subq, (PriceSnapshot.item_id == subq.c.item_id) & (PriceSnapshot.recorded_at == subq.c.max_ts))
    )).scalars().all()
    snap_map = {s.item_id: s for s in snap_rows}

    total_value = 0.0
    total_profit = 0.0
    results = []
    for inv in items:
        price = snap_map.get(inv.item_id).oracle_price if inv.item_id and inv.item_id in snap_map and snap_map[inv.item_id].oracle_price else None
        est_val = round(price * inv.quantity, 2) if price else None
        profit = round((price - (inv.acquired_price or 0)) * inv.quantity, 2) if price and inv.acquired_price else None
        if est_val:
            total_value += est_val
        if profit and profit > 0:
            total_profit += profit
        results.append(AppraisalItem(
            id=inv.id, item_name=inv.item_name, quantity=inv.quantity,
            acquired_price=inv.acquired_price, oracle_price=price,
            estimated_value=est_val, potential_profit=profit,
            item=inv.item,
        ))

    return AppraisalOut(
        total_estimated_value=round(total_value, 2),
        total_potential_profit=round(total_profit, 2),
        total_items=len(results),
        items=results,
    )
