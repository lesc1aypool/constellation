# Constellation

A galaxy-style map for discovering music. Every artist is a star; similar artists cluster into genre regions; zoom from genre families down to single bands and click your way across the map to find new music and rediscover old favourites.

- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Instructions for Claude Code: [CLAUDE.md](CLAUDE.md)
- First milestone prompt: [docs/KICKOFF_PROMPT.md](docs/KICKOFF_PROMPT.md)

**Status:** Milestone 1 (metal galaxy prototype) in progress. Repo set up; source comparison report done; waiting on the choice of similarity source.

## Repo layout

| Folder | What it is |
| --- | --- |
| `web/` | Next.js website (TypeScript, Tailwind). Will render the galaxy from `web/public/galaxy.json`. |
| `pipeline/` | Offline Python scripts that fetch data and build the galaxy. Run on your computer, not on Vercel. |
| `pipeline/cache/` | Saved raw API responses so reruns don't refetch (git-ignored). |
| `pipeline/reports/` | Reports produced by the scripts (committed so you can read them on GitHub). |
| `docs/` | Spec and planning docs. |

## Setup

You need Node.js 20+ and Python 3.11+. [uv](https://docs.astral.sh/uv/) is optional but faster than pip.

1. **Secrets:** copy `.env.example` to `.env` in the repo root and paste your Last.fm API key after `LASTFM_API_KEY=`. Never commit `.env`.

2. **Pipeline (Python):**

   ```bash
   cd pipeline
   python3 -m venv .venv            # or: uv venv
   source .venv/bin/activate        # Windows: .venv\Scripts\activate
   pip install -r requirements.txt  # or: uv pip install -r requirements.txt
   ```

3. **Website:**

   ```bash
   cd web
   npm install
   npm run dev                      # then open http://localhost:3000
   ```

## Milestone 1, step 2: source comparison

Compares ListenBrainz and Last.fm as the source of "similar artists" for 10 metal bands, from huge (Metallica) to small (Khemmis).

```bash
cd pipeline
source .venv/bin/activate
python compare_sources.py
```

It writes [`pipeline/reports/source_comparison.md`](pipeline/reports/source_comparison.md). Without a Last.fm key it still runs, with only the ListenBrainz column filled. The first run takes about 30 seconds because MusicBrainz allows one request per second; later runs read from the cache and finish instantly. Delete `pipeline/cache/` to force fresh data.
