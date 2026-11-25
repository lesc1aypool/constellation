"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GalaxyMap, { type GalaxyMapHandle, type Nav } from "./GalaxyMap";
import { type Artist, type Galaxy, REGION_COLORS, formatListeners } from "@/lib/galaxy";

type Track = { title: string; preview: string; link: string; album: string; cover: string };
type Preview =
  | { status: "idle" }
  | { status: "loading"; mbid: string }
  | { status: "none"; mbid: string }
  | { status: "ready"; mbid: string; deezerLink: string; tracks: Track[]; index: number };

const norm = (s: string) =>
  s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Browsers only allow audio to start from a user gesture. Playing a tiny
// silent clip on the first tap "unlocks" the element for later previews.
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

type AppProps = {
  /** Where to load galaxy.json from. */
  dataUrl?: string;
  /** Play Deezer previews (needs the /api/preview route). Off in the static demo. */
  previews?: boolean;
};

export default function GalaxyApp({ dataUrl = "/galaxy.json", previews = true }: AppProps) {
  const [galaxy, setGalaxy] = useState<Galaxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview>({ status: "idle" });
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [nav, setNav] = useState<Nav | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef(0);
  const showNotice = useCallback((message: string) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3200);
  }, []);
  const mapRef = useRef<GalaxyMapHandle>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlocked = useRef(false);

  useEffect(() => {
    fetch(dataUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`galaxy.json: ${r.status}`))))
      .then(setGalaxy)
      .catch((e) => setError(String(e)));
  }, [dataUrl]);

  const byId = useMemo(() => new Map(galaxy?.artists.map((a) => [a.mbid, a]) ?? []), [galaxy]);
  const clusterById = useMemo(() => new Map(galaxy?.clusters.map((c) => [c.id, c]) ?? []), [galaxy]);
  const regionColor = useMemo(() => {
    const m = new Map<string, string>();
    galaxy?.clusters.filter((c) => !c.parentId).forEach((c, i) => m.set(c.id, REGION_COLORS[i % REGION_COLORS.length]));
    return m;
  }, [galaxy]);
  const neighbours = useMemo(() => {
    const m = new Map<string, { mbid: string; weight: number }[]>();
    for (const e of galaxy?.edges ?? []) {
      if (!m.has(e.source)) m.set(e.source, []);
      if (!m.has(e.target)) m.set(e.target, []);
      m.get(e.source)!.push({ mbid: e.target, weight: e.weight });
      m.get(e.target)!.push({ mbid: e.source, weight: e.weight });
    }
    for (const list of m.values()) list.sort((a, b) => b.weight - a.weight);
    return m;
  }, [galaxy]);

  // --- audio ---------------------------------------------------------------------
  const audio = () => {
    if (!audioRef.current) {
      const el = new Audio();
      el.volume = 0.8;
      el.addEventListener("play", () => setPlaying(true));
      el.addEventListener("pause", () => setPlaying(false));
      el.addEventListener("ended", () => setPlaying(false));
      audioRef.current = el;
    }
    return audioRef.current;
  };

  const unlockAudio = () => {
    if (unlocked.current) return;
    unlocked.current = true;
    const el = audio();
    el.src = SILENT_WAV;
    el.play().catch(() => {});
  };

  const playTrack = useCallback((track: Track | undefined) => {
    const el = audio();
    if (!track) return el.pause();
    el.src = track.preview;
    el.play().catch(() => setPlaying(false));
  }, []);

  // Fetch previews for an artist. Called straight from the click/tap handler so
  // the browser still treats the eventual play() as user-initiated.
  const requestId = useRef(0);
  const loadPreview = (mbid: string) => {
    const artist = byId.get(mbid);
    if (!artist || !previews) return;
    const id = ++requestId.current;
    setPreview({ status: "loading", mbid });
    fetch(`/api/preview?artist=${encodeURIComponent(artist.name)}`)
      .then((r) => r.json())
      .then((d: { artist: { link: string } | null; tracks: Track[] }) => {
        if (id !== requestId.current) return; // a newer click won
        if (!d.artist || !d.tracks?.length) {
          setPreview({ status: "none", mbid });
          audio().pause();
          return;
        }
        setPreview({ status: "ready", mbid, deezerLink: d.artist.link, tracks: d.tracks, index: 0 });
        if (soundOn) playTrack(d.tracks[0]);
      })
      .catch(() => id === requestId.current && setPreview({ status: "none", mbid }));
  };

  // --- navigation ----------------------------------------------------------------
  // Selecting a band enters interaction layer 4; the map follows `selected`.
  const select = (mbid: string | null, opts: { fromTrail?: number } = {}) => {
      unlockAudio();
      setSelected(mbid);
      if (!mbid) return;
      if (mbid !== selected) loadPreview(mbid);
      setTrail((t) => {
        if (opts.fromTrail !== undefined) return t.slice(0, opts.fromTrail + 1);
        if (t[t.length - 1] === mbid) return t;
        return [...t, mbid].slice(-40);
      });
  };

  if (error) return <div className="p-6 text-red-300">Couldn&apos;t load the galaxy: {error}</div>;

  const artist = selected ? byId.get(selected) : undefined;
  const current = preview.status === "ready" && preview.mbid === selected ? preview : null;

  return (
    <main className="starfield fixed inset-0 overflow-hidden text-zinc-100">
      {galaxy ? (
        <GalaxyMap
          ref={mapRef}
          galaxy={galaxy}
          selected={selected}
          onSelect={(m) => select(m)}
          onNavChange={setNav}
          onNotice={showNotice}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-sm text-zinc-400">Charting the galaxy…</div>
      )}

      {/* Top bar: search + breadcrumbs */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <h1 className="hidden text-sm font-semibold tracking-[0.25em] text-zinc-300 uppercase sm:block">Constellation</h1>
          {galaxy && <Search artists={galaxy.artists} onPick={(m) => select(m)} />}
        </div>
        {nav && (
          <div className="pointer-events-auto flex max-w-full flex-col gap-1 text-[11px]">
            <Location nav={nav} band={artist?.name ?? null} onGo={(layer, id) => mapRef.current?.goTo(layer, id)} />
            {trail.length > 1 && (
              <nav aria-label="Bands you've visited" className="flex max-w-full items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
                <span className="shrink-0 text-zinc-600">Path</span>
                {trail.map((m, i) => {
                  const a = byId.get(m);
                  const isCurrent = i === trail.length - 1 && m === selected;
                  return (
                    <span key={`${m}-${i}`} className="flex shrink-0 items-center gap-1">
                      {i > 0 && <span className="text-zinc-700">›</span>}
                      <button
                        onClick={() => select(m, { fromTrail: i })}
                        className={`rounded-full px-1.5 py-0.5 transition ${isCurrent ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                      >
                        {a?.name ?? "?"}
                      </button>
                    </span>
                  );
                })}
              </nav>
            )}
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute right-3 bottom-3 flex flex-col gap-1 max-sm:top-28 max-sm:bottom-auto sm:right-4 sm:bottom-4">
        <RoundButton title="Go one layer deeper" onClick={() => mapRef.current?.stepIn()}>+</RoundButton>
        <RoundButton title="Back out one layer" onClick={() => mapRef.current?.stepOut()}>−</RoundButton>
        <RoundButton title="Whole universe" onClick={() => mapRef.current?.goTo(1)}>◎</RoundButton>
      </div>

      {/* Artist panel */}
      {artist && (
        <aside className="absolute inset-x-2 bottom-2 max-h-[46vh] overflow-y-auto rounded-2xl bg-[#0b0c18]/85 p-4 ring-1 ring-white/10 backdrop-blur-md sm:inset-x-auto sm:top-4 sm:right-16 sm:bottom-auto sm:max-h-[calc(100vh-2rem)] sm:w-80">
          <ArtistPanel
            artist={artist}
            regionLabels={artist.clusterIds.map((id) => clusterById.get(id)?.label ?? "")}
            color={regionColor.get(artist.clusterIds[0]) ?? "#fff"}
            neighbours={(neighbours.get(artist.mbid) ?? []).slice(0, 12).map((n) => byId.get(n.mbid)!).filter(Boolean)}
            onPick={(m) => select(m)}
            onClose={() => setSelected(null)}
          />
          <div className="mt-4 border-t border-white/10 pt-3">
            {!previews && (
              <p className="text-xs text-zinc-400">
                Previews play in the full app.{" "}
                <a
                  href={`https://www.deezer.com/search/${encodeURIComponent(artist.name)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-zinc-200"
                >
                  Listen on Deezer
                </a>
              </p>
            )}
            {preview.status === "loading" && <p className="text-xs text-zinc-400">Finding a preview…</p>}
            {preview.status === "none" && <p className="text-xs text-zinc-400">No preview found on Deezer.</p>}
            {current && (
              <PreviewPlayer
                preview={current}
                playing={playing}
                soundOn={soundOn}
                onToggle={() => {
                  const el = audio();
                  if (el.paused) {
                    if (!el.src || el.src === SILENT_WAV) playTrack(current.tracks[current.index]);
                    else el.play().catch(() => {});
                  } else el.pause();
                }}
                onNext={() => {
                  const index = (current.index + 1) % current.tracks.length;
                  setPreview({ ...current, index });
                  playTrack(current.tracks[index]);
                }}
                onSoundToggle={() => {
                  setSoundOn((s) => !s);
                  if (soundOn) audio().pause();
                }}
              />
            )}
          </div>
        </aside>
      )}

      {notice ? (
        <p role="status" className="pointer-events-none absolute inset-x-4 bottom-10 text-center text-xs text-zinc-300 sm:bottom-5">
          <span className="rounded-full bg-black/60 px-3 py-1.5 ring-1 ring-white/10 backdrop-blur">{notice}</span>
        </p>
      ) : (
        !selected &&
        nav && (
          <p className="pointer-events-none absolute inset-x-4 bottom-10 text-center text-xs text-zinc-500 sm:bottom-4">
            {LAYER_HINTS[nav.layer]}
          </p>
        )
      )}

      <footer className="absolute bottom-1 left-2 text-[10px] text-zinc-600 max-sm:hidden">
        Data: <a className="underline" href="https://www.last.fm" target="_blank" rel="noreferrer">Last.fm</a> ·{" "}
        <a className="underline" href="https://musicbrainz.org" target="_blank" rel="noreferrer">MusicBrainz</a> · Previews:{" "}
        <a className="underline" href="https://www.deezer.com" target="_blank" rel="noreferrer">Deezer</a>
      </footer>
    </main>
  );
}

const LAYER_HINTS: Record<number, string> = {
  1: "Scroll or pinch into a genre · click or tap a name to enter",
  2: "Scroll or pinch into a subgenre · drag to explore",
  3: "Click or tap a band to see its neighbourhood · drag to wander",
  4: "",
};

// "Where am I": Universe › genre › subgenre › band. Small, to the side.
function Location({
  nav, band, onGo,
}: {
  nav: Nav;
  band: string | null;
  onGo: (layer: 1 | 2 | 3, id?: string) => void;
}) {
  const parts: { label: string; onClick?: () => void; current: boolean }[] = [
    { label: "Universe", onClick: nav.layer > 1 ? () => onGo(1) : undefined, current: nav.layer === 1 },
  ];
  if (nav.layer >= 2 && nav.regionLabel)
    parts.push({
      label: nav.regionLabel,
      onClick: nav.layer > 2 ? () => onGo(2, nav.regionId!) : undefined,
      current: nav.layer === 2,
    });
  if (nav.layer >= 3 && nav.subLabel)
    parts.push({
      label: nav.subLabel,
      onClick: nav.layer > 3 ? () => onGo(3, nav.subId!) : undefined,
      current: nav.layer === 3,
    });
  if (nav.layer === 4 && band) parts.push({ label: band, current: true });
  return (
    <nav aria-label="Where you are" className="flex flex-wrap items-center gap-1 tracking-wide">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-zinc-700">›</span>}
          {p.onClick ? (
            <button onClick={p.onClick} className="rounded px-1 text-zinc-400 hover:text-zinc-100">
              {p.label}
            </button>
          ) : (
            <span className="px-1 font-medium" style={{ color: p.current && i > 0 && nav.color ? nav.color : "#e4e4ee" }}>
              {p.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

function RoundButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-lg text-zinc-200 ring-1 ring-white/10 backdrop-blur hover:bg-white/10"
    >
      {children}
    </button>
  );
}

// --- Search with autocomplete ------------------------------------------------------

function Search({ artists, onPick }: { artists: Artist[]; onPick: (mbid: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const index = useMemo(() => artists.map((a) => ({ a, n: norm(a.name) })), [artists]);

  const results = useMemo(() => {
    const nq = norm(q);
    if (!nq) return [];
    const scored = index
      .map(({ a, n }) => {
        const pos = n.indexOf(nq);
        if (pos < 0) return null;
        const wordStart = pos === 0 || n[pos - 1] === " ";
        return { a, score: (pos === 0 ? 0 : wordStart ? 1 : 2) * 1e9 - a.listeners };
      })
      .filter((x): x is { a: Artist; score: number } => x !== null)
      .sort((x, y) => x.score - y.score);
    return scored.slice(0, 8).map((x) => x.a);
  }, [q, index]);

  const pick = (a: Artist) => {
    onPick(a.mbid);
    setQ("");
    setOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div className="relative w-full sm:w-72">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            pick(results[active]);
          } else if (e.key === "Escape") {
            setQ("");
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Search artists…"
        aria-label="Search artists"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="search-results"
        className="w-full rounded-full bg-black/50 px-4 py-2 text-sm text-zinc-100 ring-1 ring-white/15 outline-none backdrop-blur placeholder:text-zinc-500 focus:ring-white/40"
      />
      {open && results.length > 0 && (
        <ul id="search-results" role="listbox" className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-xl bg-[#0b0c18]/95 py-1 ring-1 ring-white/10 backdrop-blur">
          {results.map((a, i) => (
            <li key={a.mbid} role="option" aria-selected={i === active}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(a)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-baseline justify-between gap-3 px-4 py-1.5 text-left text-sm ${i === active ? "bg-white/10" : ""}`}
              >
                <span className="truncate">{a.name}</span>
                <span className="shrink-0 text-[11px] text-zinc-500">{a.tags[0]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Artist panel ------------------------------------------------------------------

function ArtistPanel({
  artist, regionLabels, color, neighbours, onPick, onClose,
}: {
  artist: Artist;
  regionLabels: string[];
  color: string;
  neighbours: Artist[];
  onPick: (mbid: string) => void;
  onClose: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-wider uppercase" style={{ color }}>
            {regionLabels.filter(Boolean).join(" › ")}
          </p>
          <h2 className="mt-0.5 text-xl leading-tight font-semibold">{artist.name}</h2>
          <p className="mt-1 text-xs text-zinc-400">
            {formatListeners(artist.listeners)} listeners ·{" "}
            <a href={artist.url} target="_blank" rel="noreferrer" className="underline hover:text-zinc-200">
              Last.fm
            </a>
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="-mt-1 -mr-1 rounded-full px-2 text-lg text-zinc-500 hover:text-zinc-200">
          ×
        </button>
      </div>
      {artist.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {artist.tags.map((t) => (
            <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300">
              {t}
            </span>
          ))}
        </div>
      )}
      {neighbours.length > 0 && (
        <>
          <p className="mt-4 text-[11px] tracking-wider text-zinc-500 uppercase">Nearby stars</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {neighbours.map((n) => (
              <button
                key={n.mbid}
                onClick={() => onPick(n.mbid)}
                className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-200 ring-1 ring-white/10 hover:bg-white/15"
              >
                {n.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PreviewPlayer({
  preview, playing, soundOn, onToggle, onNext, onSoundToggle,
}: {
  preview: Extract<Preview, { status: "ready" }>;
  playing: boolean;
  soundOn: boolean;
  onToggle: () => void;
  onNext: () => void;
  onSoundToggle: () => void;
}) {
  const track = preview.tracks[preview.index];
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={track.cover} alt="" className="h-12 w-12 rounded-md object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{track.title}</p>
        <p className="truncate text-[11px] text-zinc-500">
          {track.album} ·{" "}
          <a href={track.link} target="_blank" rel="noreferrer" className="underline hover:text-zinc-300">
            Deezer
          </a>
        </p>
      </div>
      <button onClick={onToggle} aria-label={playing ? "Pause" : "Play"} className="grid h-9 w-9 place-items-center rounded-full bg-white text-black">
        {playing ? "❚❚" : "▶"}
      </button>
      {preview.tracks.length > 1 && (
        <button onClick={onNext} aria-label="Next track" title="Next track" className="text-zinc-400 hover:text-white">
          ⏭
        </button>
      )}
      <button
        onClick={onSoundToggle}
        title={soundOn ? "Autoplay on: previews start when you click a star" : "Autoplay off"}
        aria-label="Toggle autoplay"
        className={`text-xs ${soundOn ? "text-zinc-300" : "text-zinc-600"}`}
      >
        {soundOn ? "🔊" : "🔇"}
      </button>
    </div>
  );
}
