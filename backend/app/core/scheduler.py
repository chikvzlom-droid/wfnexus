from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import numpy as np

from app.core.database import async_session_factory
from app.core.notifications import send_notification
from app.market.client import get_wfm_client
from app.market.models import Item, WatchlistItem, PriceSnapshot

logger = structlog.get_logger(__name__)

_CHECK_INTERVAL = 300  # 5 minutes
_COLLECT_INTERVAL = 1800  # 30 minutes (watchlist only)
_FULL_SYNC_INTERVAL = 21600  # 6 hours
_SMA_PERIOD = 12  # number of snapshots for SMA (30min * 12 = 6h for watchlist)

_sync_status: dict = {"running": False, "total": 0, "done": 0, "errors": 0, "last_full_sync": None, "last_watchlist_sync": None, "items_with_snapshots": 0}
_sync_lock = asyncio.Lock()


def get_sync_status() -> dict:
    return dict(_sync_status)


async def _count_items_with_snapshots(session: AsyncSession) -> int:
    from sqlalchemy import func
    result = await session.execute(select(func.count(func.distinct(PriceSnapshot.item_id))))
    return result.scalar() or 0


async def _compute_sma(item_id: str, session: AsyncSession, period: int = _SMA_PERIOD) -> float | None:
    """Compute real simple moving average of closed_price over last N snapshots."""
    rows = (
        await session.execute(
            select(PriceSnapshot.closed_price)
            .where(PriceSnapshot.item_id == item_id, PriceSnapshot.closed_price.isnot(None))
            .order_by(PriceSnapshot.recorded_at.desc())
            .limit(period)
        )
    ).scalars().all()
    if not rows:
        return None
    return float(np.mean([r for r in rows if r is not None]))


async def _check_watchlist() -> None:
    """Check all watchlist items and send notifications on price alerts."""
    async with async_session_factory() as session:
        result = await session.execute(select(WatchlistItem))
        entries = result.scalars().all()
        if not entries:
            return

        client = get_wfm_client()
        for entry in entries:
            try:
                item = await session.get(Item, entry.item_id)
                if item is None:
                    continue
                orders = await client.get_orders(item.slug)
                sell_prices = [float(o["platinum"]) for o in orders if o.get("type") == "sell" and float(o.get("platinum", 0)) > 0]
                if not sell_prices:
                    continue
                current_price = min(sell_prices)

                triggered = False
                if entry.direction == "below" and current_price <= entry.target_price:
                    triggered = True
                    direction_text = "упала"
                elif entry.direction == "above" and current_price >= entry.target_price:
                    triggered = True
                    direction_text = "поднялась"

                if triggered and entry.notify:
                    msg = (
                        f"Warframe Nexus\n"
                        f"Цена на {item.name} {direction_text} до {current_price}p\n"
                        f"Цель: {entry.target_price}p\n"
                        f"https://warframe.market/items/{item.slug}"
                    )
                    await send_notification(msg)
                    logger.info("watchlist_alert", item=item.slug, price=current_price, direction=entry.direction)
                await asyncio.sleep(1)
            except Exception as exc:
                logger.warning("watchlist_check_failed", entry=entry.id, error=str(exc))


async def _collect_price_snapshots() -> None:
    """Collect oracle price snapshots for all items in the watchlist."""
    if _sync_lock.locked():
        return
    async with _sync_lock:
        async with async_session_factory() as session:
            result = await session.execute(select(WatchlistItem))
            entries = result.scalars().all()
            if not entries:
                return

            client = get_wfm_client()
            for entry in entries:
                try:
                    item = await session.get(Item, entry.item_id)
                    if item is None:
                        continue
                    orders = await client.get_orders(item.slug)
                    sell_prices = [float(o["platinum"]) for o in orders if o.get("type") == "sell" and float(o.get("platinum", 0)) > 0]
                    buy_prices = [float(o["platinum"]) for o in orders if o.get("type") == "buy" and float(o.get("platinum", 0)) > 0]
                    if not sell_prices:
                        continue

                    arr = np.array(sell_prices)
                    median_val = float(np.median(arr)) if len(arr) > 0 else 0.0
                    mean_val = float(np.mean(arr)) if len(arr) > 0 else 0.0
                    min_val = float(np.min(arr)) if len(arr) > 0 else 0.0
                    max_val = float(np.max(arr)) if len(arr) > 0 else 0.0

                    last_snap = await session.execute(
                        select(PriceSnapshot)
                        .where(PriceSnapshot.item_id == item.id)
                        .order_by(PriceSnapshot.recorded_at.desc())
                        .limit(1)
                    )
                    prev = last_snap.scalar_one_or_none()

                    sma = await _compute_sma(item.id, session)
                    snap = PriceSnapshot(
                        item_id=item.id,
                        oracle_price=median_val,
                        min_price=min_val,
                        max_price=max_val,
                        open_price=prev.closed_price if prev else min_val,
                        closed_price=median_val,
                        avg_price=mean_val,
                        wa_price=mean_val,
                        median_price=median_val,
                        moving_avg=sma or mean_val,
                        donch_top=max_val,
                        donch_bot=min_val,
                        sample_size=len(sell_prices),
                        volume=len(sell_prices) + len(buy_prices),
                        sell_count=len(sell_prices),
                        buy_count=len(buy_prices),
                        supply=len(sell_prices),
                        demand=len(buy_prices),
                        trading_tax=item.ducats if item.ducats else 0,
                    )
                    session.add(snap)
                    logger.info("snapshot_collected", item=item.slug, price=snap.oracle_price, samples=snap.sample_size)
                    await asyncio.sleep(1)
                except Exception as exc:
                    logger.warning("snapshot_collect_failed", entry=entry.id, error=str(exc))

            await session.commit()
            _sync_status["last_watchlist_sync"] = datetime.now(timezone.utc).isoformat()
            _sync_status["items_with_snapshots"] = await _count_items_with_snapshots(session)


async def _collect_all_price_snapshots() -> None:
    """Collect price snapshots for ALL items in the catalogue."""
    global _sync_status
    if _sync_status["running"] or _sync_lock.locked():
        logger.info("full_sync_already_running")
        return
    async with _sync_lock:
        async with async_session_factory() as session:
            result = await session.execute(select(Item))
            all_items = result.scalars().all()
            total = len(all_items)
            _sync_status = {"running": True, "total": total, "done": 0, "errors": 0}
            if total == 0:
                _sync_status["running"] = False
                return

            client = get_wfm_client()
            done = 0
            errors = 0

            for item in all_items:
                try:
                    orders = await client.get_orders(item.slug)
                    sell_prices = [float(o["platinum"]) for o in orders if o.get("type") == "sell" and float(o.get("platinum", 0)) > 0]
                    buy_prices = [float(o["platinum"]) for o in orders if o.get("type") == "buy" and float(o.get("platinum", 0)) > 0]

                    if not sell_prices:
                        done += 1
                        continue

                    arr = np.array(sell_prices)
                    median_val = float(np.median(arr)) if len(arr) > 0 else 0.0
                    mean_val = float(np.mean(arr)) if len(arr) > 0 else 0.0
                    min_val = float(np.min(arr)) if len(arr) > 0 else 0.0
                    max_val = float(np.max(arr)) if len(arr) > 0 else 0.0

                    last_snap = await session.execute(
                        select(PriceSnapshot)
                        .where(PriceSnapshot.item_id == item.id)
                        .order_by(PriceSnapshot.recorded_at.desc())
                        .limit(1)
                    )
                    prev = last_snap.scalar_one_or_none()

                    sma = await _compute_sma(item.id, session)
                    snap = PriceSnapshot(
                        item_id=item.id,
                        oracle_price=median_val,
                        min_price=min_val,
                        max_price=max_val,
                        open_price=prev.closed_price if prev else min_val,
                        closed_price=median_val,
                        avg_price=mean_val,
                        wa_price=mean_val,
                        median_price=median_val,
                        moving_avg=sma or mean_val,
                        donch_top=max_val,
                        donch_bot=min_val,
                        sample_size=len(sell_prices),
                        volume=len(sell_prices) + len(buy_prices),
                        sell_count=len(sell_prices),
                        buy_count=len(buy_prices),
                        supply=len(sell_prices),
                        demand=len(buy_prices),
                        trading_tax=item.ducats if item.ducats else 0,
                    )
                    session.add(snap)

                    done += 1
                    if done % 50 == 0:
                        await session.commit()
                        logger.info("full_sync_progress", done=done, total=total)

                except Exception as exc:
                    errors += 1
                    logger.warning("full_sync_item_failed", item=item.slug, error=str(exc))

                _sync_status["done"] = done
                _sync_status["errors"] = errors
                await asyncio.sleep(0.5)

            await session.commit()
            _sync_status["running"] = False
            _sync_status["last_full_sync"] = datetime.now(timezone.utc).isoformat()
            _sync_status["items_with_snapshots"] = await _count_items_with_snapshots(session)
            logger.info("full_sync_complete", total=total, errors=errors)


async def collect_stats_loop() -> None:
    while True:
        try:
            await _collect_price_snapshots()
        except Exception as exc:
            logger.error("collect_stats_loop_error", error=str(exc))
        await asyncio.sleep(_COLLECT_INTERVAL)


async def full_sync_loop() -> None:
    """Run a full catalogue price sync on startup (only if no data yet), then periodically."""
    async with async_session_factory() as session:
        count = await _count_items_with_snapshots(session)
        if count == 0:
            logger.info("no_snapshots_found_running_initial_full_sync")
            await _collect_all_price_snapshots()
        else:
            logger.info("snapshots_exist_skipping_startup_sync", count=count)
    while True:
        await asyncio.sleep(_FULL_SYNC_INTERVAL)
        try:
            await _collect_all_price_snapshots()
        except Exception as exc:
            logger.error("full_sync_loop_error", error=str(exc))


async def watchlist_loop() -> None:
    while True:
        try:
            await _check_watchlist()
        except Exception as exc:
            logger.error("watchlist_loop_error", error=str(exc))
        await asyncio.sleep(_CHECK_INTERVAL)
