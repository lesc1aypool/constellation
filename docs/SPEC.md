# Music Constellation Tool – Product Spec

Source of truth: the "Music Constellation Tool – Concept" doc. This file is a snapshot for the codebase (exported 2026-11-19). If they disagree, ask the owner.

## Mission

A fun, novel way to find new music and rediscover music you've loved before, using exploration and game mechanics to dive into music you know and music you don't.

## Vision

A visual, explorable map for discovering music. Search any artist and they appear as a star, with related artists connected around them. Click a related artist and the camera glides there, revealing its own neighbours, so users can wander endlessly from band to band and drift across adjacent genres. Example: classic heavy metal → a metal band with a Swedish flavour → Swedish metal and neighbouring styles.

## Audience and Retention

Core principle: discovery-oriented, like No Man's Sky. There is always further to go, and every trip ends with something new or something rediscovered.

Risk to solve: music maps tend to get one "wow" visit and no return.

- **Primary users:** people bored with algorithmic playlists that keep serving the same artists.
- **Core contributors:** music nerds (crate-diggers, subgenre obsessives) who build constellations and vote, giving everyone else a reason to visit.

Retention ideas to explore (not in the first build):

- **Your own map:** connect Spotify, Last.fm or ListenBrainz history; known artists light up, the rest is unexplored dark space (fog of war). Artists you haven't played in years glow dimly to invite rediscovery.
- **Discoverer credit:** the first person to add an artist or a connection that holds up keeps their name on it.
- **Export:** save finds and export them as a Spotify playlist.
- **New stars:** new releases near your explored space appear as newly born stars.
- **Journeys:** weekly challenges (get from Metallica to Björk) and shareable paths.

## Galaxy Map Design

One persistent galaxy with fixed positions and semantic zoom, inspired by the No Man's Sky galaxy map.

### Fixed positions

- Layout is computed **offline** (ForceAtlas2 via graphology, or UMAP on tags + similarity). Store x/y per artist.
- New artists are placed at the average position of their connections, nudged to avoid overlap. Nothing else moves.
- Constellations are stored as **artist lists, not coordinates**, so a full re-layout never breaks them.
- Periodic full re-layouts keep the galaxy in step with community votes.

### Layers of interaction

Exploring the map moves through five **layers of interaction** (refer to them as "interaction layer 1", "layer 2" and so on). Each layer is a viewpoint with its own job; the space metaphor names it. The visual journey through the universe is the main experience. (Agreed 2026-11-25; still being explored, so the number of layers may change.)

| Layer | What you see | Metaphor | Job |
| --- | --- | --- | --- |
| 1 | Genre names only (stoner rock, black metal…). Widest view. | **Universe**: each genre is a galaxy. | Choose a direction. |
| 2 | A genre splits into its subgenres (stoner metal, doom metal, sludge). | **Galaxy**: subgenres are its star clusters. | Narrow down. |
| 3 | The most popular bands in each subgenre, not all of them. | **Bright stars**: popularity is brightness; zooming in is like a stronger telescope revealing fainter stars. | Familiar names as starting points. |
| 4 | Click a band: it zooms in to that band and all its related bands, with lines showing listener overlap. | **Neighbourhood** | Hop from band to band. |
| 5 | Only the band and its own system. | **Solar system**: the band is the sun, albums are planets. | Dig into one band. |

- "Constellation" is reserved for user-drawn constellations (see below), not for layer 4.
- Layers 1–2 come from hierarchical community detection (Leiden) in the offline script; genre tags name each region.
- Layer 3 ranks bands by listener counts; smaller artists fade in as you zoom.
- Camera glides smoothly between layers while detail fades in and out.
- **Orientation (secondary):** a small breadcrumb at the side shows where you are (e.g. Universe › Stoner Rock › Doom Metal), alongside the trail of bands visited. Kept small; it supports the visual exploration and never competes with it.

### Band solar systems (later)

Each artist is a star with its own solar system.

- Planets = albums (MusicBrainz release groups).
- Orbit distance = release order: debut closest, newest farthest.
- Planet size = popularity (album listen/play counts; Spotify does not expose stream counts).
- Later still: moons = songs or singles; asteroid belt = live recordings, EPs, bootlegs; comets = band members travelling between systems to link side projects.

### Motion and feel

- Nodes pop in one after another when an artist expands.
- Camera glides to centre the selected artist.
- Connection lines draw themselves outward.
- Soft glow and gentle drift so the map never feels static.
- Line thickness reflects connection strength.
- Breadcrumb trail of the path taken, with jump-back.
- Colour by genre region so stylistic drift is visible.

## Listening

Discovery without sound is a weak hook, so **30-second previews are in the first version** (Deezer or iTunes preview APIs; avoid Spotify). Later, an artist panel adds a Wikipedia bio and other media.

## Community Curation (Phase 2+)

Wikipedia-like: users help curate and grow the map.

- Up/down votes on the accuracy of a connection.
- Users add new artists and connections via a small "+" node on each artist. The add flow searches our database first, then MusicBrainz, so every artist gets a proper MBID.
- Connecting two existing artists: prototype drag-one-onto-another vs. a deliberate "connect" mode. Show how many hops apart they currently are; newly approved links shimmer briefly.
- Later: comments and stories on connections ("this song got me into this band").

### Moderation (automatic by default)

The owner does not want to moderate manually.

- New links start in review with a low score.
- They go live after enough upvotes, or immediately from trusted contributors (trust score on profiles).
- Only unusual cases are flagged for a human.
- Must handle vote brigading, fake artists, offensive constellation names.

### User constellations (signature feature, later)

Users draw and name constellations across artists, like playlists with mythology (e.g. "the Bleeding Scorpion"). Shareable and followable. Seed a few curated ones to solve cold start.

## Tech Stack

Same stack as the owner's other project (574 Scout): free to start, scales later.

- **Web:** Next.js on Vercel. Server functions call external APIs so keys stay private.
- **Database/auth:** Supabase (Postgres + built-in auth).
- **Graph rendering:** WebGL, e.g. Sigma.js + graphology (preferred for large fixed-position graphs) or react-force-graph.
- **Data pipeline:** offline Python script (graphology-compatible layout via `fa2`/networkx or igraph; `leidenalg` for clustering).
- **Free-tier limits:** Supabase free projects pause after ~1 week idle and cap at 500 MB. Load a curated subset; load the galaxy in chunks by zoom level.

## Data Sources

Primary similarity source is **undecided**: run the comparison test first.

| Source | Use | Notes |
| --- | --- | --- |
| ListenBrainz | Similar artists, popularity | Open (listen data CC0; confirm similarity data licence). Keyed by MusicBrainz IDs. Similar-artists endpoint is in the experimental "labs" API. Thinner data for obscure artists. |
| Last.fm | Similar artists with match scores, listener and play counts | Non-commercial use only without an agreement; ~100 MB storage cap without written consent; caching must follow HTTP headers; attribution with links required. Use as a supplement, not the foundation. |
| MusicBrainz | Canonical IDs, country, active dates, aliases, albums (release groups), band-member relationships, Wikipedia links | Core data is public domain. API ~1 req/sec, so use the full data export or targeted lookups for a curated subset. No popularity or similarity data. |
| Deezer / iTunes | 30-second previews | Fewer restrictions than Spotify. |
| Wikipedia | Artist bios (later) | Free API. |
| Spotify | Avoid as a dependency | Related-artists endpoint closed to new apps; no stream counts. Maybe later for playlist export only. |

**Entity matching:** use MusicBrainz IDs (MBIDs) as the primary key for artists everywhere. Names repeat (several bands called "Ghost"), and Last.fm does not always give an MBID.

## Database Design (first pass)

| Table | Holds |
| --- | --- |
| artists | name, MBID, listener count, fixed x/y, region |
| connections | artist A, artist B (lower ID first, unique pair), seed score + source, vote total, added by, status (approved / in review) |
| votes | one row per user per connection, up or down; unique (user, connection) |
| albums | artist, release-group MBID, type, release date, play count |
| regions | genre clusters for zoom levels, parent region for nesting, label |
| constellations + constellation_stars | name, creator; ordered artist list |
| profiles | Supabase auth users + trust score |

## Data Pipeline

Offline Python script, run occasionally; the website only reads results.

1. **Choose starting artists:** e.g. the top few thousand metal artists by listener count.
2. **Get connections:** similar artists + popularity from ListenBrainz and/or Last.fm.
3. **Fill in details:** match to MusicBrainz for IDs, country, tags, albums.
4. **Build the galaxy:** compute fixed positions; cluster into nested regions.
5. **Save:** write to the database (or a static JSON file for early prototypes).

Later: schedule it (e.g. weekly via GitHub Actions) to add new artists and releases.

## Roadmap

- **Milestone 1 – Metal galaxy prototype (built):** pipeline for a few hundred to a few thousand metal artists; explorable fixed galaxy with search, click-to-travel, semantic zoom, previews. No accounts. Goal: find out whether exploring feels good.
- **Phase 2:** Supabase-backed data, accounts, voting, adding artists and connections, auto-moderation.
- **Phase 3:** comments and stories on connections.
- **Later:** artist panel, band solar systems, user constellations, personal map, playlist export, journeys.

## Open Decisions and Tasks

- [ ] ListenBrainz vs Last.fm comparison: 10 metal artists from huge to obscure; decide the primary similarity source.
- [ ] Confirm the licence of ListenBrainz similarity data.
- [ ] Define success metrics (e.g. people click 5+ artists deep; weekly return).
- [ ] Mobile: touch and pinch-to-zoom design for the galaxy.
- [ ] Research similar projects: Music-Map (Gnod), Every Noise at Once, Liveplasma. Are they maintained? What can be learned?
- [ ] Prototype connecting existing artists (drag vs connect mode).
- [ ] Prototype the motion (pop-in, camera glide, lines drawing outward).
- [ ] Project name.
