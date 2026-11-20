# Constellation

A galaxy-style map for discovering music. Every artist is a star; similar artists cluster into genre regions; zoom from genre families down to single bands and click your way across the map to find new music and rediscover old favourites.

- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Instructions for Claude Code: [CLAUDE.md](CLAUDE.md)
- First milestone prompt: [docs/KICKOFF_PROMPT.md](docs/KICKOFF_PROMPT.md)

Status: planning. Milestone 1 (metal galaxy prototype) is next.

## Pipeline: source comparison (Milestone 1, step 2)

Requires Python 3.11+ and a Last.fm API key.

```bash
cp .env.example .env          # then paste your LASTFM_API_KEY into .env
python -m venv pipeline/.venv
pipeline/.venv/bin/pip install -r pipeline/requirements.txt
pipeline/.venv/bin/python pipeline/compare_sources.py
```

Writes `pipeline/reports/source_comparison.md`. Raw API responses are cached in `pipeline/cache/` (git-ignored, the API key is never written to it), so reruns are instant. MusicBrainz is called at most once per second.
