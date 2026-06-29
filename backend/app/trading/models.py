from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TradeOrder(Base):
    __tablename__ = "trade_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[str] = mapped_column(String(64), ForeignKey("items.id"), nullable=False, index=True)
    wfm_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    order_type: Mapped[str] = mapped_column(String(8), nullable=False)
    platinum: Mapped[float] = mapped_column(Float, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    visible: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(16), default="active")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    item: Mapped["Item"] = relationship("Item", lazy="joined")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[str] = mapped_column(String(64), ForeignKey("items.id"), nullable=False, index=True)
    wfm_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    wfm_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    item_unique_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    item_type: Mapped[str] = mapped_column(String(16), nullable=False, default="item")
    transaction_type: Mapped[str] = mapped_column(String(16), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    profit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    credits: Mapped[int] = mapped_column(Integer, default=0)
    user_name: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    tags: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    properties: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    item: Mapped["Item"] = relationship("Item", lazy="joined")


class TradeEntry(Base):
    __tablename__ = "trade_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("items.id"), nullable=True, index=True)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    group: Mapped[str] = mapped_column(String(16), nullable=False, default="item")
    tags: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    item: Mapped["Item | None"] = relationship("Item", lazy="joined")
