from __future__ import annotations

import httpx
import structlog
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.security import store_wfm_jwt, load_wfm_jwt, delete_wfm_jwt, get_device_id

from .schemas import (
    JwtSetRequest,
    JwtStatusResponse,
    SignInRequest,
    SignInResponse,
    TestProfileRequest,
    TestProfileResponse,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

WFM_V2_BASE = "https://api.warframe.market/v2"


WFM_V1_BASE = "https://api.warframe.market/v1"


@router.post("/signin", response_model=SignInResponse)
async def signin(data: SignInRequest):
    url = f"{WFM_V1_BASE}/auth/signin"
    headers = {
        "Authorization": "JWT",
        "Content-Type": "application/json",
        "User-Agent": "WarframeNexus/0.1.0",
    }
    body = {
        "auth_type": "header",
        "email": data.email,
        "password": data.password,
        "device_id": get_device_id(),
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as hc:
            resp = await hc.post(url, json=body, headers=headers)
            if resp.status_code != 200:
                detail = "Invalid credentials"
                try:
                    detail = resp.json().get("error", detail)
                except Exception:
                    pass
                return SignInResponse(success=False, error=detail)

            auth_header = resp.headers.get("Authorization", "")
            token = _stripped_jwt(auth_header)
            if not token:
                return SignInResponse(success=False, error="No JWT in response")

            store_wfm_jwt(token)
            profile = resp.json().get("payload", {}).get("user", {})
            ingame_name = profile.get("ingame_name")

            return SignInResponse(success=True, ingame_name=ingame_name)
    except httpx.RequestError as e:
        return SignInResponse(success=False, error=f"Request failed: {e}")


@router.get("/jwt", response_model=JwtStatusResponse)
async def get_jwt_status():
    token = load_wfm_jwt()
    if token:
        preview = token[:20] + "..." if len(token) > 23 else token
        return JwtStatusResponse(has_token=True, token_preview=preview)
    return JwtStatusResponse(has_token=False, token_preview=None)


@router.post("/jwt", response_model=JwtStatusResponse)
async def set_jwt(data: JwtSetRequest):
    token = data.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token cannot be empty")
    store_wfm_jwt(token)
    preview = token[:20] + "..." if len(token) > 23 else token
    return JwtStatusResponse(has_token=True, token_preview=preview)


@router.delete("/jwt")
async def delete_jwt():
    delete_wfm_jwt()
    return {"status": "deleted"}


def _stripped_jwt(raw: str) -> str:
    raw = raw.strip()
    for prefix in ("JWT ", "Bearer "):
        if raw.startswith(prefix):
            return raw.removeprefix(prefix).strip()
    return raw


@router.post("/test-profile", response_model=TestProfileResponse)
async def test_profile_request(data: TestProfileRequest):
    jwt = load_wfm_jwt()
    if not jwt:
        raise HTTPException(status_code=400, detail="No JWT token stored. Save one first.")

    headers = {
        "User-Agent": "WarframeNexus/0.1.0 (github.com/your-org/warframe-nexus)",
        "Accept": "application/json",
    }

    if data.auth_format == "cookie":
        token = _stripped_jwt(jwt)
        headers["Cookie"] = f"JWT={token}"
    elif data.auth_format == "Bearer {token}":
        token = _stripped_jwt(jwt)
        headers["Authorization"] = f"Bearer {token}"
    elif data.auth_format == "JWT {token}":
        token = _stripped_jwt(jwt)
        headers["Authorization"] = f"JWT {token}"
    else:
        headers["Authorization"] = _stripped_jwt(jwt)

    if data.body:
        headers.setdefault("Content-Type", "application/json")

    url = f"{WFM_V2_BASE}{data.path}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as hc:
            resp = await hc.request(
                data.method.upper(),
                url,
                headers=headers,
                json=data.body if data.body else None,
            )
            try:
                body: dict | list = resp.json()
            except Exception:
                body = {"raw": resp.text[:2000]}

            return TestProfileResponse(status=resp.status_code, body=body)
    except httpx.RequestError as e:
        return TestProfileResponse(
            status=0,
            body=None,
            error=f"Request failed: {e}",
        )
    except Exception as e:
        return TestProfileResponse(
            status=0,
            body=None,
            error=f"Unexpected error: {e}",
        )
