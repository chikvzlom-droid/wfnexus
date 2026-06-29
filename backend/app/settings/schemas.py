from __future__ import annotations

from pydantic import BaseModel


class NotificationSettings(BaseModel):
    ntfy_topic: str = ""
    discord_webhook_url: str = ""


class NotificationSettingsUpdate(BaseModel):
    ntfy_topic: str = ""
    discord_webhook_url: str = ""
