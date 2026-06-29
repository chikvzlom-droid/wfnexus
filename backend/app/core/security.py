from __future__ import annotations

import keyring

_SERVICE = "warframe-nexus"
_WFM_KEY = "wf-market-jwt"


def store_wfm_jwt(token: str) -> None:
    keyring.set_password(_SERVICE, _WFM_KEY, token)


def load_wfm_jwt() -> str | None:
    return keyring.get_password(_SERVICE, _WFM_KEY)


def delete_wfm_jwt() -> None:
    try:
        keyring.delete_password(_SERVICE, _WFM_KEY)
    except keyring.errors.PasswordDeleteError:
        pass


def get_device_id() -> str:
    import uuid
    _DEVICE_KEY = "device-id"
    device_id = keyring.get_password(_SERVICE, _DEVICE_KEY)
    if not device_id:
        device_id = str(uuid.uuid4())
        keyring.set_password(_SERVICE, _DEVICE_KEY, device_id)
    return device_id
