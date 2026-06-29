from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.market.schemas import ItemOut


class InventoryItemCreate(BaseModel):
    item_id: str | None = None
    item_name: str
    quantity: int = 1
    acquired_price: float | None = None
    location: str | None = None
    notes: str | None = None


class InventoryItemUpdate(BaseModel):
    item_name: str | None = None
    item_id: str | None = None
    quantity: int | None = None
    acquired_price: float | None = None
    location: str | None = None
    notes: str | None = None


class InventoryItemOut(BaseModel):
    id: int
    item_id: str | None = None
    item_name: str
    quantity: int
    acquired_price: float | None = None
    location: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    item: ItemOut | None = None

    model_config = {"from_attributes": True}


class PaginatedInventory(BaseModel):
    results: list[InventoryItemOut]
    total: int
    page: int
    total_pages: int


class BulkImportRequest(BaseModel):
    text: str
    location: str | None = None


class BulkImportResult(BaseModel):
    created: int
    failed: list[str]


class AppraisalItem(BaseModel):
    id: int
    item_name: str
    quantity: int
    acquired_price: float | None = None
    oracle_price: float | None = None
    estimated_value: float | None = None
    potential_profit: float | None = None
    item: ItemOut | None = None


class AppraisalOut(BaseModel):
    total_estimated_value: float
    total_potential_profit: float
    total_items: int
    items: list[AppraisalItem]
