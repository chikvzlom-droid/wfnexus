from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx
import structlog

from app.core.config import settings
from app.core.security import load_wfm_jwt

logger = structlog.get_logger(__name__)

WFM_BASE = settings.wf_market_base_url
_RATE_LIMIT = 2.0
_BURST = 5


def _stripped_jwt(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    for prefix in ("JWT ", "Bearer "):
        if raw.startswith(prefix):
            return raw.removeprefix(prefix).strip()
    return raw


class RateLimiter:
    """Token-bucket rate limiter."""

    def __init__(self, rate: float, burst: int) -> None:
        self.rate = rate
        self.burst = burst
        self.tokens = float(burst)
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(float(self.burst), self.tokens + elapsed * self.rate)
            self.last_refill = now
            if self.tokens < 1.0:
                wait = (1.0 - self.tokens) / self.rate
                logger.debug("rate_limit_wait", seconds=round(wait, 3))
                await asyncio.sleep(wait)
                self.tokens = 0.0
                self.last_refill = time.monotonic()
            else:
                self.tokens -= 1.0


class WFMarketClient:
    """Async HTTP client for warframe.market API V2."""

    def __init__(self) -> None:
        self._limiter = RateLimiter(_RATE_LIMIT, _BURST)
        self._client: httpx.AsyncClient | None = None
        self._jwt: str | None = None

    @property
    def _public_headers(self) -> dict[str, str]:
        return {
            "User-Agent": "WarframeNexus/0.1.0 (github.com/your-org/warframe-nexus)",
            "Accept": "application/json",
        }

    @property
    def _auth_headers(self) -> dict[str, str]:
        h = self._public_headers.copy()
        h["Content-Type"] = "application/json"
        raw = self._jwt or load_wfm_jwt()
        token = _stripped_jwt(raw)
        if token:
            h["Cookie"] = f"JWT={token}"
        return h

    async def _request(
        self, method: str, path: str, headers: dict[str, str] | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        await self._limiter.acquire()
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        url = f"{WFM_BASE}{path}"
        try:
            resp = await self._client.request(method, url, headers=headers or self._public_headers, **kwargs)
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
            return data
        except httpx.HTTPStatusError as e:
            logger.error("api_http_error", path=path, status=e.response.status_code, detail=e.response.text[:200])
            raise
        except httpx.RequestError as e:
            logger.error("api_request_error", path=path, error=str(e))
            raise

    # --- public endpoints ---

    async def get_items(self) -> list[dict[str, Any]]:
        data = await self._request("GET", "/items")
        return data.get("data", [])

    async def get_item(self, slug: str) -> dict[str, Any] | None:
        data = await self._request("GET", f"/items/{slug}")
        return data.get("data")

    async def get_orders(self, slug: str) -> list[dict[str, Any]]:
        data = await self._request("GET", f"/orders/item/{slug}")
        return data.get("data", [])

    async def get_top_orders(self, slug: str) -> dict[str, list[dict[str, Any]]]:
        data = await self._request("GET", f"/orders/item/{slug}/top")
        payload = data.get("data", {})
        return {
            "sell_orders": payload.get("sell", []),
            "buy_orders": payload.get("buy", []),
        }

    # --- authenticated V2 endpoints (JWT via Cookie) ---

    async def get_my_profile(self) -> dict[str, Any]:
        resp = await self._request("GET", "/me", headers=self._auth_headers)
        data = resp.get("data") or resp.get("payload", {})
        if isinstance(data, dict):
            profile = data.get("profile") or data.get("user") or data
            return profile
        return {}

    async def get_user_orders(self, username: str) -> list[dict[str, Any]]:
        data = await self._request("GET", f"/orders/user/{username}")
        raw = data.get("data", [])
        return raw if isinstance(raw, list) else []

    async def get_my_orders(self) -> list[dict[str, Any]]:
        profile = await self.get_my_profile()
        username = (
            profile.get("slug") or profile.get("ingameName") or profile.get("ingame_name")
            or profile.get("uniqueName")
        )
        if not username:
            logger.warning("could_not_determine_username_from_me", profile_keys=list(profile.keys()))
            return []
        return await self.get_user_orders(username)

    async def post_order(self, body: dict[str, Any]) -> dict[str, Any]:
        data = await self._request("POST", "/order", headers=self._auth_headers, json=body)
        return data.get("data", {})

    async def delete_remote_order(self, order_id: str) -> None:
        await self._request("DELETE", f"/order/{order_id}", headers=self._auth_headers)

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None


_wfm_client: WFMarketClient | None = None


def get_wfm_client() -> WFMarketClient:
    global _wfm_client
    if _wfm_client is None:
        _wfm_client = WFMarketClient()
    return _wfm_client
