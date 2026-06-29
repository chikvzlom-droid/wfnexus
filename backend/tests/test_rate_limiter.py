from __future__ import annotations

import time

import pytest

from app.market.client import RateLimiter


@pytest.mark.asyncio
async def test_rate_limiter_allows_burst():
    limiter = RateLimiter(rate=10.0, burst=5)
    start = time.monotonic()
    for _ in range(5):
        await limiter.acquire()
    elapsed = time.monotonic() - start
    assert elapsed < 0.5


@pytest.mark.asyncio
async def test_rate_limiter_enforces_limit():
    limiter = RateLimiter(rate=10.0, burst=5)
    for _ in range(5):
        await limiter.acquire()
    start = time.monotonic()
    await limiter.acquire()
    elapsed = time.monotonic() - start
    assert elapsed >= 0.09  # 1/10 = 0.1s, with tolerance


@pytest.mark.asyncio
async def test_rate_limiter_concurrent():
    limiter = RateLimiter(rate=20.0, burst=3)
    times = []

    async def grab():
        await limiter.acquire()
        times.append(time.monotonic())

    import asyncio
    await asyncio.gather(*[grab() for _ in range(3)])
    assert len(times) == 3
