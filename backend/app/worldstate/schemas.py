from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class Fissure(BaseModel):
    id: str
    node: str
    mission_type: str
    mission: str
    tier: str
    tier_num: int
    eta: str
    expiry: str | None = None


class VoidTrader(BaseModel):
    id: str
    location: str
    inventory: list[dict] = []
    activation: str | None = None
    expiry: str | None = None
    active: bool = False


class Alert(BaseModel):
    id: str
    mission: str | None = None
    reward: str | None = None
    eta: str | None = None
    expiry: str | None = None


class Sortie(BaseModel):
    id: str
    boss: str | None = None
    faction: str | None = None
    variants: list[dict] = []
    expiry: str | None = None


class Cycle(BaseModel):
    id: str
    state: str
    time_left: str
    is_day: bool | None = None


class WorldStateOut(BaseModel):
    fissures: list[Fissure]
    void_trader: VoidTrader | None = None
    alerts: list[Alert]
    sortie: Sortie | None = None
    cetus_cycle: Cycle | None = None
    vallis_cycle: Cycle | None = None
    cambion_cycle: Cycle | None = None
    nightwave: list[dict] = []
