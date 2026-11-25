"""Milestone 1, step 2: compare ListenBrainz vs Last.fm similar artists.

For each test artist: resolve to a MusicBrainz ID, fetch the top 20 similar
artists from both sources, and write a side-by-side markdown report to
pipeline/reports/source_comparison.md.

Run:  python pipeline/compare_sources.py
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from apis import LB_ALGORITHM, lastfm_info, lastfm_similar, lb_similar, mb_resolve

# (name, MusicBrainz country hint). Hints disambiguate names that repeat:
# "Ghost" means the Swedish band; "Sleep" means the US stoner/doom band.
ARTISTS = [
    ("Metallica", None),
    ("Iron Maiden", None),
    ("Opeth", None),
    ("In Flames", None),
    ("Ghost", "SE"),
    ("Mastodon", None),
    ("Gojira", None),
    ("Sleep", "US"),
    ("Wolves in the Throne Room", None),
    ("Khemmis", None),
]
TOP_N = 20
REPORT = Path(__file__).resolve().parent / "reports" / "source_comparison.md"


def norm(name: str) -> str:
    return "".join(ch for ch in name.casefold() if ch.isalnum())


def key(mbid: str | None, name: str) -> str:
    return mbid or f"name:{norm(name)}"


def compare(name: str, country: str | None) -> dict:
    print(f"- {name}")
    mb = mb_resolve(name, country)
    mbid = mb["id"]
    info = lastfm_info(mbid, mb["name"])
    lb = lb_similar(mbid, TOP_N)
    lf, lf_lookup = lastfm_similar(mbid, mb["name"], TOP_N)

    lb_rows = [(r["artist_mbid"], r["name"], r["score"]) for r in lb]
    lf_rows = [(r.get("mbid") or None, r["name"], float(r["match"])) for r in lf]

    # Overlap: match on MBID, or on normalised name when Last.fm has no MBID.
    lb_keys = {key(m, n) for m, n, _ in lb_rows} | {f"name:{norm(n)}" for _, n, _ in lb_rows}
    lf_keys = {key(m, n) for m, n, _ in lf_rows} | {f"name:{norm(n)}" for _, n, _ in lf_rows}
    shared_lf = {i for i, (m, n, _) in enumerate(lf_rows) if key(m, n) in lb_keys or f"name:{norm(n)}" in lb_keys}
    shared_lb = {i for i, (m, n, _) in enumerate(lb_rows) if key(m, n) in lf_keys or f"name:{norm(n)}" in lf_keys}

    return {
        "name": mb["name"],
        "mbid": mbid,
        "disambiguation": mb.get("disambiguation", ""),
        "country": mb.get("country", ""),
        "listeners": int(info.get("stats", {}).get("listeners", 0)),
        "lb": lb_rows,
        "lf": lf_rows,
        "lf_lookup": lf_lookup,
        "lf_with_mbid": sum(1 for m, _, _ in lf_rows if m),
        "shared_lb": shared_lb,
        "shared_lf": shared_lf,
    }


def render(results: list[dict]) -> str:
    out = [
        "# Similar-artist source comparison: ListenBrainz vs Last.fm",
        "",
        f"Generated {date.today().isoformat()} by `pipeline/compare_sources.py`. "
        f"Top {TOP_N} similar artists per source.",
        "",
        f"- **ListenBrainz:** labs `similar-artists` API (experimental), algorithm `{LB_ALGORITHM}`. Score = raw co-listening count.",
        "- **Last.fm:** `artist.getSimilar`, match = 0–1. Data from [Last.fm](https://www.last.fm).",
        "- **Bold** = the artist appears in both lists. Overlap is matched by MBID, or by name when Last.fm gives no MBID.",
        "",
        "## Summary",
        "",
        "| Artist | Last.fm listeners | LB results | Last.fm results | Overlap | Last.fm results with MBID |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for r in results:
        out.append(
            f"| {r['name']} | {r['listeners']:,} | {len(r['lb'])} | {len(r['lf'])} | "
            f"{len(r['shared_lb'])} | {r['lf_with_mbid']}/{len(r['lf'])} |"
        )
    out += [
        "",
        "Things to judge by eye: are the results metal at all? Are they the *right* neighbourhood "
        "(e.g. Khemmis → doom, not generic rock)? Does a source collapse into the same few huge bands?",
        "",
    ]
    for r in results:
        desc = ", ".join(x for x in [r["country"], r["disambiguation"]] if x)
        out += [
            f"## {r['name']}" + (f" ({desc})" if desc else ""),
            "",
            f"MBID [`{r['mbid']}`](https://musicbrainz.org/artist/{r['mbid']}) · "
            f"{r['listeners']:,} Last.fm listeners · Last.fm looked up by {r['lf_lookup']}",
            "",
            "| # | ListenBrainz | score | Last.fm | match |",
            "| ---: | --- | ---: | --- | ---: |",
        ]
        for i in range(max(len(r["lb"]), len(r["lf"]), 1)):
            lb_cell = lb_score = lf_cell = lf_score = ""
            if i < len(r["lb"]):
                _, n, s = r["lb"][i]
                lb_cell = f"**{n}**" if i in r["shared_lb"] else n
                lb_score = f"{s:,}"
            if i < len(r["lf"]):
                m, n, s = r["lf"][i]
                lf_cell = f"**{n}**" if i in r["shared_lf"] else n
                if not m:
                    lf_cell += " ⚠︎"
                lf_score = f"{s:.2f}"
            if not (r["lb"] or r["lf"]):
                lb_cell = "(no results)"
            out.append(f"| {i + 1} | {lb_cell} | {lb_score} | {lf_cell} | {lf_score} |")
        out += ["", "⚠︎ = Last.fm gave no MBID for this artist (would need a MusicBrainz lookup).", ""]
    return "\n".join(out)


def main() -> None:
    print("Comparing sources (cached responses are reused):")
    results = [compare(name, country) for name, country in ARTISTS]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(render(results))
    print(f"\nWrote {REPORT}")


if __name__ == "__main__":
    main()
