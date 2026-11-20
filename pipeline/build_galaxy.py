"""Milestone 1, step 3: build the metal galaxy and write web/public/galaxy.json.

    python pipeline/build_galaxy.py                 # ~300 artists
    python pipeline/build_galaxy.py --target 600    # grow it; existing stars stay put
    python pipeline/build_galaxy.py --relayout      # full re-layout (moves everything)

Steps:
  1. Expand from seed artists by similar-artist hops (Last.fm), best-first,
     keeping only artists Last.fm tags as metal-ish, until --target is reached.
  2. Build similarity edges between the included artists.
  3. Lay out positions with ForceAtlas2. Artists already in galaxy.json are
     pinned; new ones start at the average of their placed neighbours.
  4. Cluster into two nested levels with Leiden and name clusters from tags.
  5. Write galaxy.json.

All API responses are cached in pipeline/cache/, so reruns are fast.
"""

from __future__ import annotations

import argparse
import heapq
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import igraph as ig
import leidenalg
import numpy as np

from apis import lastfm_info, lastfm_similar, mb_resolve, mb_resolve_exact
from compare_sources import ARTISTS as SEEDS

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "galaxy.json"
SIMILAR_LIMIT = 50
EDGES_PER_ARTIST = 12
RNG_SEED = 42

# An artist counts as "in the metal galaxy" if any of its top Last.fm tags
# contains one of these words.
METAL_WORDS = ("metal", "doom", "sludge", "stoner", "grind", "djent", "thrash", "core", "nwobhm")
# Artists carrying any of these tags are left out of the galaxy entirely and
# never expanded through. Owner decision pending (see README / Milestone notes).
EXCLUDE_TAGS = {"nsbm", "national socialist black metal"}
# Words that mark a tag as a genre (vs. a descriptor like "swedish" or "80s").
GENRE_WORDS = METAL_WORDS + ("rock", "punk", "post-", "gaze", "wave", "prog", "folk", "industrial", "drone", "noise")
# Tags that say nothing about the music.
JUNK_TAGS = {"seen live", "favorites", "favourite", "awesome", "metal", "heavy", "rock", "under 2000 listeners"}


def is_metal(tags: list[str]) -> bool:
    return any(w in t for t in tags for w in METAL_WORDS)


def is_excluded(tags: list[str]) -> bool:
    return any(t in EXCLUDE_TAGS for t in tags)


def is_genre(tag: str) -> bool:
    return any(w in tag for w in GENRE_WORDS)


# --- 1. Expansion ----------------------------------------------------------------


class Collector:
    def __init__(self) -> None:
        self.artists: dict[str, dict] = {}  # mbid -> {name, listeners, tags, url}
        self.similar: dict[str, list[tuple[str, str, float]]] = {}  # mbid -> [(mbid, name, match)]
        self.name_to_mbid: dict[str, str | None] = {}
        self.rejected: set[str] = set()

    def mbid_for(self, row: dict) -> str | None:
        if row.get("mbid"):
            return row["mbid"]
        name = row["name"]
        if name not in self.name_to_mbid:
            self.name_to_mbid[name] = mb_resolve_exact(name)
        return self.name_to_mbid[name]

    def add(self, mbid: str, name: str, *, force: bool = False) -> bool:
        """Fetch info + similar artists; include the artist if it's metal (or forced)."""
        info = lastfm_info(mbid, name)
        tags = [t["name"].strip().lower() for t in info.get("tags", {}).get("tag", [])]
        if is_excluded(tags) or (not force and not is_metal(tags)):
            self.rejected.add(mbid)
            return False
        self.artists[mbid] = {
            "name": info.get("name", name),
            "listeners": int(info.get("stats", {}).get("listeners", 0)),
            "tags": tags,
            "url": info.get("url", ""),
        }
        rows, _ = lastfm_similar(mbid, name, SIMILAR_LIMIT)
        self.similar[mbid] = [(r.get("mbid") or "", r["name"], float(r["match"])) for r in rows]
        return True


def expand(seeds: list[tuple[str, str]], target: int, forced: list[tuple[str, str]]) -> Collector:
    """Grow the galaxy evenly around each seed artist.

    Every candidate belongs to the "territory" of the seed whose neighbourhood
    found it first. Territories take turns adding their strongest-linked
    candidate, so doom, black metal etc. grow as much as the huge, densely
    linked power/prog regions instead of being swamped by them.

    The process is deterministic (cached data, fixed order), so a bigger
    --target adds artists on top of the same first N.
    """
    c = Collector()
    for mbid, name in seeds:
        c.add(mbid, name, force=True)
    order = [m for m, _ in seeds]
    heaps: dict[str, list[tuple[float, str]]] = {m: [] for m in order}
    owner: dict[str, str] = {}  # candidate key -> territory (seed mbid)
    best: dict[str, float] = {}
    names: dict[str, str] = {}
    origin = {m: m for m in order}

    def push_neighbours(mbid: str) -> None:
        territory = origin[mbid]
        for cand_mbid, cand_name, match in c.similar[mbid]:
            key = cand_mbid or f"name:{cand_name}"
            if key in c.artists or key in c.rejected:
                continue
            owner.setdefault(key, territory)
            names[key] = cand_name
            if match > best.get(key, 0):
                best[key] = match
                heapq.heappush(heaps[owner[key]], (-match, key))

    for m in order:
        push_neighbours(m)

    while len(c.artists) < target and any(heaps.values()):
        for territory in order:
            heap = heaps[territory]
            while heap and len(c.artists) < target:
                neg, key = heapq.heappop(heap)
                if key in c.artists or key in c.rejected or -neg < best[key]:
                    continue  # already handled, or a stale entry
                name = names[key]
                mbid = c.mbid_for({"name": name}) if key.startswith("name:") else key
                if not mbid or mbid in c.artists or mbid in c.rejected:
                    c.rejected.add(key)
                    continue
                if c.add(mbid, name):
                    origin[mbid] = territory
                    print(f"  add {len(c.artists):4d}  {name}  ({c.artists[territory]['name']} area)")
                    push_neighbours(mbid)
                    break
                c.rejected.add(key)

    # Artists from an earlier galaxy.json always stay in.
    for mbid, name in forced:
        if mbid not in c.artists:
            c.add(mbid, name, force=True)
    return c


# --- 2. Edges --------------------------------------------------------------------


def build_edges(c: Collector, per_artist: int = EDGES_PER_ARTIST) -> dict[tuple[str, str], float]:
    """Undirected edges between included artists. Each artist keeps only its
    strongest `per_artist` links (an edge survives if either end keeps it),
    which keeps clusters crisp and the map readable."""
    edges: dict[tuple[str, str], float] = {}
    for a, rows in c.similar.items():
        kept = 0
        for b_mbid, b_name, match in rows:  # Last.fm rows are sorted by match
            b = b_mbid or c.name_to_mbid.get(b_name)
            if not b or b == a or b not in c.artists:
                continue
            pair = (a, b) if a < b else (b, a)
            edges[pair] = max(edges.get(pair, 0.0), match)
            kept += 1
            if kept >= per_artist:
                break
    return edges


# --- 3. Layout (ForceAtlas2, LinLog mode, with pinned nodes) ---------------------


def forceatlas2(
    pos: np.ndarray,
    ei: np.ndarray,
    ej: np.ndarray,
    w: np.ndarray,
    fixed: np.ndarray,
    iterations: int,
    scaling: float = 2.0,
    gravity: float = 1.0,
) -> np.ndarray:
    """ForceAtlas2 (Jacomy et al. 2014) with LinLog attraction, which separates
    clusters well. Plain O(n²) repulsion: fine up to a couple of thousand nodes.
    Nodes where fixed[i] is True never move."""
    pos = pos.copy()
    n = len(pos)
    deg = np.bincount(np.concatenate([ei, ej]), minlength=n)
    mass = deg + 1.0
    prev_f = np.zeros_like(pos)
    speed = 1.0
    mm = mass[:, None] * mass[None, :]
    for _ in range(iterations):
        delta = pos[:, None, :] - pos[None, :, :]
        d2 = (delta**2).sum(-1)
        np.fill_diagonal(d2, np.inf)
        d2 = np.maximum(d2, 1e-6)
        f = ((scaling * mm / d2)[:, :, None] * delta).sum(1)  # repulsion: kr·m·m / d

        dv = pos[ei] - pos[ej]
        d = np.linalg.norm(dv, axis=1) + 1e-9
        fa = (w * np.log1p(d) / d)[:, None] * dv  # LinLog attraction
        np.add.at(f, ei, -fa)
        np.add.at(f, ej, fa)

        r = np.linalg.norm(pos, axis=1, keepdims=True) + 1e-9
        f -= gravity * mass[:, None] * pos / r  # gravity towards the centre

        f[fixed] = 0.0
        # Adaptive speed: slow down nodes that oscillate (swing), speed up
        # the whole layout while it moves coherently (traction).
        swing = np.linalg.norm(f - prev_f, axis=1)
        traction = np.linalg.norm(f + prev_f, axis=1) / 2
        g_swing = (mass * swing).sum() + 1e-9
        g_traction = (mass * traction).sum()
        speed = min(g_traction / g_swing, 1.5 * speed)
        node_speed = 0.1 * speed / (1 + speed * np.sqrt(swing))
        fn = np.linalg.norm(f, axis=1) + 1e-9
        node_speed = np.minimum(node_speed, 10.0 / fn)
        pos += f * node_speed[:, None]
        prev_f = f
    return pos


def layout(
    mbids: list[str],
    edges: dict[tuple[str, str], float],
    previous: dict[str, tuple[float, float]],
) -> np.ndarray:
    rng = np.random.default_rng(RNG_SEED)
    idx = {m: i for i, m in enumerate(mbids)}
    ei = np.array([idx[a] for a, _ in edges])
    ej = np.array([idx[b] for _, b in edges])
    w = np.array(list(edges.values()))
    n = len(mbids)
    fixed = np.array([m in previous for m in mbids])
    pos = np.zeros((n, 2))

    if not fixed.any():
        pos = rng.uniform(-1, 1, (n, 2)) * math.sqrt(n) * 10
        pos = forceatlas2(pos, ei, ej, w, fixed, iterations=1500)
        return pos - pos.mean(0)  # centre the galaxy once, at full layout only

    for m in previous:
        if m in idx:
            pos[idx[m]] = previous[m]
    # Place new artists at the weighted average of already-placed neighbours.
    # Repeat so that chains of new artists also get sensible starting points.
    placed = fixed.copy()
    spread = np.ptp(pos[fixed], axis=0).mean() * 0.01 + 1
    for _ in range(5):
        acc = np.zeros((n, 2))
        tot = np.zeros(n)
        for (a, b), wt in edges.items():
            i, j = idx[a], idx[b]
            if placed[j]:
                acc[i] += wt * pos[j]
                tot[i] += wt
            if placed[i]:
                acc[j] += wt * pos[i]
                tot[j] += wt
        newly = (~placed) & (tot > 0)
        pos[newly] = acc[newly] / tot[newly, None] + rng.normal(0, spread, (newly.sum(), 2))
        placed |= newly
    orphans = ~placed
    pos[orphans] = rng.normal(0, spread * 50, (orphans.sum(), 2))
    # Let only the new artists settle (nudges them apart, out of overlaps).
    return forceatlas2(pos, ei, ej, w, fixed, iterations=600)


# --- 4. Clusters -----------------------------------------------------------------


def leiden(g: ig.Graph, resolution: float) -> list[int]:
    part = leidenalg.find_partition(
        g,
        leidenalg.RBConfigurationVertexPartition,
        weights="weight",
        resolution_parameter=resolution,
        seed=RNG_SEED,
    )
    return part.membership


def tag_label(members: list[str], pool: list[str], c: Collector, taken: set[str]) -> str:
    """Name a cluster after the tag that is most typical of it compared with the
    surrounding pool (cluster share minus pool share), skipping names in use."""

    def tag_share(ms: list[str]) -> Counter:
        cnt: Counter = Counter()
        for m in ms:
            for rank, t in enumerate(c.artists[m]["tags"][:5]):
                if t not in JUNK_TAGS:
                    cnt[t] += 1 / (1 + 0.3 * rank)
        total = sum(cnt.values()) or 1
        return Counter({t: v / total for t, v in cnt.items()})

    inside, outside = tag_share(members), tag_share(pool)
    ranked = [t for t in sorted(inside, key=lambda t: -(inside[t] * 2 - outside.get(t, 0)))
              if t not in EXCLUDE_TAGS]
    genres = [t for t in ranked if is_genre(t)]
    candidates = []
    if ranked and not is_genre(ranked[0]):
        # A descriptor ("swedish", "80s") is most typical: pair it with a genre.
        d = ranked[0]
        candidates += [f"{d} {g}" for g in genres if d not in g]
    candidates += genres + ranked
    for t in candidates:
        if t not in taken:
            return t
    return candidates[0] if candidates else "uncharted"


def cluster(
    mbids: list[str], edges: dict[tuple[str, str], float], pos: np.ndarray, c: Collector,
    top_res: float, sub_res: float,
) -> tuple[list[dict], dict[str, list[str]]]:
    idx = {m: i for i, m in enumerate(mbids)}
    g = ig.Graph(n=len(mbids), edges=[(idx[a], idx[b]) for a, b in edges])
    g.es["weight"] = list(edges.values())
    sizes = np.array([math.log10(c.artists[m]["listeners"] + 10) for m in mbids])

    def centroid(members: list[int]) -> list[float]:
        wts = sizes[members]
        x, y = (pos[members] * wts[:, None]).sum(0) / wts.sum()
        return [round(float(x), 2), round(float(y), 2)]

    clusters: list[dict] = []
    assignment: dict[str, list[str]] = {m: [] for m in mbids}
    top = leiden(g, top_res)
    top_groups = defaultdict(list)
    for i, k in enumerate(top):
        top_groups[k].append(i)
    taken: set[str] = set()
    for k, members in sorted(top_groups.items(), key=lambda kv: -len(kv[1])):
        cid = f"c{len(clusters)}"
        label = tag_label([mbids[i] for i in members], mbids, c, taken)
        taken.add(label)
        clusters.append({"id": cid, "parentId": None, "level": 0, "label": label,
                         "size": len(members), "centroid": centroid(members)})
        for i in members:
            assignment[mbids[i]].append(cid)

        sub = g.subgraph(members)
        sub_m = leiden(sub, sub_res) if len(members) >= 12 else [0] * len(members)
        sub_groups = defaultdict(list)
        for local, s in enumerate(sub_m):
            sub_groups[s].append(members[local])
        if len(sub_groups) < 2:
            continue
        parent_pool = [mbids[i] for i in members]
        for s, smembers in sorted(sub_groups.items(), key=lambda kv: -len(kv[1])):
            sid = f"{cid}.{len([x for x in clusters if x['parentId'] == cid])}"
            slabel = tag_label([mbids[i] for i in smembers], parent_pool, c, taken | {label})
            taken.add(slabel)
            clusters.append({"id": sid, "parentId": cid, "level": 1, "label": slabel,
                             "size": len(smembers), "centroid": centroid(smembers)})
            for i in smembers:
                assignment[mbids[i]].append(sid)
    return clusters, assignment


# --- 5. Output -------------------------------------------------------------------


def load_previous() -> dict:
    if not OUT.exists():
        return {}
    return json.loads(OUT.read_text())


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--target", type=int, default=300, help="number of artists (default 300)")
    ap.add_argument("--relayout", action="store_true", help="recompute every position from scratch")
    ap.add_argument("--top-resolution", type=float, default=0.6, help="Leiden resolution, top level")
    ap.add_argument("--sub-resolution", type=float, default=1.0, help="Leiden resolution, sub level")
    args = ap.parse_args()

    prev = load_previous()
    prev_artists = {a["mbid"]: a for a in prev.get("artists", [])}
    previous_pos = {} if args.relayout else {m: (a["x"], a["y"]) for m, a in prev_artists.items()}

    print("Resolving seeds on MusicBrainz…")
    seeds = [(a["id"], a["name"]) for a in (mb_resolve(n, cc) for n, cc in SEEDS)]
    forced = [(m, a["name"]) for m, a in prev_artists.items()]
    target = max(args.target, len(prev_artists))

    print(f"Expanding to {target} artists (Last.fm similar artists)…")
    c = expand(seeds, target, forced)
    mbids = sorted(c.artists, key=lambda m: -c.artists[m]["listeners"])
    edges = build_edges(c)
    print(f"{len(mbids)} artists, {len(edges)} edges")

    kept = sum(m in previous_pos for m in mbids)
    print(f"Layout: {kept} pinned, {len(mbids) - kept} new…")
    pos = layout(mbids, edges, previous_pos)

    print("Clustering…")
    clusters, assignment = cluster(mbids, edges, pos, c, args.top_resolution, args.sub_resolution)

    lis = np.array([max(c.artists[m]["listeners"], 1) for m in mbids], dtype=float)
    lo, hi = np.log10(lis.min()), np.log10(lis.max())
    size = 2 + 13 * (np.log10(lis) - lo) / max(hi - lo, 1e-9)

    galaxy = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "similaritySource": "Last.fm",
            "attribution": "Similarity, listener and tag data from Last.fm (https://www.last.fm). Artist IDs from MusicBrainz.",
            "artistCount": len(mbids),
            "edgeCount": len(edges),
        },
        "artists": [
            {
                "mbid": m,
                "name": c.artists[m]["name"],
                "x": round(float(pos[i, 0]), 2),
                "y": round(float(pos[i, 1]), 2),
                "size": round(float(size[i]), 2),
                "listeners": c.artists[m]["listeners"],
                "tags": c.artists[m]["tags"][:3],
                "url": c.artists[m]["url"],
                "clusterIds": assignment[m],
            }
            for i, m in enumerate(mbids)
        ],
        "edges": [
            {"source": a, "target": b, "weight": round(wt, 3)}
            for (a, b), wt in sorted(edges.items(), key=lambda kv: -kv[1])
        ],
        "clusters": clusters,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(galaxy, ensure_ascii=False, separators=(",", ":")))
    print(f"\nWrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")
    for cl in clusters:
        indent = "    " if cl["parentId"] else ""
        print(f"  {indent}{cl['id']:6s} {cl['label']:<32s} {cl['size']:4d} artists")


if __name__ == "__main__":
    main()
