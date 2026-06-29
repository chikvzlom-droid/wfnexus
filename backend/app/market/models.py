from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Item(Base):
    __tablename__ = "items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    subcategory: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ducats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mod_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_set: Mapped[bool] = mapped_column(Boolean, default=False)
    thumbnail: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    watchlist_entries: Mapped[list[WatchlistItem]] = relationship(
        "WatchlistItem", back_populates="item", cascade="all, delete-orphan"
    )


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[str] = mapped_column(String(64), ForeignKey("items.id"), nullable=False)
    target_price: Mapped[float] = mapped_column(Float, nullable=False)
    direction: Mapped[str] = mapped_column(Enum("above", "below", name="watch_direction"), nullable=False)
    notify: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    item: Mapped[Item] = relationship("Item", back_populates="watchlist_entries")


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[str] = mapped_column(String(64), ForeignKey("items.id"), nullable=False, index=True)
    oracle_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    open_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    closed_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    wa_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    median_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    moving_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    donch_top: Mapped[float | None] = mapped_column(Float, nullable=True)
    donch_bot: Mapped[float | None] = mapped_column(Float, nullable=True)
    sample_size: Mapped[int] = mapped_column(Integer, default=0)
    volume: Mapped[int] = mapped_column(Integer, default=0)
    sell_count: Mapped[int] = mapped_column(Integer, default=0)
    buy_count: Mapped[int] = mapped_column(Integer, default=0)
    supply: Mapped[int] = mapped_column(Integer, default=0)
    demand: Mapped[int] = mapped_column(Integer, default=0)
    trading_tax: Mapped[int] = mapped_column(Integer, default=0)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
