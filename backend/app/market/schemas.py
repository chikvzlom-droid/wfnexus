from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ItemOut(BaseModel):
    id: str
    name: str
    slug: str
    category: str | None = None
    subcategory: str | None = None
    ducats: int | None = None
    mod_rank: int | None = None
    is_set: bool = False
    thumbnail: str | None = None

    model_config = {"from_attributes": True}


class OraclePriceOut(BaseModel):
    item_id: str
    oracle_price: float | None = None
    strategy: str
    confidence: float = 0.0
    sample_size: int = 0


class ItemSearchOut(BaseModel):
    query: str
    total: int
    items: list[ItemOut]


class WatchlistCreate(BaseModel):
    item_id: str
    target_price: float
    direction: str = Field(description="'above' or 'below'")
    notify: bool = True


class WatchlistOut(BaseModel):
    id: int
    item_id: str
    target_price: float
    direction: str
    notify: bool
    item: ItemOut | None = None

    model_config = {"from_attributes": True}


class PriceHistoryPoint(BaseModel):
    recorded_at: datetime
    oracle_price: float | None = None
    min_price: float | None = None
    max_price: float | None = None
    open_price: float | None = None
    closed_price: float | None = None
    avg_price: float | None = None
    wa_price: float | None = None
    median_price: float | None = None
    moving_avg: float | None = None
    donch_top: float | None = None
    donch_bot: float | None = None
    sample_size: int = 0
    volume: int | None = 0
    sell_count: int = 0
    buy_count: int = 0
    supply: int | None = 0
    demand: int | None = 0


class PriceDistributionBucket(BaseModel):
    range_start: float
    range_end: float
    count: int


class OrderDistributionOut(BaseModel):
    slug: str
    sell_count: int
    buy_count: int
    min_price: float | None = None
    max_price: float | None = None
    avg_price: float | None = None
    median_price: float | None = None
    buckets: list[PriceDistributionBucket]


class PriceHistoryOut(BaseModel):
    slug: str
    points: list[PriceHistoryPoint]


class PriceAnalyticsItem(BaseModel):
    id: int
    item_id: str
    item_name: str
    item_slug: str
    item_category: str | None = None
    item_thumbnail: str | None = None
    tags: list[str] = []
    oracle_price: float | None = None
    min_price: float | None = None
    max_price: float | None = None
    open_price: float | None = None
    closed_price: float | None = None
    avg_price: float | None = None
    wa_price: float | None = None
    median_price: float | None = None
    moving_avg: float | None = None
    donch_top: float | None = None
    donch_bot: float | None = None
    sample_size: int = 0
    volume: int = 0
    sell_count: int = 0
    buy_count: int = 0
    supply: int = 0
    demand: int = 0
    trading_tax: int = 0
    recorded_at: datetime | None = None

    model_config = {"from_attributes": True}


class PaginatedAnalytics(BaseModel):
    results: list[PriceAnalyticsItem]
    total: int
    page: int
    total_pages: int


class FuzzySearchResult(BaseModel):
    item: ItemOut
    score: int


class FuzzySearchOut(BaseModel):
    query: str
    results: list[FuzzySearchResult]
