# Warframe Nexus — Anchored Summary

## Goal
Desktop assistant for Warframe market analysis, inventory management, and trading automation.

## Stack
- **Backend**: Python 3.14 (FastAPI, SQLAlchemy async, httpx, numpy)
- **Frontend**: Tauri (React 19, TypeScript, Tailwind, recharts)
- **DB**: SQLite (aiosqlite), async engine
- **Auth**: JWT via system keyring, login via WFM V1 `/v1/auth/signin` (email+password)

## Key Architecture

### WFM API — Current State (after full investigation)
- **V2 is the only active API**: `https://api.warframe.market/v2/...`
- **V1 is dead**: `/api/...` and `/v1/...` paths (except `/v1/auth/signin`) are unused by the website
- **Auth**: Via **Cookie** (`JWT=<raw_token>`), not Authorization header
  - Browser stores JWT in `document.cookie` as `JWT=eyJ...`
  - No `Authorization` header is sent by the website
- **Public endpoints** (no auth): `GET /v2/items`, `/v2/items/{slug}`, `/v2/orders/item/{slug}`, `/v2/orders/user/{username}`, `/v2/user/{username}`
- **Auth-only endpoints** (cookie): `GET /v2/me`, `POST /v2/order`, `DELETE /v2/order/{id}`, `PUT /v2/order/{id}`
- **V1 login**: `POST /v1/auth/signin` with `Authorization: JWT` (literal) + body `{auth_type, email, password, device_id}` → response header `Authorization: JWT eyJ...`
- **Quantframe** (reference): not applicable — uses `api.quantframe.app` proxy, no direct WFM calls

### Key Features
- Oracle price calculation (5 strategies: median, mean, volume_weighted, time_decay, dynamic)
- Price snapshots every 30 min for watchlist items
- Price distribution histogram from live orders
- Price history from snapshots (168 points)
- Watchlist with price alerts
- Trading: CRUD orders + sync with WFM (post new, detect completed)
- Notifications: Telegram (blocked), ntfy.sh, Discord webhook

### Modules

#### Market (`backend/app/market/`)
- `client.py`: V2 HTTP client with rate limiter (2 req/s), Cookie auth for profile endpoints
  - `_public_headers` — no auth (public endpoints)
  - `_auth_headers` — `Cookie: JWT=<token>` (auth endpoints)
  - Methods: `get_items`, `get_item`, `get_orders`, `get_top_orders`, `get_my_profile`, `get_my_orders`, `get_user_orders`, `post_order`, `delete_remote_order`
- `oracle.py`: PriceOracle with numpy
- `collector.py`: Syncs item catalogue from WFM V2
- `api.py`: 12 endpoints (items, orders, oracle, distribution, history, watchlist)

#### Trading (`backend/app/trading/`)
- Local CRUD for trade orders + `/sync` posting to WFM via `POST /v2/order`
- Sync pulls remote orders via `GET /v2/me` → `GET /v2/orders/user/{slug}`
- Uses `itemId` (WFM ObjectID), `type`, `platinum`, `quantity`, `visible`, optional `rank`

#### Auth (`backend/app/auth/`)
- `POST /api/v1/auth/signin` — login via WFM V1, saves JWT to keyring
- `GET/POST/DELETE /api/v1/auth/jwt` — manual JWT management
- `POST /api/v1/auth/test-profile` — test any V2 path with Cookie/Bearer/JWT/Raw auth
- Device ID stored in keyring (UUID, persistent)

#### Inventory (**REMOVED**)
- Was: EE.log parser, InventoryItem CRUD, scan/import
- Removed: entire module, all frontend code, tests — not needed

#### Frontend (`frontend/src/`)
- Pages: Dashboard, Items, ItemDetail, Watchlist, Trading, Settings
- Layout nav: Dashboard → Items → Trading → Watchlist → Settings
- Settings page: Login form (email+pass), JWT token viewer, API tester with format selector

## Important Notes
- **WFM V1 statistics** (504 Gateway Timeout) — unavailable, live orders are the only price source
- **Telegram** (ConnectTimeout) — blocked, use ntfy.sh/Discord
- **`MissingGreenlet`** in async SQLAlchemy + Pydantic — fix with `selectinload`
- **`.env` overrides `config.py`** — restart uvicorn after editing
- **EE.log format**: Inventory items (`StoreInventoryItem`) in first ~4000 lines of 62MB log; tail (~5000 lines) has missions/credits — module removed

## Tests (19 pass)
- `test_trading.py` — 7 tests (CRUD + validation)
- `test_oracle.py` — 8 tests (all 5 strategies + edge cases)
- `test_rate_limiter.py` — 3 tests (burst, enforce, concurrent)
- `test_api.py` — skipped (missing `respx` dep, pre-existing)

## Next Steps
1. **Analytics** — price forecasting (prophet/ARIMA) on accumulated PriceSnapshots
2. **Verify ntfy.sh/Discord** — `POST /api/v1/market/test-notify`
3. **Tauri app** — wrap frontend + backend for desktop distribution

## Relevant Files
- `backend/app/market/client.py` — V2 HTTP client with Cookie auth
- `backend/app/auth/api.py` — login, JWT management, API tester
- `backend/app/trading/api.py` — trading CRUD + WFM sync
- `backend/app/market/oracle.py` — price oracle (5 strategies)
- `frontend/src/pages/SettingsPage.tsx` — login form + API tester
- `frontend/src/pages/TradingPage.tsx` — order management + sync UI
