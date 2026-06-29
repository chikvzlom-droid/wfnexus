from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.fuzzy import fuzzy_search
from app.core.notifications import send_notification
from app.market.client import get_wfm_client
from app.market.collector import sync_item_catalogue
from app.core.scheduler import get_sync_status, _collect_all_price_snapshots
from app.market.models import Item, PriceSnapshot, WatchlistItem
from app.market.oracle import PriceOracle, PriceData
import numpy as np

from app.market.schemas import (
    ItemOut,
    ItemSearchOut,
    FuzzySearchOut,
    OraclePriceOut,
    OrderDistributionOut,
    PaginatedAnalytics,
    PriceAnalyticsItem,
    PriceDistributionBucket,
    PriceHistoryOut,
    PriceHistoryPoint,
    WatchlistCreate,
    WatchlistOut,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/market", tags=["market"])


@router.get("/items", response_model=ItemSearchOut)
async def list_items(
    q: str = Query("", description="Search by item name"),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Item)
    if q:
        stmt = stmt.where(Item.name.ilike(f"%{q}%"))
    result = await db.execute(stmt.order_by(Item.name).limit(limit * 3))
    items = result.scalars().all()
    if q:
        names = {i.name: i for i in items}
        scored = fuzzy_search(q, list(names.keys()), limit)
        items = [names[name] for name, _ in scored]
    return ItemSearchOut(query=q, total=len(items), items=[ItemOut.model_validate(i) for i in items])


@router.get("/items/fuzzy", response_model=FuzzySearchOut)
async def fuzzy_item_search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    items = (await db.execute(select(Item).limit(limit * 5))).scalars().all()
    names = {i.name: i for i in items}
    scored = fuzzy_search(q, list(names.keys()), limit)
    return FuzzySearchOut(
        query=q,
        results=[{"item": ItemOut.model_validate(names[name]), "score": score} for name, score in scored],
    )


@router.get("/items/{slug}", response_model=ItemOut)
async def get_item(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Item).where(Item.slug == slug))
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return ItemOut.model_validate(item)


@router.get("/items/{slug}/orders")
async def get_item_orders(slug: str, db: AsyncSession = Depends(get_db)):
    item = await db.execute(select(Item).where(Item.slug == slug))
    if item.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Item not found")
    client = get_wfm_client()
    try:
        orders = await client.get_orders(slug)
        return orders
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("orders_fetch_failed", slug=slug, error=str(exc))
        raise HTTPException(status_code=502, detail="Failed to fetch orders from warframe.market")


@router.get("/items/{slug}/oracle", response_model=OraclePriceOut)
async def get_oracle_price(
    slug: str,
    strategy: str = Query("dynamic", description="Oracle strategy: median, mean, volume_weighted, time_decay, dynamic"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Item).where(Item.slug == slug))
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    client = get_wfm_client()
    try:
        orders = await client.get_orders(slug)
    except Exception as exc:
        logger.error("orders_fetch_failed", slug=slug, error=str(exc))
        raise HTTPException(status_code=502, detail="Failed to fetch orders from warframe.market")

    points = [
        PriceData(
            price=float(o["platinum"]),
            volume=int(o.get("quantity", 1)),
            recorded_at=datetime.fromisoformat(o.get("updatedAt", "").replace("Z", "+00:00")),
        )
        for o in orders
        if o.get("type") == "sell" and float(o.get("platinum", 0)) > 0
    ]

    oracle_price, used_strategy, confidence, sample_size = PriceOracle.estimate(points, strategy)
    return OraclePriceOut(
        item_id=item.id,
        oracle_price=oracle_price,
        strategy=used_strategy,
        confidence=confidence,
        sample_size=sample_size,
    )


@router.get("/items/{slug}/orders/distribution", response_model=OrderDistributionOut)
async def get_order_distribution(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Item).where(Item.slug == slug))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Item not found")

    client = get_wfm_client()
    try:
        orders = await client.get_orders(slug)
    except Exception as exc:
        logger.error("orders_fetch_failed", slug=slug, error=str(exc))
        raise HTTPException(status_code=502, detail="Failed to fetch orders")

    sell_prices = sorted([float(o["platinum"]) for o in orders if o.get("type") == "sell" and float(o.get("platinum", 0)) > 0])
    buy_prices = [float(o["platinum"]) for o in orders if o.get("type") == "buy" and float(o.get("platinum", 0)) > 0]

    if not sell_prices:
        return OrderDistributionOut(
            slug=slug, sell_count=0, buy_count=len(buy_prices), buckets=[]
        )

    min_p, max_p = sell_prices[0], sell_prices[-1]
    bucket_count = min(15, max(5, len(sell_prices) // 3))
    if max_p == min_p:
        buckets = [PriceDistributionBucket(range_start=float(min_p), range_end=float(min_p + 1), count=len(sell_prices))]
    else:
        bin_edges = np.linspace(float(min_p), float(max_p), bucket_count + 1)
        bins = [0] * bucket_count
        for p in sell_prices:
            idx = min(bucket_count - 1, int((p - min_p) / (max_p - min_p) * bucket_count))
            bins[idx] += 1
        buckets = [
            PriceDistributionBucket(range_start=float(bin_edges[i]), range_end=float(bin_edges[i + 1]), count=bins[i])
            for i in range(bucket_count)
        ]

    return OrderDistributionOut(
        slug=slug,
        sell_count=len(sell_prices),
        buy_count=len(buy_prices),
        min_price=float(min_p),
        max_price=float(max_p),
        avg_price=float(np.mean(sell_prices)),
        median_price=float(np.median(sell_prices)),
        buckets=buckets,
    )


@router.get("/items/{slug}/history", response_model=PriceHistoryOut)
async def get_price_history(
    slug: str,
    limit: int = Query(168, description="Max data points"),
    from_date: str | None = Query(None, description="YYYY-MM-DD"),
    to_date: str | None = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Item).where(Item.slug == slug))
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    stmt = (
        select(PriceSnapshot)
        .where(PriceSnapshot.item_id == item.id)
    )
    if from_date:
        stmt = stmt.where(PriceSnapshot.recorded_at >= from_date)
    if to_date:
        stmt = stmt.where(PriceSnapshot.recorded_at <= to_date + " 23:59:59")
    stmt = stmt.order_by(PriceSnapshot.recorded_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    points = [
        PriceHistoryPoint(
            recorded_at=r.recorded_at,
            oracle_price=r.oracle_price,
            min_price=r.min_price,
            max_price=r.max_price,
            open_price=r.open_price,
            closed_price=r.closed_price,
            avg_price=r.avg_price,
            wa_price=r.wa_price,
            median_price=r.median_price,
            moving_avg=r.moving_avg,
            donch_top=r.donch_top,
            donch_bot=r.donch_bot,
            sample_size=r.sample_size,
            volume=r.volume,
            sell_count=r.sell_count,
            buy_count=r.buy_count,
            supply=r.supply,
            demand=r.demand,
        )
        for r in reversed(rows)
    ]
    return PriceHistoryOut(slug=slug, points=points)


@router.post("/sync", response_model=dict)
async def sync_catalogue(db: AsyncSession = Depends(get_db)):
    try:
        count = await sync_item_catalogue(db)
        return {"synced": count, "message": f"Catalogue synced: {count} items"}
    except Exception as exc:
        logger.error("catalogue_sync_failed", error=str(exc))
        raise HTTPException(status_code=502, detail="Failed to sync catalogue from warframe.market")


@router.get("/watchlist", response_model=list[WatchlistOut])
async def get_watchlist(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WatchlistItem).options(selectinload(WatchlistItem.item)))
    entries = result.scalars().all()
    return [WatchlistOut.model_validate(e) for e in entries]


@router.post("/watchlist", response_model=WatchlistOut, status_code=201)
async def add_to_watchlist(data: WatchlistCreate, db: AsyncSession = Depends(get_db)):
    item = await db.get(Item, data.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    entry = WatchlistItem(
        item_id=data.item_id,
        target_price=data.target_price,
        direction=data.direction,
        notify=data.notify,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry, ["item"])
    return WatchlistOut.model_validate(entry)


@router.delete("/watchlist/{entry_id}", status_code=204)
async def remove_from_watchlist(entry_id: int, db: AsyncSession = Depends(get_db)):
    entry = await db.get(WatchlistItem, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")
    await db.delete(entry)
    await db.commit()


SORTABLE_ANALYTICS_COLUMNS = {
    "volume", "min_price", "max_price", "open_price", "closed_price",
    "avg_price", "wa_price", "median_price", "moving_avg", "donch_top",
    "donch_bot", "supply", "demand", "sample_size", "sell_count", "buy_count",
    "recorded_at", "item_name",
}


@router.get("/items/{slug}/live-analytics", response_model=PriceHistoryOut)
async def get_live_analytics(slug: str):
    """Fetch live WFM orders and compute analytics on the fly."""
    client = get_wfm_client()
    try:
        orders = await client.get_orders(slug)
    except Exception as exc:
        logger.error("live_analytics_fetch_failed", slug=slug, error=str(exc))
        return PriceHistoryOut(slug=slug, points=[])

    sell_prices = [float(o["platinum"]) for o in orders if o.get("type") == "sell" and float(o.get("platinum", 0)) > 0]
    buy_prices = [float(o["platinum"]) for o in orders if o.get("type") == "buy" and float(o.get("platinum", 0)) > 0]

    if not sell_prices:
        return PriceHistoryOut(slug=slug, points=[])

    arr = np.array(sell_prices)
    median_val = float(np.median(arr))
    mean_val = float(np.mean(arr))
    min_val = float(np.min(arr))
    max_val = float(np.max(arr))
    now = datetime.now(timezone.utc)

    return PriceHistoryOut(slug=slug, points=[
        PriceHistoryPoint(
            recorded_at=now,
            oracle_price=median_val,
            min_price=min_val,
            max_price=max_val,
            open_price=min_val,
            closed_price=median_val,
            avg_price=mean_val,
            wa_price=mean_val,
            median_price=median_val,
            moving_avg=median_val,
            donch_top=max_val,
            donch_bot=min_val,
            sample_size=len(sell_prices),
            volume=len(sell_prices) + len(buy_prices),
            sell_count=len(sell_prices),
            buy_count=len(buy_prices),
            supply=len(sell_prices),
            demand=len(buy_prices),
        )
    ])


@router.get("/analytics", response_model=PaginatedAnalytics)
async def get_market_analytics(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    sort_by: str = Query("volume"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    q: str | None = Query(None, description="Search by item name"),
    tags: str | None = Query(None, description="Comma-separated tags"),
    from_date: str | None = Query(None, description="YYYY-MM-DD"),
    to_date: str | None = Query(None, description="YYYY-MM-DD"),
    volume_gt: int | None = Query(None, ge=0),
    volume_lt: int | None = Query(None, ge=0),
    supply_gt: int | None = Query(None, ge=0),
    supply_lt: int | None = Query(None, ge=0),
    demand_gt: int | None = Query(None, ge=0),
    demand_lt: int | None = Query(None, ge=0),
    min_price_gt: float | None = Query(None, ge=0),
    min_price_lt: float | None = Query(None, ge=0),
    max_price_gt: float | None = Query(None, ge=0),
    max_price_lt: float | None = Query(None, ge=0),
    db: AsyncSession = Depends(get_db),
):
    subq = select(
        PriceSnapshot.item_id,
        func.max(PriceSnapshot.recorded_at).label("max_ts"),
    )
    if from_date:
        subq = subq.where(PriceSnapshot.recorded_at >= from_date)
    if to_date:
        subq = subq.where(PriceSnapshot.recorded_at <= to_date + " 23:59:59")
    subq = subq.group_by(PriceSnapshot.item_id).subquery()

    query = (
        select(Item, PriceSnapshot)
        .outerjoin(subq, Item.id == subq.c.item_id)
        .outerjoin(PriceSnapshot, (PriceSnapshot.item_id == subq.c.item_id) & (PriceSnapshot.recorded_at == subq.c.max_ts))
    )

    if q:
        query = query.where(Item.name.ilike(f"%{q}%"))
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        for tg in tag_list:
            query = query.where(Item.category.ilike(f"%{tg}%"))

    if volume_gt is not None:
        query = query.where(PriceSnapshot.volume >= volume_gt)
    if volume_lt is not None:
        query = query.where(PriceSnapshot.volume <= volume_lt)
    if supply_gt is not None:
        query = query.where(PriceSnapshot.supply >= supply_gt)
    if supply_lt is not None:
        query = query.where(PriceSnapshot.supply <= supply_lt)
    if demand_gt is not None:
        query = query.where(PriceSnapshot.demand >= demand_gt)
    if demand_lt is not None:
        query = query.where(PriceSnapshot.demand <= demand_lt)
    if min_price_gt is not None:
        query = query.where(PriceSnapshot.min_price >= min_price_gt)
    if min_price_lt is not None:
        query = query.where(PriceSnapshot.min_price <= min_price_lt)
    if max_price_gt is not None:
        query = query.where(PriceSnapshot.max_price >= max_price_gt)
    if max_price_lt is not None:
        query = query.where(PriceSnapshot.max_price <= max_price_lt)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0
    total_pages = max(1, (total + limit - 1) // limit)

    sort_col = sort_by if sort_by in SORTABLE_ANALYTICS_COLUMNS else "volume"
    if sort_by == "item_name":
        order_col = Item.name
    else:
        order_col = func.coalesce(getattr(PriceSnapshot, sort_col, None), 0)
    if sort_order == "asc":
        query = query.order_by(order_col.asc().nullslast())
    else:
        query = query.order_by(order_col.desc().nullslast())

    query = query.offset((page - 1) * limit).limit(limit)
    rows = (await db.execute(query)).all()

    results = []
    for item, snap in rows:
        tags_list = (item.category or "").split(", ") if item.category else []
        results.append(PriceAnalyticsItem(
            id=snap.id if snap else 0,
            item_id=item.id,
            item_name=item.name,
            item_slug=item.slug,
            item_category=item.category,
            item_thumbnail=item.thumbnail,
            tags=[t for t in tags_list if t],
            oracle_price=snap.oracle_price if snap else None,
            min_price=snap.min_price if snap else None,
            max_price=snap.max_price if snap else None,
            open_price=snap.open_price if snap else None,
            closed_price=snap.closed_price if snap else None,
            avg_price=snap.avg_price if snap else None,
            wa_price=snap.wa_price if snap else None,
            median_price=snap.median_price if snap else None,
            moving_avg=snap.moving_avg if snap else None,
            donch_top=snap.donch_top if snap else None,
            donch_bot=snap.donch_bot if snap else None,
            sample_size=snap.sample_size if snap else 0,
            volume=snap.volume if snap else 0,
            sell_count=snap.sell_count if snap else 0,
            buy_count=snap.buy_count if snap else 0,
            supply=snap.supply if snap else 0,
            demand=snap.demand if snap else 0,
            trading_tax=snap.trading_tax if snap else 0,
            recorded_at=snap.recorded_at if snap else None,
        ))
    return PaginatedAnalytics(results=results, total=total, page=page, total_pages=total_pages)


@router.post("/test-notify", response_model=dict)
async def test_notification():
    """Send a test notification to all configured providers."""
    msg = "Warframe Nexus — тестовое уведомление"
    await send_notification(msg)
    configs = {
        "telegram": bool(settings.telegram_bot_token and settings.telegram_chat_id),
        "ntfy": bool(settings.ntfy_topic),
        "discord": bool(settings.discord_webhook_url),
    }
    return {"sent": True, "configured": configs}


@router.get("/sync-status")
async def sync_status():
    return get_sync_status()


@router.post("/sync-all-prices")
async def trigger_full_sync():
    status = get_sync_status()
    if status["running"]:
        return {"started": False, "message": "Sync already in progress", "status": status}
    asyncio.create_task(_collect_all_price_snapshots())
    return {"started": True, "message": "Full price sync started"}
