"""Thin, cached, rate-limited clients for MusicBrainz, ListenBrainz and Last.fm.

Every raw response is cached on disk in pipeline/cache/ (git-ignored), so
reruns never refetch. Delete a cache file (or the folder) to force a refresh.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from urllib.parse import urlencode

import requests

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # dotenv is optional; plain env vars work too
    pass

CACHE_DIR = Path(__file__).resolve().parent / "cache"
CONTACT = os.environ.get("MUSICBRAINZ_CONTACT", "https://github.com/lesc1aypool/constellation")
USER_AGENT = f"ConstellationPipeline/0.1 ( {CONTACT} )"

# Minimum seconds between live requests, per host.
RATE_LIMITS = {
    "musicbrainz.org": 1.1,  # MusicBrainz rule: max 1 req/sec
    "labs.api.listenbrainz.org": 0.5,
    "ws.audioscrobbler.com": 0.25,  # Last.fm: stay well under 5 req/sec
}
_last_call: dict[str, float] = {}

# Last.fm's key is sent as a query param; strip it from cache keys so the
# cache never contains the secret.
_SECRET_PARAMS = {"api_key"}


def _cache_path(host: str, params: dict) -> Path:
    public = {k: v for k, v in sorted(params.items()) if k not in _SECRET_PARAMS}
    digest = hashlib.sha1(json.dumps(public, sort_keys=True).encode()).hexdigest()[:16]
    return CACHE_DIR / host / f"{digest}.json"


def get_json(base_url: str, params: dict, *, retries: int = 5):
    host = base_url.split("/")[2]
    path = _cache_path(host, {"_url": base_url, **params})
    if path.exists():
        return json.loads(path.read_text())

    for attempt in range(retries):
        wait = RATE_LIMITS.get(host, 0.5) - (time.time() - _last_call.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        _last_call[host] = time.time()
        try:
            resp = requests.get(
                f"{base_url}?{urlencode(params)}",
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
                timeout=30,
            )
        except requests.RequestException as exc:
            print(f"  ! {host}: {exc}; retrying")
            time.sleep(2**attempt)
            continue
        if resp.status_code in (429, 500, 502, 503, 504):
            # 503 is MusicBrainz's "you're going too fast / overloaded" signal.
            time.sleep(2**attempt)
            continue
        resp.raise_for_status()
        data = resp.json()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data))
        return data
    raise RuntimeError(f"Gave up on {base_url} after {retries} attempts")


# --- MusicBrainz ---------------------------------------------------------------

MB = "https://musicbrainz.org/ws/2"


def mb_search_artist(name: str, country: str | None = None, limit: int = 10) -> list[dict]:
    query = f'artist:"{name}"'
    if country:
        query += f" AND country:{country}"
    return get_json(f"{MB}/artist/", {"query": query, "limit": limit, "fmt": "json"})["artists"]


def mb_resolve(name: str, country: str | None = None) -> dict:
    """Best MusicBrainz match for an artist name: exact name match, highest score."""
    results = mb_search_artist(name, country)
    exact = [a for a in results if a["name"].casefold() == name.casefold()]
    if not (exact or results):
        raise LookupError(f"No MusicBrainz match for {name!r}")
    return (exact or results)[0]


# --- ListenBrainz (labs similar-artists, experimental) -------------------------

LB_SIMILAR = "https://labs.api.listenbrainz.org/similar-artists/json"
LB_ALGORITHM = "session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30"


def lb_similar(mbid: str, limit: int = 20) -> list[dict]:
    data = get_json(LB_SIMILAR, {"artist_mbids": mbid, "algorithm": LB_ALGORITHM})
    rows = [r for r in data if r.get("artist_mbid") != mbid]
    return sorted(rows, key=lambda r: -r["score"])[:limit]


# --- Last.fm -------------------------------------------------------------------

LASTFM = "https://ws.audioscrobbler.com/2.0/"


def _lastfm(method: str, **params):
    key = os.environ.get("LASTFM_API_KEY")
    if not key:
        raise RuntimeError("LASTFM_API_KEY is not set (see .env.example)")
    data = get_json(LASTFM, {"method": method, "format": "json", "api_key": key, **params})
    if "error" in data:
        raise LookupError(f"Last.fm {method}: {data.get('message')}")
    return data


def lastfm_similar(mbid: str, name: str, limit: int = 20) -> tuple[list[dict], str]:
    """Similar artists by MBID, falling back to name. Returns (rows, lookup_used)."""
    try:
        data = _lastfm("artist.getsimilar", mbid=mbid, limit=limit)
        return data["similarartists"]["artist"], "mbid"
    except LookupError:
        data = _lastfm("artist.getsimilar", artist=name, limit=limit, autocorrect=1)
        return data["similarartists"]["artist"], "name"


def lastfm_info(mbid: str, name: str) -> dict:
    try:
        return _lastfm("artist.getinfo", mbid=mbid)["artist"]
    except LookupError:
        return _lastfm("artist.getinfo", artist=name, autocorrect=1)["artist"]
