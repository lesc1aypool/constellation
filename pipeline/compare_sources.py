"""Compare ListenBrainz and Last.fm as the similar-artist source.

For each seed artist: resolve a MusicBrainz ID, fetch the top N similar artists
from ListenBrainz (labs similar-artists API) and Last.fm (artist.getSimilar),
and write a side-by-side markdown report to pipeline/reports/.

Usage:
    python compare_sources.py            # the 10 default artists, top 20
    python compare_sources.py --top 30

Needs LASTFM_API_KEY in .env for the Last.fm column (the report still runs
without it). All API responses are cached in pipeline/cache/.
"""

from __future__ import annotations

import argparse
import re
import time
from dataclasses import dataclass, field
from pathlib import Path

from lib.config import LASTFM_API_KEY
from lib.http_cache import HttpError, fetch_json

MB_API = "https://musicbrainz.org/ws/2"
LB_LABS = "https://labs.api.listenbrainz.org/similar-artists/json"
LB_POPULARITY = "https://api.listenbrainz.org/1/popularity/artist"
LASTFM_API = "https://ws.audioscrobbler.com/2.0/"

# The algorithm ListenBrainz's own site uses for "similar artists".
LB_ALGORITHM = "session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30"

# (name, extra MusicBrainz search clause to pick the right one among namesakes)
SEEDS: list[tuple[str, str]] = [
    ("Metallica", ""),
    ("Iron Maiden", ""),
    ("Opeth", ""),
    ("In Flames", ""),
    ("Ghost", "country:SE"),  # the Swedish band, not the many other Ghosts
    ("Mastodon", ""),
    ("Gojira", ""),
    ("Sleep", ""),
    ("Wolves in the Throne Room", ""),
    ("Khemmis", ""),
]

METAL_HINTS = ("metal", "doom", "stoner", "sludge", "thrash", "death", "black", "heavy")


@dataclass
class Similar:
    name: str
    mbid: str | None
    score: float


@dataclass
class SeedResult:
    query: str
    mbid: str | None = None
    name: str = ""
    disambiguation: str = ""
    country: str = ""
    lb_users: int | None = None
    lb_listens: int | None = None
    lfm_listeners: int | None = None
    lfm_lookup: str = ""
    lb: list[Similar] = field(default_factory=list)
    lfm: list[Similar] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


# ---------------------------------------------------------------- MusicBrainz

def resolve_mbid(name: str, extra: str) -> dict | None:
    """Find the MusicBrainz artist for a name. Prefers exact-name matches with metal-ish tags."""
    query = f'artist:"{name}"' + (f" AND {extra}" if extra else "")
    data = fetch_json("musicbrainz", f"{MB_API}/artist", {"query": query, "fmt": "json", "limit": 10})
    candidates = [a for a in data.get("artists", []) if a["name"].casefold() == name.casefold()]
    if not candidates:
        return None

    def rank(a: dict) -> tuple:
        tags = " ".join(t["name"] for t in a.get("tags", []))
        metal = any(h in tags for h in METAL_HINTS)
        return (metal, a.get("score", 0), sum(t.get("count", 0) for t in a.get("tags", [])))

    return max(candidates, key=rank)


# ---------------------------------------------------------------- ListenBrainz

def lb_similar(mbid: str, top: int) -> list[Similar]:
    data = fetch_json("listenbrainz", LB_LABS, {"artist_mbids": mbid, "algorithm": LB_ALGORITHM})
    rows = [r for r in data if r.get("artist_mbid") != mbid]
    return [Similar(r["name"], r["artist_mbid"], float(r["score"])) for r in rows[:top]]


def lb_popularity(mbids: list[str]) -> dict[str, dict]:
    data = fetch_json("listenbrainz", LB_POPULARITY, method="POST", body={"artist_mbids": mbids})
    return {row["artist_mbid"]: row for row in data}


# ---------------------------------------------------------------- Last.fm

def _lastfm(method: str, **params) -> dict:
    return fetch_json(
        "lastfm",
        LASTFM_API,
        {"method": method, "api_key": LASTFM_API_KEY, "format": "json", **params},
    )


def lfm_similar(mbid: str, name: str, top: int) -> tuple[list[Similar], str]:
    """Try by MBID first (exact), fall back to name with autocorrect."""
    data = _lastfm("artist.getsimilar", mbid=mbid, limit=top)
    how = "MBID"
    if "error" in data:
        data = _lastfm("artist.getsimilar", artist=name, autocorrect=1, limit=top)
        how = "name"
    if "error" in data:
        raise HttpError(f"Last.fm: {data.get('message')}")
    rows = data.get("similarartists", {}).get("artist", [])
    return [Similar(r["name"], r.get("mbid") or None, float(r.get("match", 0))) for r in rows[:top]], how


def lfm_listeners(mbid: str, name: str) -> int | None:
    data = _lastfm("artist.getinfo", mbid=mbid)
    if "error" in data:
        data = _lastfm("artist.getinfo", artist=name, autocorrect=1)
    try:
        return int(data["artist"]["stats"]["listeners"])
    except (KeyError, TypeError, ValueError):
        return None


# ---------------------------------------------------------------- Report

def norm(name: str) -> str:
    n = name.casefold().replace("’", "'").replace("&", "and")
    n = re.sub(r"^the\s+", "", n)
    return re.sub(r"[^\w]+", "", n)


def same(a: Similar, b: Similar) -> bool:
    if a.mbid and b.mbid:
        return a.mbid == b.mbid
    return norm(a.name) == norm(b.name)


def fmt_int(n: int | None) -> str:
    return f"{n:,}" if n is not None else "–"


def cell(s: Similar | None, other: list[Similar], digits: int) -> str:
    if s is None:
        return ""
    both = any(same(s, o) for o in other)
    label = s.name.replace("|", "\\|")
    if both:
        label = f"**{label}** ●"
    if s.mbid is None:
        label += " ⚠"
    return f"{label} ({s.score:.{digits}f})"


def write_report(results: list[SeedResult], top: int, path: Path) -> None:
    has_lfm = bool(LASTFM_API_KEY)
    out: list[str] = []
    out.append("# Similar-artist source comparison: ListenBrainz vs Last.fm\n")
    out.append(f"Generated {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())} by `pipeline/compare_sources.py`. Top {top} similar artists per seed.\n")
    if not has_lfm:
        out.append("> **Last.fm column is empty:** no `LASTFM_API_KEY` was set when this ran.\n")
    out.append("## How to read this\n")
    out.append(
        "- **●** and bold = the artist appears in both lists.\n"
        "- **⚠** = no MusicBrainz ID in that result (we'd have to match by name, which is error-prone).\n"
        "- ListenBrainz score = raw co-listening strength (bigger is stronger; not 0–1). "
        "Last.fm score = match from 0 to 1.\n"
        f"- ListenBrainz algorithm: `{LB_ALGORITHM}` (the one their website uses).\n"
        "- Popularity: ListenBrainz users = distinct ListenBrainz users who played the artist; "
        "Last.fm listeners = distinct Last.fm listeners. Last.fm's user base is far larger.\n"
    )
    out.append("## Summary\n")
    out.append("| Seed | MusicBrainz match | LB users | Last.fm listeners | LB results | Last.fm results | In both | Last.fm missing MBID |")
    out.append("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    for r in results:
        overlap = sum(1 for s in r.lb if any(same(s, o) for o in r.lfm))
        missing = sum(1 for s in r.lfm if s.mbid is None)
        match = f"[{r.name}](https://musicbrainz.org/artist/{r.mbid}) – {r.disambiguation or r.country or ''}" if r.mbid else "**not found**"
        out.append(
            f"| {r.query} | {match} | {fmt_int(r.lb_users)} | {fmt_int(r.lfm_listeners)} | {len(r.lb)} | "
            f"{len(r.lfm) if has_lfm else '–'} | {overlap if has_lfm else '–'} | {missing if has_lfm else '–'} |"
        )
    out.append("")

    for r in results:
        out.append(f"## {r.query}\n")
        if r.mbid:
            extra = f" – {r.disambiguation}" if r.disambiguation else ""
            out.append(f"MusicBrainz: [{r.name}](https://musicbrainz.org/artist/{r.mbid}){extra} (`{r.mbid}`)")
            if has_lfm and r.lfm_lookup:
                out.append(f"  \nLast.fm looked up by: {r.lfm_lookup}")
            out.append("")
        for e in r.errors:
            out.append(f"> ⚠ {e}\n")
        out.append("| # | ListenBrainz | Last.fm |")
        out.append("| ---: | --- | --- |")
        for i in range(max(len(r.lb), len(r.lfm), 1)):
            a = r.lb[i] if i < len(r.lb) else None
            b = r.lfm[i] if i < len(r.lfm) else None
            out.append(f"| {i + 1} | {cell(a, r.lfm, 0)} | {cell(b, r.lb, 2)} |")
        out.append("")

    out.append("---\n")
    out.append(
        "Data: [ListenBrainz](https://listenbrainz.org) (MetaBrainz Foundation), "
        "[MusicBrainz](https://musicbrainz.org), and [Last.fm](https://www.last.fm) via the "
        "[Last.fm API](https://www.last.fm/api).\n"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(out))


# ---------------------------------------------------------------- Main

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--top", type=int, default=20, help="similar artists per seed (default 20)")
    parser.add_argument("--out", type=Path, default=Path(__file__).parent / "reports" / "source_comparison.md")
    args = parser.parse_args()

    if not LASTFM_API_KEY:
        print("Note: LASTFM_API_KEY not set; the report will only have the ListenBrainz side.")

    results: list[SeedResult] = []
    for name, extra in SEEDS:
        r = SeedResult(query=name)
        results.append(r)
        print(f"- {name}: resolving MBID…", flush=True)
        try:
            artist = resolve_mbid(name, extra)
        except HttpError as e:
            r.errors.append(f"MusicBrainz lookup failed: {e}")
            continue
        if not artist:
            r.errors.append("No exact-name match on MusicBrainz.")
            continue
        r.mbid, r.name = artist["id"], artist["name"]
        r.disambiguation, r.country = artist.get("disambiguation", ""), artist.get("country", "")

        try:
            r.lb = lb_similar(r.mbid, args.top)
        except HttpError as e:
            r.errors.append(f"ListenBrainz failed: {e}")
        if LASTFM_API_KEY:
            try:
                r.lfm, r.lfm_lookup = lfm_similar(r.mbid, r.name, args.top)
                r.lfm_listeners = lfm_listeners(r.mbid, r.name)
            except HttpError as e:
                r.errors.append(f"Last.fm failed: {e}")
        print(f"  {r.name} ({r.mbid}): LB {len(r.lb)}, Last.fm {len(r.lfm)}", flush=True)

    mbids = [r.mbid for r in results if r.mbid]
    try:
        pop = lb_popularity(mbids)
        for r in results:
            if r.mbid in pop:
                r.lb_users = pop[r.mbid].get("total_user_count")
                r.lb_listens = pop[r.mbid].get("total_listen_count")
    except HttpError as e:
        print(f"ListenBrainz popularity failed: {e}")

    write_report(results, args.top, args.out)
    print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
