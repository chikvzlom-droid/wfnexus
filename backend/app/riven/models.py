from __future__ import annotations

RIVEN_PROPERTIES: dict[str, dict[str, float]] = {
    "Damage": {"base": 0.5, "min": 0.2, "max": 0.9},
    "Multishot": {"base": 0.4, "min": 0.15, "max": 0.75},
    "CriticalChance": {"base": 0.35, "min": 0.1, "max": 0.7},
    "CriticalDamage": {"base": 0.4, "min": 0.15, "max": 0.75},
    "StatusChance": {"base": 0.35, "min": 0.1, "max": 0.7},
    "StatusDuration": {"base": 0.3, "min": 0.1, "max": 0.6},
    "FireRate": {"base": 0.3, "min": 0.1, "max": 0.6},
    "MagazineCapacity": {"base": 0.25, "min": 0.05, "max": 0.5},
    "ReloadSpeed": {"base": 0.3, "min": 0.1, "max": 0.6},
    "Range": {"base": 0.2, "min": 0.05, "max": 0.4},
    "FlightSpeed": {"base": 0.2, "min": 0.05, "max": 0.4},
    "PunchThrough": {"base": 0.2, "min": 0.05, "max": 0.4},
    "ToxinDamage": {"base": 0.35, "min": 0.1, "max": 0.7},
    "ElectricDamage": {"base": 0.35, "min": 0.1, "max": 0.7},
    "HeatDamage": {"base": 0.35, "min": 0.1, "max": 0.7},
    "ColdDamage": {"base": 0.35, "min": 0.1, "max": 0.7},
    "ImpactDamage": {"base": 0.2, "min": 0.05, "max": 0.4},
    "SlashDamage": {"base": 0.2, "min": 0.05, "max": 0.4},
    "PunctureDamage": {"base": 0.2, "min": 0.05, "max": 0.4},
    "AmmoMaximum": {"base": 0.2, "min": 0.05, "max": 0.4},
    "Zoom": {"base": 0.15, "min": 0.05, "max": 0.3},
    "Recoil": {"base": 0.15, "min": 0.05, "max": 0.3},
}

WEAPON_DISPOSITION: dict[str, float] = {
    "strong": 1.4, "above_average": 1.15, "average": 1.0, "below_average": 0.85, "weak": 0.7,
}

UPLEVEL_MULTIPLIERS: dict[int, float] = {
    2: 0.942,
    3: 0.755,
    4: 0.595,
}

NEGATIVE_MULTIPLIER: float = 0.587


def estimate_riven_price(
    weapon_base_price: float,
    stats: list[str],
    has_negative: bool,
    disposition: str = "average",
) -> dict:
    disp = WEAPON_DISPOSITION.get(disposition, 1.0)
    n_stats = min(len(stats), 4)
    uplevel = UPLEVEL_MULTIPLIERS.get(n_stats, 1.0)
    neg_mult = NEGATIVE_MULTIPLIER if has_negative else 1.0

    total_property_value = 0.0
    detail = []
    for s in stats:
        prop = RIVEN_PROPERTIES.get(s, {"base": 0.2, "min": 0.05, "max": 0.4})
        detail.append({
            "property": s,
            "base_value": prop["base"],
            "range": [prop["min"], prop["max"]],
        })
        total_property_value += prop["base"]

    stat_quality = total_property_value / max(len(stats), 1)
    deviation = 0.5 + stat_quality * 0.5
    deviation = max(0.89, min(1.11, deviation))

    estimated = weapon_base_price * disp * deviation * uplevel * neg_mult
    estimated = max(5, round(estimated))

    return {
        "estimated_price": estimated,
        "deviation": round(deviation, 4),
        "disposition": disposition,
        "disposition_mult": disp,
        "uplevel_mult": uplevel,
        "negative_mult": neg_mult,
        "n_stats": n_stats,
        "has_negative": has_negative,
        "stats": detail,
        "price_range": [max(3, round(estimated * 0.8)), round(estimated * 1.2)],
    }
