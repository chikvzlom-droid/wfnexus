from __future__ import annotations

from thefuzz import fuzz, process


def fuzzy_score(query: str, candidate: str) -> int:
    q = query.lower()
    c = candidate.lower()
    token = fuzz.token_sort_ratio(q, c)
    partial = fuzz.partial_ratio(q, c)
    exact = 100 if q == c else (80 if c.startswith(q) else 0)
    return max(exact, token, partial)


def fuzzy_search(query: str, candidates: list[str], limit: int = 20) -> list[tuple[str, int]]:
    if not query.strip():
        return [(name, 0) for name in candidates[:limit]]
    scored = [(name, fuzzy_score(query, name)) for name in candidates]
    scored.sort(key=lambda x: (-x[1], x[0]))
    return [(name, score) for name, score in scored if score >= 40][:limit]
