# Kickoff prompt for Claude Code

Paste everything below the line into Claude Code, run from the new repo folder (CLAUDE.md is at the root and the spec is in docs/SPEC.md).

---

Read CLAUDE.md and docs/SPEC.md. We're starting **Milestone 1: Metal galaxy prototype**. The goal is to find out whether exploring a fixed music galaxy actually feels good, before building accounts or community features.

Scope:

1. **Repo setup:** monorepo with `web/` (Next.js + TypeScript + Tailwind) and `pipeline/` (Python). Add `.gitignore`, `.env.example` and a README.

2. **Source comparison script (do this first):** `pipeline/compare_sources.py` takes 10 artist names, resolves each to a MusicBrainz ID, and fetches the top 20 similar artists from both ListenBrainz (labs similar-artists API) and Last.fm (`artist.getSimilar`). Output a side-by-side markdown report in `pipeline/reports/` so I can judge quality. Use these artists: Metallica, Iron Maiden, Opeth, In Flames, Ghost (the Swedish band), Mastodon, Gojira, Sleep, Wolves in the Throne Room, Khemmis. Stop after this step and show me the report before continuing.

3. **Pipeline:** `pipeline/build_galaxy.py`
   - Seed: about 300 metal artists (start from the 10 above and expand by similar-artist hops, capped by count), using whichever source I choose after step 2.
   - Fetch similarity edges and listener counts; resolve MBIDs; cache all raw responses on disk.
   - Compute a fixed 2D layout (ForceAtlas2 or equivalent) and hierarchical clusters (Leiden), naming each cluster from its most common genre tags.
   - Write `web/public/galaxy.json`: artists (mbid, name, x, y, size, clusterIds) + edges (source, target, weight) + clusters (id, parentId, label, centroid).
   - Rerunning with more artists must keep existing artists' positions (place new ones near their neighbours).

4. **Web prototype:**
   - Full-screen dark galaxy rendered with Sigma.js from `galaxy.json`.
   - Semantic zoom: zoomed out shows cluster labels and only the biggest artists; more artists and labels fade in as you zoom.
   - Search box with autocomplete; selecting an artist glides the camera to it.
   - Clicking an artist highlights its connections, dims the rest, and plays a 30-second Deezer preview (via a Next.js route handler).
   - Breadcrumb trail of visited artists with jump-back.
   - Subtle motion: smooth camera transitions, soft glow on stars.
   - Must work with mouse and with touch/pinch on mobile.

Out of scope for now: Supabase, accounts, voting, adding artists, constellations, album planets.

Start with a short plan, then do step 1 and step 2, and pause for my source decision.
