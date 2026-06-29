# Warframe Nexus

Desktop assistant for Warframe — market analysis, price tracking, inventory management, relic optimization, farming planner, and trading automation.

> **Status**: Phase 1 (MVP) — Market Module with price tracking, oracle, and watchlist.

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+ (for frontend)
- Rust toolchain (for Tauri desktop build — optional, frontend works in browser too)

### Backend

```bash
cd backend
cp .env.example .env            # edit if needed
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (browser dev mode)

```bash
cd frontend
npm install
npm run dev                     # opens on http://localhost:1420
```

### Desktop app (Tauri)

```bash
cd frontend
npm install
npm run tauri dev               # native window + tray
```

---

## Project Structure

```
warframe-nexus/
├── backend/
│   ├── app/
│   │   ├── core/           — config, database, security, logging
│   │   ├── market/         — Market Module (client, oracle, collector, API)
│   │   ├── schemas/        — shared Pydantic models
│   │   └── main.py         — FastAPI application entry point
│   ├── data/               — SQLite databases (gitignored)
│   ├── tests/              — pytest suite
│   ├── scripts/            — start scripts
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/                — React + TypeScript + Tailwind
│   │   ├── components/     — shared UI components
│   │   ├── pages/          — route pages
│   │   ├── stores/         — Zustand state management
│   │   └── lib/            — API client
│   ├── src-tauri/          — Tauri (Rust) native shell
│   └── package.json
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## API Endpoints (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1/market/items?q=...` | Search items |
| GET | `/api/v1/market/items/{slug}` | Item details |
| GET | `/api/v1/market/items/{slug}/orders` | Live orders |
| GET | `/api/v1/market/items/{slug}/stats` | Price statistics |
| GET | `/api/v1/market/items/{slug}/oracle` | Oracle fair price |
| POST | `/api/v1/market/sync` | Sync catalogue from WFM |
| POST | `/api/v1/market/sync/prices` | Collect price points |
| GET  | `/api/v1/market/watchlist` | List watchlist |
| POST | `/api/v1/market/watchlist` | Add to watchlist |
| DELETE | `/api/v1/market/watchlist/{id}` | Remove from watchlist |

Full OpenAPI docs at `http://localhost:8000/docs`.

---

## Testing

```bash
cd backend
python -m pytest tests/ -v
```

---

## Production Build

```bash
# Backend only (API mode)
cd backend
docker compose up --build -d

# Full desktop app
cd frontend
npm run tauri build
```

---

## License

MIT
