"""Polite, cached HTTP for the offline pipeline.

Every response is saved under pipeline/cache/<source>/ so reruns never refetch.
Each source has its own minimum gap between requests (MusicBrainz: 1 second).
Secret query parameters (like Last.fm's api_key) are left out of the cache key
and are never written to disk.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

import requests

from .config import USER_AGENT

CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"

# Minimum seconds between live requests, per source.
MIN_INTERVAL = {
    "musicbrainz": 1.1,  # MusicBrainz allows 1 req/sec; stay a little under.
    "listenbrainz": 0.5,
    "lastfm": 0.25,
    "deezer": 0.2,
}

SECRET_PARAMS = {"api_key", "token", "secret"}

_last_request: dict[str, float] = {}
_session = requests.Session()
_session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})


class HttpError(RuntimeError):
    pass


def _cache_path(source: str, method: str, url: str, params: dict | None, body: Any) -> Path:
    public_params = {k: v for k, v in (params or {}).items() if k not in SECRET_PARAMS}
    key = json.dumps([method, url, sorted(public_params.items()), body], sort_keys=True, default=str)
    digest = hashlib.sha1(key.encode()).hexdigest()
    return CACHE_DIR / source / f"{digest}.json"


def _wait_turn(source: str) -> None:
    gap = MIN_INTERVAL.get(source, 1.0)
    elapsed = time.monotonic() - _last_request.get(source, 0.0)
    if elapsed < gap:
        time.sleep(gap - elapsed)
    _last_request[source] = time.monotonic()


def fetch_json(
    source: str,
    url: str,
    params: dict | None = None,
    *,
    method: str = "GET",
    body: Any = None,
    retries: int = 5,
) -> Any:
    """Return parsed JSON for a request, from disk cache if we have it."""
    path = _cache_path(source, method, url, params, body)
    if path.exists():
        return json.loads(path.read_text())["response"]

    delay = 2.0
    for attempt in range(retries + 1):
        _wait_turn(source)
        try:
            resp = _session.request(method, url, params=params, json=body, timeout=30)
        except (requests.ConnectionError, requests.Timeout) as e:
            # Dropped connection or timeout: back off and retry.
            if attempt < retries:
                time.sleep(delay)
                delay *= 2
                continue
            raise HttpError(f"{source}: network error for {url}: {e}") from e
        # Busy / rate limited / transient server error: back off and retry.
        if resp.status_code in (429, 500, 502, 503, 504) and attempt < retries:
            time.sleep(delay)
            delay *= 2
            continue
        break

    try:
        data = resp.json()
    except ValueError:
        raise HttpError(f"{source}: HTTP {resp.status_code}, non-JSON response from {url}")

    # Cache successful responses and clean "not found" answers (they won't change on rerun).
    # Last.fm reports errors inside a 200/4xx JSON body with an "error" field.
    cacheable = resp.ok or resp.status_code == 404 or (source == "lastfm" and isinstance(data, dict) and data.get("error") == 6)
    if not cacheable:
        raise HttpError(f"{source}: HTTP {resp.status_code} from {url}: {str(data)[:200]}")

    path.parent.mkdir(parents=True, exist_ok=True)
    public_params = {k: v for k, v in (params or {}).items() if k not in SECRET_PARAMS}
    path.write_text(
        json.dumps(
            {
                "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "url": url,
                "params": public_params,
                "status": resp.status_code,
                "response": data,
            },
            ensure_ascii=False,
        )
    )
    return data
