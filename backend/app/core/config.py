from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    database_url: str = "sqlite+aiosqlite:///./data/warframe_nexus.db"
    wf_market_base_url: str = "https://api.warframe.market/v2"
    wf_market_jwt: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    ntfy_topic: str = ""
    discord_webhook_url: str = ""
    log_level: str = "INFO"

    @property
    def db_path(self) -> Path:
        if self.database_url.startswith("sqlite+aiosqlite:///"):
            raw = self.database_url.removeprefix("sqlite+aiosqlite:///")
            return Path(raw).resolve()
        return Path("data/warframe_nexus.db")


settings = Settings()
