from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_orders_empty(client: AsyncClient):
    resp = await client.get("/api/v1/trading/orders")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_order_not_found(client: AsyncClient):
    resp = await client.post(
        "/api/v1/trading/orders",
        json={"item_id": "no_such", "order_type": "sell", "platinum": 50, "quantity": 1},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_and_list_orders(client: AsyncClient, sample_item):
    resp = await client.post(
        "/api/v1/trading/orders",
        json={"item_id": sample_item.id, "order_type": "sell", "platinum": 75, "quantity": 2},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["item_id"] == sample_item.id
    assert data["platinum"] == 75
    assert data["quantity"] == 2
    assert data["order_type"] == "sell"
    assert data["item"] is not None

    resp = await client.get("/api/v1/trading/orders")
    orders = resp.json()
    assert len(orders) == 1
    assert orders[0]["platinum"] == 75


@pytest.mark.asyncio
async def test_update_order(client: AsyncClient, sample_item):
    resp = await client.post(
        "/api/v1/trading/orders",
        json={"item_id": sample_item.id, "order_type": "buy", "platinum": 30, "quantity": 1},
    )
    order_id = resp.json()["id"]

    resp = await client.put(
        f"/api/v1/trading/orders/{order_id}",
        json={"platinum": 25, "quantity": 3, "notes": "updated"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["platinum"] == 25
    assert data["quantity"] == 3
    assert data["notes"] == "updated"


@pytest.mark.asyncio
async def test_delete_order(client: AsyncClient, sample_item):
    resp = await client.post(
        "/api/v1/trading/orders",
        json={"item_id": sample_item.id, "order_type": "sell", "platinum": 100, "quantity": 1},
    )
    order_id = resp.json()["id"]

    resp = await client.delete(f"/api/v1/trading/orders/{order_id}")
    assert resp.status_code == 204

    resp = await client.get("/api/v1/trading/orders")
    assert resp.json() == []


@pytest.mark.asyncio
async def test_update_not_found(client: AsyncClient):
    resp = await client.put("/api/v1/trading/orders/99999", json={"platinum": 50})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_not_found(client: AsyncClient):
    resp = await client.delete("/api/v1/trading/orders/99999")
    assert resp.status_code == 404
