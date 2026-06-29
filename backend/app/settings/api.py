from __future__ import annotations

import httpx
import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.settings.models import Setting
from app.settings.schemas import NotificationSettings, NotificationSettingsUpdate

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

KEYS = ["ntfy_topic", "discord_webhook_url"]


async def _get_settings(db: AsyncSession) -> dict[str, str]:
    result = await db.execute(select(Setting).where(Setting.key.in_(KEYS)))
    out = {}
    for row in result.scalars().all():
        out[row.key] = row.value or ""
    for k in KEYS:
        out.setdefault(k, "")
    return out


async def _set_settings(db: AsyncSession, data: dict[str, str]) -> None:
    for key, value in data.items():
        if key not in KEYS:
            continue
        existing = await db.get(Setting, key)
        if existing:
            existing.value = value
        else:
            db.add(Setting(key=key, value=value))


@router.get("/notifications", response_model=NotificationSettings)
async def get_notification_settings(db: AsyncSession = Depends(get_db)):
    vals = await _get_settings(db)
    return NotificationSettings(**vals)


@router.put("/notifications", response_model=NotificationSettings)
async def update_notification_settings(
    data: NotificationSettingsUpdate, db: AsyncSession = Depends(get_db)
):
    await _set_settings(db, data.model_dump())
    await db.flush()
    vals = await _get_settings(db)
    return NotificationSettings(**vals)


@router.post("/notifications/test", response_model=dict)
async def test_notification_settings(db: AsyncSession = Depends(get_db)):
    vals = await _get_settings(db)
    ntfy_topic = vals.get("ntfy_topic", "")
    discord_webhook = vals.get("discord_webhook_url", "")

    sent = []
    msg = "Warframe Nexus — test notification"

    if ntfy_topic:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"https://ntfy.sh/{ntfy_topic}",
                    content=msg,
                    headers={"Title": "Warframe Nexus", "Tags": "warning"},
                )
                resp.raise_for_status()
                sent.append("ntfy")
        except Exception as exc:
            logger.error("ntfy_test_failed", error=str(exc))

    if discord_webhook:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(discord_webhook, json={"content": msg})
                resp.raise_for_status()
                sent.append("discord")
        except Exception as exc:
            logger.error("discord_test_failed", error=str(exc))

    return {"sent": sent, "configured": {"ntfy": bool(ntfy_topic), "discord": bool(discord_webhook)}}
