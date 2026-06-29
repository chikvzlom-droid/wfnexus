from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.market.oracle import PriceData, PriceOracle


def _make_points(prices: list[float], hours_ago: int | None = None) -> list[PriceData]:
    now = datetime.now(timezone.utc)
    return [
        PriceData(
            price=p,
            volume=max(1, int(100 - i * 10)),
            recorded_at=now - timedelta(hours=hours_ago or i),
        )
        for i, p in enumerate(prices)
    ]


class TestPriceOracle:
    def test_median_odd(self):
        points = _make_points([10, 20, 30, 40, 50])
        assert PriceOracle.median(points) == 30.0

    def test_median_even(self):
        points = _make_points([10, 20, 30, 40])
        assert PriceOracle.median(points) == 25.0

    def test_mean(self):
        points = _make_points([10, 20, 30])
        assert PriceOracle.mean(points) == 20.0

    def test_mean_empty(self):
        assert PriceOracle.mean([]) is None

    def test_volume_weighted(self):
        points = [
            PriceData(price=10, volume=100, recorded_at=datetime.now(timezone.utc)),
            PriceData(price=20, volume=50, recorded_at=datetime.now(timezone.utc)),
        ]
        result = PriceOracle.volume_weighted(points)
        assert result is not None
        assert result == pytest.approx(13.33, rel=0.01)

    def test_estimate_dynamic_small(self):
        points = _make_points([100, 101, 102, 99, 100], hours_ago=1)
        price, strategy, confidence, n = PriceOracle.estimate(points)
        assert price is not None
        assert 99 <= price <= 103
        assert strategy == "dynamic"
        assert n == 5

    def test_estimate_high_volatility(self):
        points = _make_points([10, 50, 100, 20, 80, 150, 30], hours_ago=1)
        price, strategy, confidence, n = PriceOracle.estimate(points)
        assert price is not None
        assert strategy == "dynamic"
        assert confidence < 0.8

    def test_estimate_empty(self):
        price, strategy, confidence, n = PriceOracle.estimate([])
        assert price is None
        assert confidence == 0.0
        assert n == 0

    def test_time_decay_recent_preferred(self):
        now = datetime.now(timezone.utc)
        points = [
            PriceData(price=100, volume=10, recorded_at=now - timedelta(hours=24)),
            PriceData(price=50, volume=10, recorded_at=now - timedelta(hours=1)),
        ]
        result = PriceOracle.time_decay(points)
        assert result is not None
        assert result < 75
