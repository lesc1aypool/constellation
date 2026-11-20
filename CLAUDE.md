# CLAUDE.md

## Project

Music Constellation Tool (working name): a galaxy-style map for discovering music. Every artist is a star with a fixed position; similar artists cluster into genre regions; users zoom from genre families down to individual artists and click from band to band. Full product spec: `docs/SPEC.md`. Read it before starting any milestone.

## Owner

Matt is a designer-developer, not a full-time engineer. He has shipped a Next.js + Supabase + Vercel site before (574 Scout). Explain trade-offs in plain language, keep setup steps explicit, and prefer boring, well-documented tools.

## Stack

- `web/`: Next.js (App Router, TypeScript), deployed on Vercel. Tailwind for styling.
- Graph rendering: Sigma.js + graphology (WebGL). Positions are precomputed; do **not** run a live force simulation in the browser.
- `pipeline/`: Python 3.11+ offline data pipeline. Use `uv` or a venv with `requirements.txt`.
- Database/auth: Supabase (Postgres). Not needed for Milestone 1; the prototype reads a static `galaxy.json`.
- Previews: Deezer public search API (30-second previews), called from a Next.js route handler.

## Hard rules

- **MusicBrainz IDs (MBIDs) are the primary key for artists everywhere.** Never key on names.
- **Respect API terms and rate limits.** MusicBrainz: max 1 request/second with a descriptive User-Agent. Last.fm: non-commercial use, attribution with links, keep stored Last.fm data well under 100 MB. Cache raw API responses on disk in `pipeline/cache/` (git-ignored) so reruns don't refetch.
- **Never commit secrets.** Keys live in `.env` / `.env.local` (git-ignored); provide `.env.example`.
- **Positions are stable.** A pipeline rerun must not move existing artists unless explicitly doing a full re-layout. Constellations and saved data reference artists, never coordinates.
- **Stay within free tiers.** Keep the database small; no paid services without asking.
- Don't decide open questions in the spec's "Open Decisions" section on your own; surface them with a recommendation.

## Working style

- Work one milestone at a time. Start each with a short plan and wait for approval before large changes.
- Small commits with clear messages.
- After each milestone: a README section on how to run it, and a short note of what was learned and what's next.
- Prefer a working, ugly end-to-end slice over a polished partial one.
