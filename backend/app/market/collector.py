from __future__ import annotations

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.market.client import get_wfm_client
from app.market.models import Item

logger = structlog.get_logger(__name__)


async def sync_item_catalogue(session: AsyncSession) -> int:
    """Fetch all items from WFM V2 and upsert into local DB."""
    client = get_wfm_client()
    raw_items = await client.get_items()
    count = 0
    for raw in raw_items:
        item_id = raw.get("id", "")
        slug = raw.get("slug", "")
        if not item_id or not slug:
            continue
        i18n = raw.get("i18n", {})
        en = i18n.get("en", {})
        name = en.get("name", slug)

        existing = await session.get(Item, item_id)
        if existing is None:
            existing = Item(id=item_id)
        existing.name = name
        existing.slug = slug
        existing.category = ", ".join(raw.get("tags", [])) or None
        raw_tags = raw.get("tags", []) or []
        existing.subcategory = None
        existing.ducats = raw.get("ducats") if raw.get("ducats") is not None else None
        existing.is_set = "set" in raw_tags
        existing.thumbnail = en.get("icon")
        session.add(existing)
        count += 1
    await session.commit()
    logger.info("catalogue_synced", items=count)
    return count
