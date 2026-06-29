from __future__ import annotations

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)


async def send_telegram(message: str) -> bool:
    token = settings.telegram_bot_token
    chat_id = settings.telegram_chat_id
    if not token or not chat_id:
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"})
            resp.raise_for_status()
            logger.info("telegram_sent")
            return True
    except Exception as exc:
        logger.error("telegram_failed", error=str(exc))
        return False


async def send_ntfy(message: str) -> bool:
    topic = settings.ntfy_topic
    if not topic:
        return False
    url = f"https://ntfy.sh/{topic}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, content=message, headers={"Title": "Warframe Nexus", "Tags": "warning"})
            resp.raise_for_status()
            logger.info("ntfy_sent", topic=topic)
            return True
    except Exception as exc:
        logger.error("ntfy_failed", error=str(exc))
        return False


async def send_discord(message: str) -> bool:
    webhook = settings.discord_webhook_url
    if not webhook:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook, json={"content": message})
            resp.raise_for_status()
            logger.info("discord_sent")
            return True
    except Exception as exc:
        logger.error("discord_failed", error=str(exc))
        return False


async def send_notification(message: str) -> None:
    sent = False
    if await send_telegram(message):
        sent = True
    if await send_ntfy(message):
        sent = True
    if await send_discord(message):
        sent = True
    if not sent:
        logger.warning("no_notification_provider_configured")
