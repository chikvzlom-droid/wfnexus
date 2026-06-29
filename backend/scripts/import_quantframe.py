"""Import transactions from Quantframe SQLite database into our app."""
from __future__ import annotations

import sqlite3
from datetime import datetime

import structlog
from sqlalchemy import select

from app.core.database import async_session_factory, engine
from app.market.models import Item
from app.trading.models import Transaction

logger = structlog.get_logger(__name__)

QUANTFRAME_DB = r"D:\wfcheckrtsyn\papka\aaa\quantframeV2.sqlite"


def load_quantframe_transactions() -> list[dict]:
    conn = sqlite3.connect(QUANTFRAME_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute('SELECT * FROM "transaction" ORDER BY id')
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


async def migrate():
    """Add is_locked column if not exists."""
    async with engine.connect() as conn:
        await conn.exec_driver_sql(
            "ALTER TABLE transactions ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT 0"
        )
        await conn.commit()


async def import_all() -> int:
    qf_txs = load_quantframe_transactions()
    logger.info("loaded_quantframe_transactions", count=len(qf_txs))

    try:
        await migrate()
    except Exception:
        pass  # column already exists

    async with async_session_factory() as db:
        existing = await db.execute(select(Transaction.wfm_id))
        existing_ids = {row[0] for row in existing.fetchall() if row[0]}

        imported = 0
        for qtx in qf_txs:
            if qtx["wfm_id"] in existing_ids:
                continue

            slug = qtx["wfm_url"]
            item = await db.get(Item, slug)
            if item is None:
                existing = await db.execute(
                    select(Item).where(Item.slug == slug).limit(1)
                )
                item = existing.scalar_one_or_none()
            if item is None:
                item = Item(
                    id=slug,
                    name=qtx["item_name"],
                    slug=slug,
                )
                db.add(item)
                await db.flush()

            created = datetime.fromisoformat(qtx["created_at"])
            tx = Transaction(
                item_id=slug,
                wfm_id=qtx["wfm_id"],
                wfm_url=slug,
                item_name=qtx["item_name"],
                item_unique_name=qtx.get("item_unique_name"),
                item_type=qtx.get("item_type", "item"),
                transaction_type=qtx["transaction_type"],
                price=qtx["price"],
                quantity=qtx.get("quantity", 1),
                profit=qtx.get("profit"),
                credits=qtx.get("credits", 0),
                user_name=qtx.get("user_name", ""),
                tags=qtx.get("tags", ""),
                properties=qtx.get("properties") or qtx.get("sub_type"),
                created_at=created,
                updated_at=created,
            )
            db.add(tx)
            imported += 1

        await db.commit()
        logger.info("import_complete", imported=imported, skipped=len(qf_txs) - imported)
        return imported


if __name__ == "__main__":
    import asyncio

    async def main():
        count = await import_all()
        print(f"Imported {count} transactions")

    asyncio.run(main())
