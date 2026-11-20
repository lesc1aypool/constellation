# Constellation

A galaxy-style map for discovering music. Every artist is a star; similar artists cluster into genre regions; zoom from genre families down to single bands and click your way across the map to find new music and rediscover old favourites.

- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Instructions for Claude Code: [CLAUDE.md](CLAUDE.md)
- First milestone prompt: [docs/KICKOFF_PROMPT.md](docs/KICKOFF_PROMPT.md)

Status: Milestone 1 (metal galaxy prototype) built: pipeline + explorable web galaxy. Next: play with it and decide what to tune.

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

## Web app (Milestone 1, step 4)

```bash
cd web
npm install
npm run dev
```

Opens on http://localhost:3000. Next.js 16 (App Router, TypeScript, Tailwind), Sigma.js 3 + graphology for the WebGL galaxy. No API keys needed: previews come from Deezer's public API.

What you can do:

- **Zoom** (scroll, pinch, or the +/− buttons). Zoomed out you see region names and each region's biggest artists; subregions and smaller artists fade in as you zoom.
- **Search** (top left) with autocomplete; picking an artist glides the camera there.
- **Click/tap a star:** its connections light up, everything else dims, a 30-second Deezer preview starts, and the panel lists its nearest stars to hop to. ⏭ plays the next top track; 🔊 turns autoplay off.
- **Breadcrumb trail** of where you've been; click any step to jump back.
- **Esc** or clicking empty space clears the selection.

Code map:

- `web/components/GalaxyMap.tsx`: the Sigma renderer, semantic zoom rules, camera glides, region labels.
- `web/components/StarProgram.ts`: WebGL shader that draws stars with a glow.
- `web/components/GalaxyApp.tsx`: search, breadcrumbs, artist panel, audio.
- `web/app/api/preview/route.ts`: finds the artist on Deezer and returns preview tracks.

### Deploying to Vercel

Import the repo in Vercel and set **Root Directory** to `web`. No environment variables are needed. `web/public/galaxy.json` is committed, so the deploy doesn't run the pipeline.

## Milestone 1 notes

What we learned:

- **Last.fm beats ListenBrainz for similarity** in metal: it stays inside subgenres, while ListenBrainz's labs data drifts to generic popular rock (Metallica → Nirvana).
- **Growing the map needs balancing.** "Add the most-connected artist next" lets dense scenes (power/prog) swallow everything; taking turns between seed neighbourhoods fixes it.
- **Tag-based crawling reaches hate-music scenes** (NSBM) within a few hops of mainstream black metal. Excluded for now; see open decisions.
- **Deezer name matching is fuzzy.** Its search ranks the Swedish Ghost far down a list of unrelated "Ghost"s; we take the exact-name match with the most fans, which works for 29/30 sampled artists.
- **ForceAtlas2 LinLog** gives clean, separate regions, but with big empty gaps between them. It reads well as a galaxy.

Open decisions (for Matt):

1. **NSBM / hate-music policy:** keep excluding by tag (current), add a manual blocklist, or something else?
2. **Sigma 3 vs 4:** we use Sigma 3 (stable, well documented). Sigma 4 came out recently with a new styling system; worth revisiting later, not now.
3. **Layout feel:** regions are tight islands with wide gaps. We can still `--relayout` freely (nothing stores coordinates); once the map is public, positions should be frozen.

Next steps (suggested):

- Use MusicBrainz's links to Deezer artist pages to get exact Deezer IDs, instead of matching by name.
- Grow to ~1,000 artists and check performance and label clutter on phones (labels in very dense clusters still overlap until you zoom in).
- Motion from the spec not yet built: stars popping in one by one, lines drawing outward.

## Data attribution

Similarity, listener counts and tags come from [Last.fm](https://www.last.fm) (non-commercial use). Artist IDs come from [MusicBrainz](https://musicbrainz.org).
