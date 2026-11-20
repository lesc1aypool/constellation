# Constellation

A galaxy-style map for discovering music. Every artist is a star; similar artists cluster into genre regions; zoom from genre families down to single bands and click your way across the map to find new music and rediscover old favourites.

- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Instructions for Claude Code: [CLAUDE.md](CLAUDE.md)
- First milestone prompt: [docs/KICKOFF_PROMPT.md](docs/KICKOFF_PROMPT.md)

Status: Milestone 1 in progress. Steps 1–3 done (repo setup, source comparison, galaxy pipeline); step 4 (web prototype) is next.

## Pipeline setup

Requires Python 3.11+ and a Last.fm API key.

```bash
cp .env.example .env          # then paste your LASTFM_API_KEY into .env
python -m venv pipeline/.venv
pipeline/.venv/bin/pip install -r pipeline/requirements.txt
```

### Source comparison (Milestone 1, step 2)

```bash
pipeline/.venv/bin/python pipeline/compare_sources.py
```

Writes `pipeline/reports/source_comparison.md`. Decision: **Last.fm** is the similarity source for Milestone 1 (it stays inside subgenres; ListenBrainz drifts to generic popular rock). Raw API responses are cached in `pipeline/cache/` (git-ignored, the API key is never written to it), so reruns are instant. MusicBrainz is called at most once per second.

### Build the galaxy (Milestone 1, step 3)

```bash
pipeline/.venv/bin/python pipeline/build_galaxy.py               # ~300 artists
```

```bash
pipeline/.venv/bin/python pipeline/build_galaxy.py --target 600  # grow; existing stars don't move
```

```bash
pipeline/.venv/bin/python pipeline/build_galaxy.py --relayout    # full re-layout (moves everything)
```

Writes `web/public/galaxy.json`: `artists` (mbid, name, x, y, size, listeners, tags, url, clusterIds), `edges` (source, target, weight) and `clusters` (id, parentId, level, label, size, centroid). A fresh build takes a few minutes (Last.fm + MusicBrainz rate limits); reruns from cache take seconds.

How it works:

1. **Expand** from the 10 seed artists using Last.fm similar artists. Each seed's neighbourhood takes turns adding its strongest-linked candidate, so doom or black metal grows as much as the densely linked power/prog areas. Only artists whose Last.fm tags look like metal (metal, doom, sludge, stoner, core…) are added.
2. **Edges:** each artist keeps its 12 strongest links to other artists in the galaxy.
3. **Layout:** ForceAtlas2 (LinLog mode, our own small numpy version). Artists already in `galaxy.json` are pinned; new ones start at the average position of their neighbours and settle around them.
4. **Clusters:** Leiden, two levels (genre region → subgenre), named from the most typical Last.fm tags ("swedish" + "melodic death metal" → "swedish melodic death metal").

Notes:

- Cluster IDs and colours are recomputed every run, so `c3` may be a different region after a rerun. Nothing should store cluster IDs; store artist MBIDs.
- Artists tagged NSBM are excluded (`EXCLUDE_TAGS` in `build_galaxy.py`); see open decisions.
- Last.fm responses are cached with bios and images stripped (~8 MB for ~700 artists), staying well under Last.fm's 100 MB limit.

## Web app

```bash
cd web
npm install
npm run dev
```

Opens on http://localhost:3000. Next.js 16 (App Router, TypeScript, Tailwind). The galaxy viewer is Milestone 1 step 4.

## Data attribution

Similarity, listener counts and tags come from [Last.fm](https://www.last.fm) (non-commercial use). Artist IDs come from [MusicBrainz](https://musicbrainz.org).
