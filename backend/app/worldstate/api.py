from __future__ import annotations

import httpx
import structlog
from fastapi import APIRouter, HTTPException

from app.worldstate.schemas import (
    Alert,
    Cycle,
    Fissure,
    Sortie,
    VoidTrader,
    WorldStateOut,
)

logger = structlog.get_logger(__name__)

WS_BASE = "https://api.warframestat.us/pc"
TIMEOUT = 10.0

router = APIRouter(prefix="/api/v1/worldstate", tags=["worldstate"])


def _eta(expiry_str: str | None) -> str:
    if not expiry_str:
        return "?"
    from datetime import datetime, timezone
    try:
        exp = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
        rem = exp - datetime.now(timezone.utc)
        s = int(rem.total_seconds())
        if s <= 0:
            return "expired"
        h, m = divmod(s // 60, 60)
        return f"{h}h {m}m" if h else f"{m}m"
    except Exception:
        return "?"


async def _fetch(path: str) -> dict | list:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(f"{WS_BASE}{path}")
        if resp.status_code != 200:
            raise HTTPException(502, f"World state API error: {resp.status_code}")
        return resp.json()


@router.get("", response_model=WorldStateOut)
async def get_world_state():
    try:
        raw = await _fetch("")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("worldstate_fetch_failed", error=str(exc))
        raise HTTPException(502, "Failed to fetch world state")

    if not isinstance(raw, dict):
        raise HTTPException(502, "Invalid world state response")

    fissures_raw = raw.get("fissures", []) if isinstance(raw.get("fissures"), list) else []
    fissures = [
        Fissure(
            id=f.get("id", ""),
            node=f.get("node", ""),
            mission_type=f.get("missionType", ""),
            mission=f.get("mission", ""),
            tier=f.get("tier", ""),
            tier_num=int(f.get("tierNum", 0)),
            eta=_eta(f.get("expiry")),
            expiry=f.get("expiry"),
        )
        for f in fissures_raw
    ]

    vt_raw = raw.get("voidTrader") or raw.get("void_trader", {})
    void_trader = None
    if vt_raw and isinstance(vt_raw, dict):
        inventory = vt_raw.get("inventory", []) or []
        void_trader = VoidTrader(
            id=vt_raw.get("id", ""),
            location=vt_raw.get("location", ""),
            inventory=inventory if isinstance(inventory, list) else [],
            activation=vt_raw.get("activation"),
            expiry=vt_raw.get("expiry"),
            active=vt_raw.get("active", False),
        )

    alerts_raw = raw.get("alerts", []) if isinstance(raw.get("alerts"), list) else []
    alerts = [
        Alert(
            id=a.get("id", ""),
            mission=a.get("mission", {}).get("node", "") if isinstance(a.get("mission"), dict) else None,
            reward=str(a.get("mission", {}).get("rewards", [{}])[0].get("items", [{}])[0].get("name", "")) if isinstance(a.get("mission"), dict) else None,
            eta=_eta(a.get("expiry")),
            expiry=a.get("expiry"),
        )
        for a in alerts_raw
    ]

    sortie_raw = raw.get("sortie", {})
    sortie = None
    if sortie_raw and isinstance(sortie_raw, dict):
        sortie = Sortie(
            id=sortie_raw.get("id", ""),
            boss=sortie_raw.get("boss", ""),
            faction=sortie_raw.get("faction", ""),
            variants=sortie_raw.get("variants", []),
            expiry=sortie_raw.get("expiry"),
        )

    def parse_cycle(key: str) -> Cycle | None:
        c = raw.get(key, {})
        if not c or not isinstance(c, dict):
            return None
        return Cycle(
            id=c.get("id", ""),
            state=c.get("state", ""),
            time_left=c.get("timeLeft", c.get("time_left", "")),
            is_day=c.get("isDay", c.get("is_day")),
        )

    nightwave_raw = raw.get("nightwave", {})
    nightwave = []
    if isinstance(nightwave_raw, dict):
        nightwave = nightwave_raw.get("activeChallenges", nightwave_raw.get("challenges", []))

    return WorldStateOut(
        fissures=fissures,
        void_trader=void_trader,
        alerts=alerts,
        sortie=sortie,
        cetus_cycle=parse_cycle("cetusCycle"),
        vallis_cycle=parse_cycle("vallisCycle"),
        cambion_cycle=parse_cycle("cambionCycle"),
        nightwave=nightwave if isinstance(nightwave, list) else [],
    )
