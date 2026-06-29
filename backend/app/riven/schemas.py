from __future__ import annotations

from pydantic import BaseModel, Field


class RivenPriceRequest(BaseModel):
    weapon_name: str
    weapon_base_price: float = Field(gt=0, description="Current market price of the weapon")
    stats: list[str] = Field(min_length=2, max_length=4, description="Stat names")
    has_negative: bool = False
    disposition: str = Field(default="average", description="strong/above_average/average/below_average/weak")


class RivenStatDetail(BaseModel):
    property: str
    base_value: float
    range: list[float]


class RivenPriceOut(BaseModel):
    weapon_name: str
    estimated_price: int
    deviation: float
    disposition: str
    disposition_mult: float
    uplevel_mult: float
    negative_mult: float
    n_stats: int
    has_negative: bool
    stats: list[RivenStatDetail]
    price_range: list[int]
