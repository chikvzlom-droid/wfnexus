# Adding a New Module to Warframe Nexus

This guide explains how to add a new feature module (e.g., Relic Module, Farming Module, Trading Module) to the Warframe Nexus backend.

## Step 1: Create the module package

```
backend/app/your_module/
├── __init__.py
├── api.py          — FastAPI router
├── models.py       — SQLAlchemy models
├── schemas.py      — Pydantic request/response schemas
├── service.py      — business logic
└── client.py       — external API clients (if any)
```

## Step 2: Define database models

```python
# your_module/models.py
from sqlalchemy import Column, Integer, String, Float, ForeignKey
from app.core.database import Base

class YourEntity(Base):
    __tablename__ = "your_entities"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    # ... add your fields
```

Then register the model import in `app/core/database.py` so `init_db()` picks it up:

```python
# in init_db(), add:
from app.your_module import models  # noqa: F401
```

## Step 3: Define Pydantic schemas

```python
# your_module/schemas.py
from pydantic import BaseModel

class YourEntityOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}
```

## Step 4: Create the API router

```python
# your_module/api.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.your_module.schemas import YourEntityOut
from app.your_module.models import YourEntity

router = APIRouter(prefix="/api/v1/your-module", tags=["your-module"])

@router.get("/entities", response_model=list[YourEntityOut])
async def list_entities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(YourEntity))
    return [YourEntityOut.model_validate(e) for e in result.scalars().all()]
```

## Step 5: Register the router in the main app

```python
# app/main.py
from app.your_module.api import router as your_module_router

app.include_router(your_module_router)
```

## Step 6: Write tests

```python
# tests/test_your_module.py
@pytest.mark.asyncio
async def test_list_entities(client: AsyncClient):
    resp = await client.get("/api/v1/your-module/entities")
    assert resp.status_code == 200
```

## Step 7: Add frontend pages

```
frontend/src/pages/YourModulePage.tsx
frontend/src/components/YourModuleWidget.tsx
```

Then add a route in `App.tsx` and a nav link in `Layout.tsx`.

## Conventions

- Module names: lowercase, singular (`market`, `relic`, `farming`)
- API prefix: `/api/v1/{module-name}`
- All external calls must go through the rate-limited `WFMarketClient` or use their own rate limiter
- All secrets go through `app.core.security` (keyring) or `.env`
- Every public function should have a type-annotated signature and a docstring
- Tests go in `backend/tests/test_{module_name}.py`
