from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone

import numpy as np
import structlog

logger = structlog.get_logger(__name__)


class PriceData:
    """Simple price data point for oracle computation."""

    def __init__(self, price: float, volume: int = 1, recorded_at: datetime | None = None) -> None:
        self.price = price
        self.volume = volume
        self.recorded_at = recorded_at


class PriceOracle:
    """Statistical models for fair price estimation."""

    @staticmethod
    def median(points: Sequence[PriceData]) -> float | None:
        prices = [p.price for p in points if p.price > 0]
        if not prices:
            return None
        return float(np.median(prices))

    @staticmethod
    def mean(points: Sequence[PriceData]) -> float | None:
        prices = [p.price for p in points if p.price > 0]
        if not prices:
            return None
        return float(np.mean(prices))

    @staticmethod
    def volume_weighted(points: Sequence[PriceData]) -> float | None:
        valid = [(p.price, p.volume) for p in points if p.price > 0 and p.volume > 0]
        if not valid:
            return PriceOracle.mean(points)
        prices, volumes = zip(*valid)
        arr_p = np.array(prices)
        arr_v = np.array(volumes, dtype=float)
        total_v = arr_v.sum()
        if total_v == 0:
            return PriceOracle.mean(points)
        return float(np.average(arr_p, weights=arr_v))

    @staticmethod
    def time_decay(points: Sequence[PriceData], half_life_hours: float = 6.0) -> float | None:
        now = np.datetime64(datetime.now(timezone.utc))
        valid = [(p.price, p.recorded_at) for p in points if p.price > 0 and p.recorded_at is not None]
        if not valid:
            return PriceOracle.median(points)
        prices = np.array([v[0] for v in valid])
        timestamps = np.array([np.datetime64(v[1].replace(tzinfo=timezone.utc)) for v in valid])
        ages_hours = (now - timestamps).astype("timedelta64[s]").astype(float) / 3600.0
        weights = np.exp(-ages_hours / half_life_hours)
        if weights.sum() == 0:
            return float(np.mean(prices))
        return float(np.average(prices, weights=weights))

    @staticmethod
    def dynamic(points: Sequence[PriceData]) -> float | None:
        prices = [p.price for p in points if p.price > 0]
        if len(prices) < 2:
            return PriceOracle.median(points)
        cv = float(np.std(prices) / np.mean(prices)) if np.mean(prices) > 0 else 1.0
        if cv < 0.1:
            return PriceOracle.mean(points)
        if cv < 0.3:
            return PriceOracle.median(points)
        return PriceOracle.time_decay(points)

    @staticmethod
    def estimate(points: Sequence[PriceData], strategy: str = "dynamic") -> tuple[float | None, str, float, int]:
        if not points:
            return None, strategy, 0.0, 0
        sample_size = len(points)
        strategies = {
            "median": PriceOracle.median,
            "mean": PriceOracle.mean,
            "volume_weighted": PriceOracle.volume_weighted,
            "time_decay": PriceOracle.time_decay,
            "dynamic": PriceOracle.dynamic,
        }
        fn = strategies.get(strategy, PriceOracle.dynamic)
        price = fn(points)
        if price is None:
            return None, strategy, 0.0, sample_size
        prices_arr = np.array([p.price for p in points if p.price > 0])
        std = float(np.std(prices_arr)) if len(prices_arr) > 1 else 0.0
        mean_val = float(np.mean(prices_arr))
        cv = std / mean_val if mean_val > 0 else 1.0
        confidence = max(0.0, min(1.0, 1.0 - cv))
        confidence *= min(1.0, sample_size / 50.0)
        return price, strategy, confidence, sample_size
