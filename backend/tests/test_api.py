from __future__ import annotations

import pytest
import respx
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


@pytest.mark.asyncio
async def test_list_items_empty(client: AsyncClient):
    resp = await client.get("/api/v1/market/items")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_get_item_not_found(client: AsyncClient):
    resp = await client.get("/api/v1/market/items/nonexistent-slug")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_oracle_not_found(client: AsyncClient):
    resp = await client.get("/api/v1/market/items/missing/oracle")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_sync_catalogue(client: AsyncClient):
    wfm_url = f"{settings.wf_market_base_url}/items"
    mock_payload = {
        "apiVersion": "0.25.0",
        "data": [
            {"id": "abc123", "slug": "test_item", "i18n": {"en": {"name": "Test Item"}}, "tags": []},
        ],
    }
    async with respx.mock:
        respx.get(wfm_url).respond(json=mock_payload, status_code=200)
        resp = await client.post("/api/v1/market/sync")
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced"] == 1


@pytest.mark.asyncio
async def test_watchlist_crud(client: AsyncClient):
    resp = await client.get("/api/v1/market/watchlist")
    assert resp.status_code == 200
    assert resp.json() == []

    resp = await client.post(
        "/api/v1/market/watchlist",
        json={"item_id": "no_such", "target_price": 50, "direction": "below"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_order_distribution_not_found(client: AsyncClient):
    resp = await client.get("/api/v1/market/items/missing/orders/distribution")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_price_history_not_found(client: AsyncClient):
    resp = await client.get("/api/v1/market/items/missing/history")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_order_distribution_with_data(client: AsyncClient, sample_item):
    slug = "test_prime_set"
    orders_url = f"{settings.wf_market_base_url}/orders/item/{slug}"
    mock_orders = [
        {"platinum": 10, "quantity": 1, "order_type": "sell", "type": "sell", "visible": True},
        {"platinum": 20, "quantity": 2, "order_type": "sell", "type": "sell", "visible": True},
        {"platinum": 25, "quantity": 1, "order_type": "sell", "type": "sell", "visible": True},
        {"platinum": 5, "quantity": 1, "order_type": "buy", "type": "buy", "visible": True},
    ]
    async with respx.mock:
        respx.get(orders_url).respond(json={"apiVersion": "0.25.0", "data": mock_orders}, status_code=200)
        resp = await client.get(f"/api/v1/market/items/{slug}/orders/distribution")
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == slug
    assert data["sell_count"] == 3
    assert data["buy_count"] == 1
    assert len(data["buckets"]) > 0
    assert data["min_price"] == 10
    assert data["max_price"] == 25


@pytest.mark.asyncio
async def test_price_history_empty(client: AsyncClient, sample_item):
    slug = "test_prime_set"
    resp = await client.get(f"/api/v1/market/items/{slug}/history")
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == slug
    assert data["points"] == []
