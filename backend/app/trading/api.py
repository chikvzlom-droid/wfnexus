from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import date, datetime, timedelta

from pydantic import BaseModel, Field

import numpy as np
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Literal
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.market.client import get_wfm_client
from app.market.models import Item
from app.trading.models import TradeEntry, TradeOrder, Transaction
from app.trading.schemas import (
    CategoryReport,
    DashboardData,
    DailyProfit,
    GenerateMessageRequest,
    GenerateMessageResponse,
    PaginatedTradeEntries,
    PaginatedTransactions,
    TradeCreate,
    TradeEntryCreate,
    TradeEntryOut,
    TradeEntryUpdate,
    TradeOut,
    TradeUpdate,
    TradeWfmSyncOut,
    TransactionCreate,
    TransactionOut,
    TransactionReport,
    TransactionUpdate,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/trading", tags=["trading"])


@router.get("/orders", response_model=list[TradeOut])
async def list_orders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TradeOrder).order_by(TradeOrder.updated_at.desc())
    )
    return [TradeOut.model_validate(r) for r in result.scalars().all()]


@router.post("/orders", response_model=TradeOut, status_code=201)
async def create_order(data: TradeCreate, db: AsyncSession = Depends(get_db)):
    item = await db.get(Item, data.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    order = TradeOrder(
        item_id=data.item_id,
        order_type=data.order_type,
        platinum=data.platinum,
        quantity=data.quantity,
        visible=data.visible,
        notes=data.notes,
    )
    db.add(order)
    await db.flush()
    await db.refresh(order)
    return TradeOut.model_validate(order)


@router.put("/orders/{order_id}", response_model=TradeOut)
async def update_order(order_id: int, data: TradeUpdate, db: AsyncSession = Depends(get_db)):
    order = await db.get(TradeOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if data.platinum is not None:
        order.platinum = data.platinum
    if data.quantity is not None:
        order.quantity = data.quantity
    if data.visible is not None:
        order.visible = data.visible
    if data.status is not None:
        order.status = data.status
    if data.notes is not None:
        order.notes = data.notes
    await db.flush()
    await db.refresh(order)
    return TradeOut.model_validate(order)


@router.delete("/orders/{order_id}", status_code=204)
async def delete_order(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await db.get(TradeOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    await db.delete(order)
    await db.commit()


@router.post("/sync", response_model=TradeWfmSyncOut)
async def sync_with_wfm(db: AsyncSession = Depends(get_db)):
    """Post pending local orders to WFM and pull remote orders."""
    result = TradeWfmSyncOut()
    client = get_wfm_client()

    pending = await db.execute(
        select(TradeOrder).where(TradeOrder.wfm_id.is_(None), TradeOrder.status == "active")
    )
    pending_orders = pending.scalars().all()

    for order in pending_orders:
        try:
            body: dict = {
                "itemId": order.item_id,
                "type": order.order_type,
                "platinum": round(order.platinum),
                "quantity": order.quantity,
                "visible": order.visible,
            }
            if order.item and order.item.mod_rank is not None:
                body["rank"] = 0
            resp = await client.post_order(body)
            wfm_id = resp.get("id") or resp.get("order", {}).get("id")
            if wfm_id:
                order.wfm_id = str(wfm_id)
                result.posted += 1
            else:
                result.errors.append(f"No WFM id for order #{order.id}")
        except Exception as exc:
            logger.error("post_order_failed", order_id=order.id, error=str(exc))
            result.errors.append(f"Order #{order.id}: {exc}")

    try:
        remote = await client.get_my_orders()
        remote_ids = set()
        for ro in remote:
            rid = str(ro.get("id"))
            if rid:
                remote_ids.add(rid)

        # 1. Import remote orders not in local DB
        for ro in remote:
            wfm_id = str(ro.get("id", ""))
            if not wfm_id:
                continue
            existing = await db.execute(
                select(TradeOrder).where(TradeOrder.wfm_id == wfm_id).limit(1)
            )
            if existing.scalar_one_or_none():
                continue
            item_id = ro.get("itemId") or ro.get("item_id", "")
            item = await db.get(Item, item_id) if item_id else None
            if item is None:
                logger.warning("sync_unknown_item", item_id=item_id, wfm_id=wfm_id)
                continue
            order = TradeOrder(
                item_id=item_id,
                wfm_id=wfm_id,
                order_type=ro.get("type", "sell"),
                platinum=float(ro.get("platinum", 0)),
                quantity=int(ro.get("quantity", 1)),
                visible=bool(ro.get("visible", True)),
                status="active",
            )
            db.add(order)
            result.imported += 1

        # 2. Mark local orders no longer on WFM as completed + create tx
        local_with_wfm = await db.execute(
            select(TradeOrder).where(TradeOrder.wfm_id.isnot(None))
        )
        for lo in local_with_wfm.scalars().all():
            if lo.wfm_id and lo.wfm_id not in remote_ids and lo.status == "active":
                lo.status = "completed"
                existing_tx = await db.execute(
                    select(Transaction).where(Transaction.wfm_id == lo.wfm_id).limit(1)
                )
                if not existing_tx.scalar_one_or_none():
                    tx = Transaction(
                        item_id=lo.item_id,
                        wfm_id=lo.wfm_id,
                        item_name=lo.item.name if lo.item else "Unknown",
                        transaction_type="sale" if lo.order_type == "sell" else "purchase",
                        price=round(lo.platinum),
                        quantity=lo.quantity,
                        credits=lo.quantity * 25 if lo.order_type == "sell" else 0,
                    )
                    if tx.transaction_type == "sale":
                        last_purchase = await _find_last_purchase(db, lo.item_id)
                        if last_purchase:
                            tx.profit = _calculate_profit(
                                tx.price, tx.quantity,
                                last_purchase.price, last_purchase.quantity,
                            )
                    db.add(tx)
    except Exception as exc:
        logger.error("sync_remote_failed", error=str(exc))
        result.errors.append(f"Remote sync: {exc}")

    await db.flush()
    return result


def _calculate_profit(
    sale_price: int, sale_quantity: int, purchase_price: int, purchase_quantity: int
) -> int:
    sale_per_unit = sale_price // sale_quantity
    purchase_per_unit = purchase_price // purchase_quantity
    return (sale_per_unit - purchase_per_unit) * sale_quantity


async def _find_last_purchase(
    db: AsyncSession, item_id: str
) -> Transaction | None:
    result = await db.execute(
        select(Transaction)
        .where(
            Transaction.item_id == item_id,
            Transaction.transaction_type == "purchase",
        )
        .order_by(Transaction.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


class ProcessTradeRequest(BaseModel):
    transaction_type: str = Field(description="'sale' or 'purchase'")
    user_name: str = Field(default="")
    items: list[ProcessTradeItem]


@router.post("/process", response_model=list[TransactionOut], status_code=201)
async def process_trade(
    data: ProcessTradeRequest,
    db: AsyncSession = Depends(get_db),
):
    created = []
    for entry in data.items:
        item = await db.get(Item, entry.item_id)
        if item is None:
            raise HTTPException(status_code=404, detail=f"Item {entry.item_id} not found")
        profit = None
        if data.transaction_type == "sale":
            last_purchase = await _find_last_purchase(db, entry.item_id)
            if last_purchase:
                profit = _calculate_profit(
                    entry.price, entry.quantity,
                    last_purchase.price, last_purchase.quantity,
                )
        tx = Transaction(
            item_id=entry.item_id,
            item_name=item.name,
            item_unique_name=item.slug,
            transaction_type=data.transaction_type,
            price=entry.price,
            quantity=entry.quantity,
            user_name=data.user_name or entry.user_name,
            credits=entry.credits,
            profit=profit,
            notes=entry.notes,
        )
        db.add(tx)
        created.append(tx)
    await db.flush()
    for tx in created:
        await db.refresh(tx)
    return [TransactionOut.model_validate(tx) for tx in created]


async def _get_item_category(db: AsyncSession, tx: Transaction) -> str:
    if tx.item_type == "riven":
        return "Riven"
    if tx.tags:
        tl = tx.tags.lower()
        if "riven" in tl:
            return "Riven"
        if "arcane_enhancement" in tl:
            return "Arcane"
        if "relic" in tl:
            return "Relic"
        if "set" in tl:
            return "Set"
        if "prime" in tl:
            return "Prime"
        if "mod" in tl:
            return "Mod"
    if tx.item_id:
        item = await db.get(Item, tx.item_id)
        if item and item.category:
            cl = item.category.lower()
            if "riven" in cl:
                return "Riven"
            if "arcane_enhancement" in cl:
                return "Arcane"
            if "relic" in cl:
                return "Relic"
            if "set" in cl:
                return "Set"
            if "prime" in cl:
                return "Prime"
            if "mod" in cl:
                return "Mod"
    return "Other"


async def _build_category_report(db: AsyncSession, txs: list[Transaction]) -> list[CategoryReport]:
    cats: dict[str, dict] = {}
    for tx in txs:
        name = await _get_item_category(db, tx)
        entry = cats.setdefault(name, {"revenue": 0, "expenses": 0, "count": 0})
        entry["count"] += 1
        if tx.transaction_type == "sale":
            entry["revenue"] += tx.price
        else:
            entry["expenses"] += tx.price
    result = []
    for name, data in sorted(cats.items()):
        profit = data["revenue"] - data["expenses"]
        margin = round(data["revenue"] / (data["expenses"] or 1), 2)
        result.append(CategoryReport(
            name=name, revenue=data["revenue"], expenses=data["expenses"],
            profit=profit, count=data["count"], profit_margin=margin,
        ))
    return result


SORTABLE_COLUMNS = {
    "item_name", "item_type", "transaction_type", "user_name",
    "price", "quantity", "profit", "credits", "created_at",
}


@router.get("/transactions", response_model=PaginatedTransactions)
async def list_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    transaction_type: str | None = None,
    item_type: str | None = None,
    q: str | None = None,
    from_date: str | None = Query(None, description="YYYY-MM-DD"),
    to_date: str | None = Query(None, description="YYYY-MM-DD"),
    sort_by: str | None = Query(None, description="Column to sort by"),
    sort_order: Literal["asc", "desc"] = "desc",
    db: AsyncSession = Depends(get_db),
):
    if sort_by and sort_by in SORTABLE_COLUMNS:
        col = getattr(Transaction, sort_by)
        order = col.asc() if sort_order == "asc" else col.desc()
    else:
        order = Transaction.created_at.desc()
    query: Select = select(Transaction).order_by(order)
    if transaction_type:
        query = query.where(Transaction.transaction_type == transaction_type)
    if item_type:
        query = query.where(Transaction.item_type == item_type)
    if q:
        like = f"%{q}%"
        query = query.where(
            Transaction.item_name.ilike(like) | Transaction.user_name.ilike(like)
        )
    if from_date:
        query = query.where(Transaction.created_at >= from_date)
    if to_date:
        query = query.where(Transaction.created_at <= to_date + " 23:59:59")
    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0
    total_pages = math.ceil(total / limit)
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    items = [TransactionOut.model_validate(r) for r in result.scalars().all()]
    return PaginatedTransactions(
        results=items, total=total, page=page, total_pages=total_pages
    )


@router.post("/transactions", response_model=TransactionOut, status_code=201)
async def create_transaction(data: TransactionCreate, db: AsyncSession = Depends(get_db)):
    item = await db.get(Item, data.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    profit = None
    if data.transaction_type == "sale":
        last_purchase = await _find_last_purchase(db, data.item_id)
        if last_purchase:
            profit = _calculate_profit(
                data.price, data.quantity,
                last_purchase.price, last_purchase.quantity,
            )
    tx = Transaction(
        item_id=data.item_id,
        item_name=item.name,
        item_unique_name=item.slug,
        transaction_type=data.transaction_type,
        price=data.price,
        quantity=data.quantity,
        user_name=data.user_name,
        credits=data.credits,
        profit=profit,
        notes=data.notes,
    )
    db.add(tx)
    await db.flush()
    await db.refresh(tx)
    return TransactionOut.model_validate(tx)


@router.put("/transactions/{tx_id}", response_model=TransactionOut)
async def update_transaction(
    tx_id: int, data: TransactionUpdate, db: AsyncSession = Depends(get_db)
):
    tx = await db.get(Transaction, tx_id)
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if data.price is not None:
        tx.price = data.price
    if data.quantity is not None:
        tx.quantity = data.quantity
    if data.user_name is not None:
        tx.user_name = data.user_name
    if data.credits is not None:
        tx.credits = data.credits
    if data.notes is not None:
        tx.notes = data.notes
    if data.is_locked is not None:
        tx.is_locked = data.is_locked
    await db.flush()
    await db.refresh(tx)
    return TransactionOut.model_validate(tx)


@router.delete("/transactions/{tx_id}", status_code=204)
async def delete_transaction(tx_id: int, db: AsyncSession = Depends(get_db)):
    tx = await db.get(Transaction, tx_id)
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.is_locked:
        raise HTTPException(status_code=403, detail="Transaction is locked")
    await db.delete(tx)
    await db.commit()


@router.get("/trade-entries", response_model=PaginatedTradeEntries)
async def list_trade_entries(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    group: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query: Select = select(TradeEntry).order_by(TradeEntry.updated_at.desc())
    if group:
        query = query.where(TradeEntry.group == group)
    if q:
        like = f"%{q}%"
        query = query.where(TradeEntry.item_name.ilike(like))
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0
    total_pages = math.ceil(total / limit)
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    entries = result.scalars().all()

    client = get_wfm_client()
    out = []
    for entry in entries:
        market_price = None
        min_price = None
        potential_profit = None
        if entry.item_id:
            try:
                item = await db.get(Item, entry.item_id)
                if item:
                    orders = await client.get_orders(item.slug)
                    sell_prices = [float(o["platinum"]) for o in orders if o.get("type") == "sell" and float(o.get("platinum", 0)) > 0]
                    if sell_prices:
                        min_price = int(min(sell_prices))
                        market_price = int(np.median(sell_prices))
                        potential_profit = market_price - entry.price
                        if potential_profit < 0:
                            potential_profit = None
            except Exception:
                pass
        obj = TradeEntryOut.model_validate(entry)
        obj.potential_profit = potential_profit
        obj.min_price = min_price
        obj.market_price = market_price
        out.append(obj)

    return PaginatedTradeEntries(results=out, total=total, page=page, total_pages=total_pages)


@router.post("/trade-entries", response_model=TradeEntryOut, status_code=201)
async def create_trade_entry(data: TradeEntryCreate, db: AsyncSession = Depends(get_db)):
    item_name = data.item_name
    if data.item_id and not item_name:
        item = await db.get(Item, data.item_id)
        if item:
            item_name = item.name
    entry = TradeEntry(
        item_id=data.item_id,
        item_name=item_name or "Unknown",
        price=data.price,
        quantity=data.quantity,
        group=data.group,
        tags=data.tags,
        notes=data.notes,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return TradeEntryOut.model_validate(entry)


@router.put("/trade-entries/{entry_id}", response_model=TradeEntryOut)
async def update_trade_entry(
    entry_id: int, data: TradeEntryUpdate, db: AsyncSession = Depends(get_db)
):
    entry = await db.get(TradeEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Trade entry not found")
    if data.price is not None:
        entry.price = data.price
    if data.quantity is not None:
        entry.quantity = data.quantity
    if data.tags is not None:
        entry.tags = data.tags
    if data.notes is not None:
        entry.notes = data.notes
    await db.flush()
    await db.refresh(entry)
    return TradeEntryOut.model_validate(entry)


@router.delete("/trade-entries/{entry_id}", status_code=204)
async def delete_trade_entry(entry_id: int, db: AsyncSession = Depends(get_db)):
    entry = await db.get(TradeEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Trade entry not found")
    await db.delete(entry)
    await db.commit()


@router.post("/trade-entries/generate-message", response_model=GenerateMessageResponse)
async def generate_trade_message(
    data: GenerateMessageRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TradeEntry).where(TradeEntry.id.in_(data.ids)).order_by(TradeEntry.id)
    )
    entries = result.scalars().all()
    lines = []
    for e in entries:
        full = f"[{e.item_name}]" if e.item_name else ""
        if e.quantity > 1:
            full += f" x{e.quantity}"
        full += f" {e.price}p"
        lines.append(full)
    return GenerateMessageResponse(
        message="\n".join(lines),
        count=len(lines),
    )


@router.get("/dashboard", response_model=DashboardData)
async def dashboard(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Transaction).order_by(Transaction.created_at.desc()))
    all_tx = result.scalars().all()

    total_revenue = sum(t.price for t in all_tx if t.transaction_type == "sale")
    total_expenses = sum(t.price for t in all_tx if t.transaction_type == "purchase")

    today_start = datetime.combine(date.today(), datetime.min.time())
    today_tx = [t for t in all_tx if t.created_at >= today_start]
    today_revenue = sum(t.price for t in today_tx if t.transaction_type == "sale")
    today_expenses = sum(t.price for t in today_tx if t.transaction_type == "purchase")

    seller_profits: dict[str, dict[str, int]] = {}
    for t in all_tx:
        if t.transaction_type == "sale" and t.profit is not None:
            entry = seller_profits.setdefault(t.item_name, {"profit": 0, "count": 0})
            entry["profit"] += t.profit
            entry["count"] += 1
    best_seller_name = ""
    best_seller_profit = 0
    best_seller_count = 0
    for name, data in seller_profits.items():
        if data["profit"] > best_seller_profit:
            best_seller_name = name
            best_seller_profit = data["profit"]
            best_seller_count = data["count"]

    last_14 = [(date.today() - timedelta(days=i)) for i in range(13, -1, -1)]
    daily_map: dict[str, list] = defaultdict(list)
    for t in all_tx:
        day_key = t.created_at.strftime("%Y-%m-%d")
        daily_map[day_key].append(t)
    daily_profit = []
    for d in last_14:
        key = d.isoformat()
        day_tx = daily_map.get(key, [])
        rev = sum(t.price for t in day_tx if t.transaction_type == "sale")
        exp = sum(t.price for t in day_tx if t.transaction_type == "purchase")
        daily_profit.append(DailyProfit(
            date=key,
            profit=rev - exp,
            sales=sum(1 for t in day_tx if t.transaction_type == "sale"),
            purchases=sum(1 for t in day_tx if t.transaction_type == "purchase"),
        ))

    recent = [TransactionOut.model_validate(t) for t in all_tx[:8]]
    categories = await _build_category_report(db, all_tx)

    return DashboardData(
        total_transactions=len(all_tx),
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        total_profit=total_revenue - total_expenses,
        today_transactions=len(today_tx),
        today_profit=today_revenue - today_expenses,
        best_seller_name=best_seller_name,
        best_seller_profit=best_seller_profit,
        best_seller_count=best_seller_count,
        daily_profit=daily_profit,
        recent_transactions=recent,
        categories=categories,
    )


@router.post("/import-gdpr", response_model=dict)
async def import_gdpr(body: dict, db: AsyncSession = Depends(get_db)):
    """Import Warframe GDPR data export (JSON) to create Transactions."""
    created = 0
    errors = []
    trade_history = body.get("TradeHistory", body.get("trade_history", []))
    if not isinstance(trade_history, list):
        return {"created": 0, "errors": ["No TradeHistory found in data"]}

    for trade in trade_history:
        try:
            items_given = trade.get("ItemsGiven", trade.get("items_given", []))
            items_received = trade.get("ItemsReceived", trade.get("items_received", []))
            plat_given = int(trade.get("PlatinumGiven", trade.get("platinum_given", 0)))
            plat_received = int(trade.get("PlatinumReceived", trade.get("platinum_received", 0)))
            trader = trade.get("TraderName", trade.get("trader_name", "Unknown"))
            trade_date = trade.get("TradeDate", trade.get("trade_date"))

            if plat_received > 0:
                for item in (items_given if items_given else [{"ItemName": "Platinum", "ItemCount": 1}]):
                    iname = item.get("ItemName", item.get("item_name", "Unknown"))
                    tx = Transaction(
                        item_name=iname,
                        transaction_type="sale",
                        price=plat_received,
                        quantity=int(item.get("ItemCount", item.get("item_count", 1))),
                        user_name=trader,
                        item_unique_name=iname.lower().replace(" ", "_"),
                    )
                    if trade_date:
                        try:
                            tx.created_at = datetime.fromisoformat(trade_date.replace("T", " ")[:19])
                        except Exception:
                            pass
                    db.add(tx)
                    created += 1

            if plat_given > 0:
                for item in (items_received if items_received else [{"ItemName": "Platinum", "ItemCount": 1}]):
                    iname = item.get("ItemName", item.get("item_name", "Unknown"))
                    tx = Transaction(
                        item_name=iname,
                        transaction_type="purchase",
                        price=plat_given,
                        quantity=int(item.get("ItemCount", item.get("item_count", 1))),
                        user_name=trader,
                        item_unique_name=iname.lower().replace(" ", "_"),
                    )
                    if trade_date:
                        try:
                            tx.created_at = datetime.fromisoformat(trade_date.replace("T", " ")[:19])
                        except Exception:
                            pass
                    db.add(tx)
                    created += 1
        except Exception as exc:
            errors.append(str(exc))

    await db.commit()
    return {"created": created, "errors": errors}


class KnapsackItem(BaseModel):
    item_id: str
    item_name: str
    buy_price: float = Field(gt=0)
    sell_price: float = Field(gt=0)
    max_quantity: int = Field(default=1, ge=1)


class KnapsackRequest(BaseModel):
    budget: float = Field(gt=0, description="Platinum budget")
    items: list[KnapsackItem]


class KnapsackResultItem(BaseModel):
    item_id: str
    item_name: str
    buy_price: float
    sell_price: float
    quantity: int
    total_cost: float
    total_profit: float


class KnapsackOut(BaseModel):
    total_cost: float
    total_profit: float
    total_revenue: float
    items: list[KnapsackResultItem]


@router.post("/knapsack", response_model=KnapsackOut)
async def knapsack_optimize(body: KnapsackRequest):
    """Optimal buy order allocation under a platinum budget (fractional knapsack)."""
    if not body.items or body.budget <= 0:
        return KnapsackOut(total_cost=0, total_profit=0, total_revenue=0, items=[])

    scored = [
        (i.item_id, i.item_name, i.buy_price, i.sell_price, i.max_quantity,
         (i.sell_price - i.buy_price) / i.buy_price)
        for i in body.items if i.sell_price > i.buy_price
    ]
    scored.sort(key=lambda x: -x[5])

    total_cost = 0.0
    total_profit = 0.0
    result = []

    for item_id, item_name, buy, sell, max_qty, _ in scored:
        if total_cost >= body.budget:
            break
        per_unit = buy
        if per_unit <= 0:
            continue
        max_afford = int((body.budget - total_cost) // per_unit)
        qty = min(max_qty, max_afford)
        if qty <= 0:
            continue
        cost = round(qty * per_unit, 2)
        profit = round(qty * (sell - buy), 2)
        total_cost += cost
        total_profit += profit
        result.append(KnapsackResultItem(
            item_id=item_id, item_name=item_name,
            buy_price=buy, sell_price=sell,
            quantity=qty, total_cost=cost, total_profit=profit,
        ))

    return KnapsackOut(
        total_cost=round(total_cost, 2),
        total_profit=round(total_profit, 2),
        total_revenue=round(total_cost + total_profit, 2),
        items=result,
    )


@router.get("/transactions/report", response_model=TransactionReport)
async def transaction_report(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Transaction))
    all_tx = result.scalars().all()
    sales = [t for t in all_tx if t.transaction_type == "sale"]
    purchases = [t for t in all_tx if t.transaction_type == "purchase"]
    revenue = sum(t.price for t in sales)
    expenses = sum(t.price for t in purchases)
    total_profit = revenue - expenses
    total_transactions = len(all_tx)
    categories = await _build_category_report(db, all_tx)
    return TransactionReport(
        total_transactions=total_transactions,
        sale_count=len(sales),
        purchases_count=len(purchases),
        revenue=revenue,
        expenses=expenses,
        total_profit=total_profit,
        average_profit=round(total_profit / total_transactions, 2) if total_transactions else 0,
        profit_margin=round(revenue / (expenses or 1), 2),
        roi=round(((revenue - expenses) / (expenses or 1)) * 100, 2),
        highest_revenue=max((t.price for t in sales), default=0),
        highest_expense=max((t.price for t in purchases), default=0),
        categories=categories,
    )
