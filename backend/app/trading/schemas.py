from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.market.schemas import ItemOut


class TradeCreate(BaseModel):
    item_id: str
    order_type: str = Field(description="'sell' or 'buy'")
    platinum: float = Field(gt=0)
    quantity: int = Field(default=1, ge=1)
    visible: bool = True
    notes: str | None = None


class TradeUpdate(BaseModel):
    platinum: float | None = Field(default=None, gt=0)
    quantity: int | None = Field(default=None, ge=1)
    visible: bool | None = None
    status: str | None = None
    notes: str | None = None


class TradeOut(BaseModel):
    id: int
    item_id: str
    wfm_id: str | None = None
    order_type: str
    platinum: float
    quantity: int
    visible: bool
    status: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    item: ItemOut | None = None

    model_config = {"from_attributes": True}


class TradeWfmSyncOut(BaseModel):
    posted: int = 0
    imported: int = 0
    deleted: int = 0
    errors: list[str] = []


class TransactionCreate(BaseModel):
    item_id: str
    transaction_type: str = Field(description="'sale' or 'purchase'")
    price: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1)
    user_name: str = Field(default="")
    credits: int = 0
    notes: str | None = None


class TransactionUpdate(BaseModel):
    price: int | None = Field(default=None, gt=0)
    quantity: int | None = Field(default=None, ge=1)
    user_name: str | None = None
    credits: int | None = None
    notes: str | None = None
    is_locked: bool | None = None


class TransactionOut(BaseModel):
    id: int
    item_id: str
    wfm_id: str | None = None
    wfm_url: str | None = None
    item_name: str
    item_unique_name: str | None = None
    item_type: str
    transaction_type: str
    price: int
    quantity: int
    profit: int | None = None
    credits: int
    user_name: str
    tags: str
    notes: str | None = None
    is_locked: bool = False
    created_at: datetime
    updated_at: datetime
    item: ItemOut | None = None

    model_config = {"from_attributes": True}


class TransactionReport(BaseModel):
    total_transactions: int = 0
    sale_count: int = 0
    purchases_count: int = 0
    revenue: int = 0
    expenses: int = 0
    total_profit: int = 0
    average_profit: float = 0
    profit_margin: float = 0
    roi: float = 0
    highest_revenue: int = 0
    highest_expense: int = 0
    categories: list[CategoryReport] = []


class TradeEntryCreate(BaseModel):
    item_id: str | None = None
    item_name: str = ""
    price: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1)
    group: str = "item"
    tags: str = ""
    notes: str | None = None


class TradeEntryUpdate(BaseModel):
    price: int | None = Field(default=None, gt=0)
    quantity: int | None = Field(default=None, ge=1)
    tags: str | None = None
    notes: str | None = None


class TradeEntryOut(BaseModel):
    id: int
    item_id: str | None = None
    item_name: str
    price: int
    quantity: int
    group: str
    tags: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    item: ItemOut | None = None
    potential_profit: int | None = None
    min_price: int | None = None
    market_price: int | None = None

    model_config = {"from_attributes": True}


class GenerateMessageRequest(BaseModel):
    ids: list[int]


class GenerateMessageResponse(BaseModel):
    message: str
    count: int


class PaginatedTradeEntries(BaseModel):
    results: list[TradeEntryOut]
    total: int
    page: int
    total_pages: int


class ProcessTradeItem(BaseModel):
    item_id: str
    quantity: int = Field(default=1, ge=1)
    price: int = Field(gt=0)
    user_name: str = Field(default="")
    credits: int = 0
    notes: str | None = None


class PaginatedTransactions(BaseModel):
    results: list[TransactionOut]
    total: int
    page: int
    total_pages: int


class DailyProfit(BaseModel):
    date: str
    profit: int
    sales: int
    purchases: int


class CategoryReport(BaseModel):
    name: str
    revenue: int = 0
    expenses: int = 0
    profit: int = 0
    count: int = 0
    profit_margin: float = 0


class DashboardData(BaseModel):
    total_transactions: int = 0
    total_revenue: int = 0
    total_expenses: int = 0
    total_profit: int = 0
    today_transactions: int = 0
    today_profit: int = 0
    best_seller_name: str = ""
    best_seller_profit: int = 0
    best_seller_count: int = 0
    daily_profit: list[DailyProfit] = []
    recent_transactions: list[TransactionOut] = []
    categories: list[CategoryReport] = []
