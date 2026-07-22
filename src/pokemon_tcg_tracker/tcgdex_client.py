from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from .config import API_BASE_URL, REQUEST_TIMEOUT_SECONDS


class TcgdexClientError(RuntimeError):
    """Raised when the TCGdex API returns an error."""


def _request_json(path: str) -> Any:
    url = f"{API_BASE_URL}{path}"
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "pokemon-tcg-tracker/0.1",
        },
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return json.load(response)
    except HTTPError as exc:
        raise TcgdexClientError(f"HTTP {exc.code} on {url}") from exc
    except URLError as exc:
        raise TcgdexClientError(f"Network error on {url}: {exc.reason}") from exc


def _request_json_for_language(language: str, path: str) -> Any:
    url = f"https://api.tcgdex.net/v2/{language}{path}"
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "pokemon-tcg-tracker/0.1",
        },
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return json.load(response)
    except HTTPError as exc:
        raise TcgdexClientError(f"HTTP {exc.code} on {url}") from exc
    except URLError as exc:
        raise TcgdexClientError(f"Network error on {url}: {exc.reason}") from exc


def fetch_card_details(card_id: str) -> dict[str, Any]:
    payload = _request_json(f"/cards/{quote(card_id)}")
    if not isinstance(payload, dict):
        raise TcgdexClientError(f"Unexpected details payload for card {card_id}")
    return payload


def fetch_series_list() -> list[dict[str, Any]]:
    payload = _request_json("/series")
    if not isinstance(payload, list):
        raise TcgdexClientError("Unexpected series payload format")
    return payload


def fetch_series_details(serie_id: str) -> dict[str, Any]:
    payload = _request_json(f"/series/{quote(serie_id)}")
    if not isinstance(payload, dict):
        raise TcgdexClientError(f"Unexpected details payload for series {serie_id}")
    return payload


def fetch_set_details(set_id: str) -> dict[str, Any]:
    payload = _request_json(f"/sets/{quote(set_id)}")
    if not isinstance(payload, dict):
        raise TcgdexClientError(f"Unexpected details payload for set {set_id}")
    return payload


def fetch_card_details_for_language(language: str, card_id: str) -> dict[str, Any]:
    payload = _request_json_for_language(language, f"/cards/{quote(card_id)}")
    if not isinstance(payload, dict):
        raise TcgdexClientError(
            f"Unexpected details payload for card {card_id} in language {language}"
        )
    return payload
