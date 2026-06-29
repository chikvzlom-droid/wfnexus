from __future__ import annotations

from contextlib import asynccontextmanager

import asyncio

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.__about__ import __version__
from app.core.database import init_db
from app.core.logging_ import setup_logging
from app.auth.api import router as auth_router
from app.settings.api import router as settings_router
from app.core.scheduler import collect_stats_loop, watchlist_loop, full_sync_loop
from app.inventory.api import router as inventory_router
from app.market.api import router as market_router
from app.trading.api import router as trading_router
from app.riven.api import router as riven_router
from app.worldstate.api import router as worldstate_router

logger = structlog.get_logger(__name__)

DEV_ORIGINS = [
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "http://localhost:3000",
    "http://localhost:5173",
    "tauri://localhost",
    "https://tauri.localhost",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await init_db()
    tasks = [
        asyncio.create_task(watchlist_loop()),
        asyncio.create_task(collect_stats_loop()),
        asyncio.create_task(full_sync_loop()),
    ]
    yield
    for t in tasks:
        t.cancel()


app = FastAPI(
    title="Warframe Nexus API",
    version=__version__,
    description="Backend for Warframe Nexus — market analysis, trading, and automation assistant.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_error", path=str(request.url), method=request.method)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )


app.include_router(auth_router)
app.include_router(inventory_router)
app.include_router(market_router)
app.include_router(trading_router)
app.include_router(settings_router)
app.include_router(riven_router)
app.include_router(worldstate_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": __version__}
